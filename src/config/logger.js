export const log = {
	info: (msg, ...args) => console.log(`[INFO] ${msg}`, ...args),
	error: (msg, ...args) => console.log(`[ERROR] ${msg}`, ...args),
	debug: (msg, ...args) =>
		process.env.NODE_ENV === 'development' &&
		console.debug(`[DEBUG] ${msg}`, ...args),
};
