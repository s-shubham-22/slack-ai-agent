import { ChatGroq } from '@langchain/groq';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { log } from '../config/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const groq = new ChatGroq({
	model: 'llama-3.3-70b-versatile',
	temperature: 0.3,
	apiKey: process.env.GROQ_API_KEY,
});

export async function analyzeWithAI(memberInfo, researchData) {
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

		const chain = prompt.pipe(groq);
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
