export function isPersonalEmail(email) {
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

export function getColorForScore(score) {
	if (score >= 80) return '#36a64f';
	if (score >= 60) return '#ffb84d';
	if (score >= 40) return '#ff9500';
	return '#ff4444';
}
