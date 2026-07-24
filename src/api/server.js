import express from 'express';
import { log } from '../config/logger.js';
import { analyzeAndPostMember } from '../services/memberService.js';

export function setupExpress() {
	const app = express();

	app.use(express.json());

	app.get('/health', (req, res) => {
		res.json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
		});
	});

	if (process.env.NODE_ENV === 'development') {
		app.post('/test/analyze-member', async (req, res) => {
			try {
				const { memberInfo } = req.body;
				if (!memberInfo) {
					return res.status(400).json({
						error: 'memberInfo is required',
					});
				}

				const analysis = await analyzeAndPostMember(memberInfo);
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

	app.use((err, req, res, next) => {
		log.error('Express Error:', err.message);
		res.status(500).json({
			error: 'Internal Server Error',
			message: err.message,
		});
	});

	return app;
}
