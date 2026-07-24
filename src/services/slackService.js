import { WebClient } from '@slack/web-api';
import { log } from '../config/logger.js';
import { getColorForScore } from '../utils/helpers.js';
import dotenv from 'dotenv';

dotenv.config();

const webClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function getUserInfo(userId) {
	const result = await webClient.users.info({ user: userId });
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

export async function postAnalysisToChannel(memberInfo, analysis, researchData) {
	const color = getColorForScore(analysis.fitScore);

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

	await webClient.chat.postMessage({
		channel: process.env.SLACK_PRIVATE_CHANNEL_ID,
		text: `New member analysis: ${memberInfo.name} (${analysis.fitScore}/100)`,
		blocks: blocks,
	});

	log.info(`Analysis is posted to channel for ${memberInfo.name}`);
}
