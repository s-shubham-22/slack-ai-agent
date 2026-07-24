import { log } from '../config/logger.js';
import { getUserInfo } from '../services/slackService.js';
import { analyzeAndPostMember } from '../services/memberService.js';

export function setupSlackEvents(slackApp) {
	slackApp.event('team_join', async ({ event }) => {
		try {
			log.info(
				'New user joined team:',
				event.user.real_name || event.user.name,
			);
			const userInfo = await getUserInfo(event.user.id);
			log.info('User info:', userInfo);
			await analyzeAndPostMember(userInfo);
		} catch (error) {
			log.error('Error processing team_join:', error.message);
		}
	});

	slackApp.event('member_joined_channel', async ({ event }) => {
		try {
			if (event.channel_type === 'C') {
				log.info(
					`Member ${event.user} joined channel ${event.channel}`,
				);
				const userInfo = await getUserInfo(event.user);
				log.info('User info:', userInfo);
				await analyzeAndPostMember(userInfo);
			}
		} catch (error) {
			log.error(
				'Error processing member_joined_channel:',
				error.message,
			);
		}
	});

	slackApp.error(async (error) => {
		log.error('Slack Error:', error.message);
	});
}
