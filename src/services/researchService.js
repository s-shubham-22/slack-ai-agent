import axios from 'axios';
import { log } from '../config/logger.js';
import { isPersonalEmail } from '../utils/helpers.js';

export async function doBasicResearch(memberInfo) {
	const results = [];

	try {
		if (memberInfo.email && !isPersonalEmail(memberInfo.email)) {
			const domain = memberInfo.email.split('@')[1];
			const companyInfo = await getCompanyInfo(domain);

			if (companyInfo) {
				results.push(companyInfo);
			}

			if (memberInfo.name) {
				const githubInfo = await getGitHubInfo(memberInfo.name);
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

export async function getCompanyInfo(domain) {
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

export async function getGitHubInfo(username) {
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
