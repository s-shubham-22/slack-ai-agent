import { log } from '../config/logger.js';
import { doBasicResearch } from './researchService.js';
import { analyzeWithAI } from './aiService.js';
import { postAnalysisToChannel } from './slackService.js';
import { saveMemberAnalysis, markAsSentToSlack } from '../db/queries.js';

export async function analyzeAndPostMember(memberInfo) {
	let analysisId = null;

	try {
		log.info(`Processing member: ${memberInfo.name}`);

		const researchData = await doBasicResearch(memberInfo);
		const analysis = await analyzeWithAI(memberInfo, researchData);

		log.info(`Saving analysis to database for ${memberInfo.name}`);

		analysisId = await saveMemberAnalysis(
			memberInfo,
			analysis,
			researchData,
		);

		await postAnalysisToChannel(
			memberInfo,
			analysis,
			researchData,
		);

		if (analysisId) {
			await markAsSentToSlack(analysisId);
		}

		return analysis;
	} catch (error) {
		log.error(`Error processing ${memberInfo.name}:`, error.message);

		if (analysisId) {
			log.info(
				`Analysis ${analysisId} saved to database but not sent to SLack due to error`,
			);
		}

		throw error;
	}
}
