import { App } from '@slack/bolt';
import dotenv from 'dotenv';
import { log } from './src/config/logger.js';
import { initDatabase, closeDatabase } from './src/db/queries.js';
import { setupSlackEvents } from './src/events/slackEvents.js';
import { setupExpress } from './src/api/server.js';

dotenv.config();

class SlackAIAgent {
	constructor() {
		this.slack = new App({
			token: process.env.SLACK_BOT_TOKEN,
			signingSecret: process.env.SLACK_SIGNING_SECRET,
			socketMode: true,
			appToken: process.env.SLACK_APP_TOKEN,
		});
		
		setupSlackEvents(this.slack);
		this.app = setupExpress();
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
