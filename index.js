import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

import {
	initDatabase,
	saveMemberAnalysis,
	markAsSentToSlack,
	closeDatabase,
} from './db.js';

dotenv.config();

const log = {
	info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
	error: (msg, ...args) => console.log(`[ERROR] ${msg}`, ...args),
	debug: (msg, ...args) =>
		process.env.NODE_ENV === 'development' &&
		console.debug(`[DEBUG] ${msg}`, ...args),
};

class SlackAIAgent {
	constructor() {
		this.app = express();
		this.slack = new App({
			token: process.env.SLACK_BOT_TOKEN,
			signingSecret: process.env.SLACK_SIGNING_SECRET,
			socketMode: true,
			appToken: process.env.SLACK_APP_TOKEN,
		});
		this.webClient = new WebClient(process.env.SLACK_BOT_TOKEN);
		this.groq = new ChatGroq({
			model: 'llama-3.3-70b-versatile',
			temperature: 0.3,
			apiKey: process.env.GROQ_API_KEY,
		});
		this.setupSlackEvents();
		this.setupExpress();
	}

	setupSlackEvents() {
		this.slack.event('team_join', async ({ event }) => {
			try {
				log.info(
					'New user joined team:',
					event.user.real_name || event.user.name,
				);
				const userInfo = await this.getUserInfo(event.user.id);
				log.info('User info:', userInfo);
				await this.analyzeAndPostMember(userInfo);
			} catch (error) {
				log.error('Error processing team_join:', error.message);
			}
		});

		this.slack.event('member_joined_channel', async ({ event }) => {
			try {
				if (event.channel_type === 'C') {
					log.info(
						`Member ${event.user} joined channel ${event.channel}`,
					);
					const userInfo = await this.getUserInfo(event.user);
					log.info('User info:', userInfo);
					await this.analyzeAndPostMember(userInfo);
				}
			} catch (error) {
				log.error(
					'Error processing member_joined_channel:',
					error.message,
				);
			}
		});

		this.slack.error(async (error) => {
			log.error('Slack Error:', error.message);
		});
	}

	setupExpress() {
		this.app.use(express.json());

		this.app.get('/health', (req, res) => {
			res.json({
				status: 'healthy',
				timestamp: new Date().toISOString(),
			});
		});

		if (process.env.NODE_ENV === 'development') {
			this.app.post('/test/analyze-member', async (req, res) => {
				try {
					const { memberInfo } = req.body;
					if (!memberInfo) {
						return res.status(400).json({
							error: 'memberInfo is required',
						});
					}

					const analysis =
						await this.analyzeAndPostMember(memberInfo);
					res.json({
						success: true,
						analysis,
						timestamp: new Date().toISOString(),
					});
				} catch (error) {
					log.error('Test analysis error:', error.message);
					res.status(500).json({
						error: 'Analysis Failed',
						message: error.message,
					});
				}
			});
		}

		this.app.use((err, req, res, next) => {
			log.error('Express Error:', err.message);
			res.status(500).json({
				error: 'Internal Server Error',
				message: err.message,
			});
		});
	}

	async getUserInfo(userId) {
		const result = await this.webClient.users.info({ user: userId });
		const user = result.user;

		return {
			id: user.id,
			name: user.real_name || user.name,
			username: user.name,
			email: user.profile?.email,
			title: user.profile?.title,
			timezone: user.tz,
			profile: {
				firstName: user.profile?.first_name,
				lastName: user.profile?.last_name,
				status: user.profile?.status_text,
			},
		};
	}

	async analyzeAndPostMember(memberInfo) {
		let analysisId = null;

		try {
			log.info(`Processing member: ${memberInfo.name}`);

			const researchData = await this.doBasicResearch(memberInfo);
			const analysis = await this.analyzeWithAI(memberInfo, researchData);

			log.info(`Saving analysis to database for ${memberInfo.name}`);

			analysisId = await saveMemberAnalysis(
				memberInfo,
				analysis,
				researchData,
			);

			await this.postAnalysisToChannel(
				memberInfo,
				analysis,
				researchData,
			);

			if (analysisId) {
				await markAsSentToSlack(analysisId);
			}
		} catch (error) {
			log.error(`Error processing ${memberInfo.name}:`, error.message);

			if (analysisId) {
				log.info(
					`Analysis ${analysisId} saved to database but not sent to SLack due to
          error`,
				);
			}

			throw error;
		}
	}

	async doBasicResearch(memberInfo) {
		const results = [];

		try {
			if (memberInfo.email && !this.isPersonalEmail(memberInfo.email)) {
				const domain = memberInfo.email.split('@')[1];
				const companyInfo = await this.getCompanyInfo(domain);

				if (companyInfo) {
					results.push(companyInfo);
				}

				if (memberInfo.name) {
					const githubInfo = await this.getGitHubInfo(
						memberInfo.name,
					);
					if (githubInfo) {
						results.push(githubInfo);
					}
				}
			}
		} catch (error) {
			log.error('Research error:', error.message);
		}

		return results;
	}

	async getCompanyInfo(domain) {
		try {
			const response = await axios.get(`https://www.${domain}`, {
				timeout: 5000,
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				},
			});

			const titleMatch = response.data.match(/<title>(.*?)<\/title>/);
			const title = titleMatch ? titleMatch[1] : `Company: ${domain}`;

			return {
				url: `https://www.${domain}`,
				title: title,
				content: `Company website for ${domain}`,
				type: 'company',
			};
		} catch (error) {
			log.error(`Could not fetch ${domain}:`, error.message);
			return null;
		}
	}

	async getGitHubInfo(username) {
		try {
			const response = await axios.get(
				`https://api.github.com/search/users?q=${encodeURIComponent(
					username,
				)}`,
				{ timeout: 5000 },
			);

			if (response.data.items && response.data.items.length > 0) {
				const user = response.data.items[0];
				return {
					url: user.html_url,
					title: `Github: ${user.login}`,
					content: `${user.public_repos} public repositories`,
					type: 'github',
				};
			}
		} catch (error) {
			log.debug(`GitHub search error:`, error.message);
		}
		return null;
	}

	async analyzeWithAI(memberInfo, researchData) {
		const prompt = ChatPromptTemplate.fromTemplate(
			`Analyze this new community member for fit with our commercial product.

      Company: ${process.env.COMPANY_NAME || `Your Company`}
      Product: ${process.env.COMPANY_PRODUCT || `Your Product`}

      Member:
      - Name: {name}
      - Email: {email}
      - Title: {title}

      Research:
      {reserach}

      Provide a JSON response with:
      - fitScore (0-100): likelihood they'd be interested in our product.
      - insights: array of 3-5 key observations
      - recommendations: array of 2-4 engagement suggestions

      Consider job title, company size, technical background, and budget
      authority.
      `,
		);

		try {
			const researchSummary =
				researchData.length > 0
					? researchData
							.map((item) => `${item.title}: ${item.content}`)
							.join('\n')
					: 'Limited research data available';

			const chain = prompt.pipe(this.groq);
			const response = await chain.invoke({
				name: memberInfo.name,
				email: memberInfo.email || 'Not Provided',
				title: memberInfo.title || 'Not Provided',
				reserach: researchSummary,
			});

			const responseText = response.content || response;

			const jsonMatch = responseText.match(
				/```json\s*\n([\s\S]*?)\n\s*```/,
			);
			const cleanedResponse = jsonMatch
				? jsonMatch[1].trim()
				: responseText.trim();

			const analysis = JSON.parse(cleanedResponse);

			return {
				fitScore: Math.max(
					0,
					Math.min(100, parseInt(analysis.fitScore) || 50),
				),
				insights: Array.isArray(analysis.insights)
					? analysis.insights
					: ['Analysis Completed'],
				recommendations: Array.isArray(analysis.recommendations)
					? analysis.recommendations
					: ['Follow up recommended'],
			};
		} catch (error) {
			log.error('AI Analysis Error:', error.message);
			return {
				fitScore: 50,
				insights: ['Unable to complete full analysis'],
				recommendations: ['Manual review recommended'],
			};
		}
	}

	async postAnalysisToChannel(memberInfo, analysis, researchData) {
		const getScoreColor = (score) => {
			if (score >= 80) return '#36a64f';
			if (score >= 60) return '#ffb84d';
			if (score >= 40) return '#ff9500';
			return '#ff4444';
		};

		const color = getScoreColor(analysis.fitScore);

		const blocks = [
			{
				type: 'header',
				text: {
					type: 'plain_text',
					text: `🔍 New Member: ${memberInfo.name}`,
				},
			},
			{
				type: 'section',
				fields: [
					{
						type: 'mrkdwn',
						text: `*Fit Score:* ${analysis.fitScore}/100`,
					},
					{
						type: 'mrkdwn',
						text: `*Email:* ${memberInfo.email || 'N/A'}`,
					},
					{
						type: 'mrkdwn',
						text: `*Title:* ${memberInfo.title || 'N/A'}`,
					},
				],
			},
		];

		if (analysis.insights.length > 0) {
			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Insights:*\n${analysis.insights.map((i) => `- ${i}`).join('\n')}`,
				},
			});
		}

		if (analysis.recommendations.length > 0) {
			blocks.push({
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `*Recommendations:*\n${analysis.recommendations.map((r) => `- ${r}`).join('\n')}`,
				},
			});
		}

		blocks.push({
			type: 'context',
			elements: [
				{
					type: 'mrkdwn',
					text: `*Analyzed:* ${new Date().toLocaleString()}`,
				},
			],
		});

		await this.webClient.chat.postMessage({
			channel: process.env.SLACK_PRIVATE_CHANNEL_ID,
			text: `New member analysis: ${memberInfo.name} (${analysis.fitScore}/100)`,
			blocks: blocks,
		});

		log.info(`Analysis is posted to channel for ${memberInfo.name}`);
	}

	isPersonalEmail(email) {
		if (!email) return false;
		const domain = email.split('@')[1];
		const personalDomains = [
			'gmail.com',
			'yahoo.com',
			'hotmail.com',
			'outlook.com',
			'icloud.com',
			'aol.com',
		];
		return personalDomains.includes(domain);
	}

	async start() {
		try {
			log.info('Initializing Database...');
			await initDatabase();

			const port = process.env.PORT || 3000;
			this.server = this.app.listen(port, () => {
				log.info(`🚀 Express server running on port: ${port}`);
			});

			await this.slack.start();
			log.info('⚡ Slack bot connected');

			log.info('🎉 Slack AI Agent is running!');

			if (process.env.NODE_ENV === 'development') {
				log.info(
					`Test endpoint: POST http://localhost:${port}/test/analyze-member`,
				);
			}
		} catch (error) {
			log.error('Failed to start:', error.message);
			process.exit(1);
		}
	}

	async stop() {
		log.info('Shutting down gracefully...');

		try {
			if (this.slack) {
				await this.slack.stop();
				log.info('⚡ Slack bot disconnected');
			}

			if (this.server) {
				this.server.close(() => {
					log.info('🛑 Server stopped');
				});
			}

			await closeDatabase();
		} catch (error) {
			log.error('Shutdown error:', error.message);
			process.exit(1);
		}
		process.exit(0);
	}
}

const agent = new SlackAIAgent();

agent.start().catch((error) => {
	log.error('Failed to start:', error.message);
	process.exit(1);
});

process.on('SIGINT', () => agent.stop());
process.on('SIGTERM', () => agent.stop());

export default agent;
