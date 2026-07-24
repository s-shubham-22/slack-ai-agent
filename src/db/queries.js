import pool from './index.js';
import { log } from '../config/logger.js';

export async function initDatabase() {
	const client = await pool.connect();

	try {
		await client.query(`
      CREATE TABLE IF NOT EXISTS member_analyses (
        id SERIAL PRIMARY KEY,
        member_id VARCHAR(255),
        member_name VARCHAR(255) NOT NULL,
        member_email VARCHAR(255),
        member_title VARCHAR(255),
        member_timezone VARCHAR(100),
        fit_score INTEGER NOT NULL,
        insights JSONB,
        recommendations JSONB,
        research_data JSONB,
        analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_to_slack BOOLEAN DEFAULT FALSE,
        sent_to_slack_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );  
    `);

		await client.query(`
      CREATE INDEX IF NOT EXISTS idx_member_id ON member_analyses(member_id);
      CREATE INDEX IF NOT EXISTS idx_analyzed_at ON member_analyses(analyzed_at);
    `);

		log.info('Database schema initialized successfully');
	} catch (error) {
		log.error('Database initialization failed:', error.message);
		throw error;
	} finally {
		client.release();
	}
}

export async function saveMemberAnalysis(memberInfo, analysis, researchData) {
	const client = await pool.connect();

	try {
		const result = await client.query(
			`INSERT INTO member_analyses (
				member_id,
				member_name,
				member_email,
				member_title,
				member_timezone,
				fit_score,
				insights,
				recommendations,
				research_data
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
			[
				memberInfo.id,
				memberInfo.name,
				memberInfo.email,
				memberInfo.title,
				memberInfo.timezone,
				analysis.fitScore,
				JSON.stringify(analysis.insights),
				JSON.stringify(analysis.recommendations),
				JSON.stringify(researchData),
			],
		);

		log.info(
			`Analysis saved to database with id: ${result.rows[0].id}`,
		);

		return result.rows[0].id;
	} catch (error) {
		log.error(
			'Failed to save analysis to database:',
			error.message,
		);
		throw error;
	} finally {
		client.release();
	}
}

export async function markAsSentToSlack(analysisId) {
	const client = await pool.connect();

	try {
		await client.query(
			`UPDATE member_analyses
      SET sent_to_slack = TRUE,
      sent_to_slack_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
			[analysisId],
		);

		log.info(`Marked analysis ${analysisId} as sent to Slack`);
	} catch (error) {
		log.error(
			'Failed to mark analysis as sent to Slack:',
			error.message,
		);
		throw error;
	} finally {
		client.release();
	}
}

export async function closeDatabase() {
	await pool.end();
	log.info('Database connection closed');
}
