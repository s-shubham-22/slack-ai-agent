import { Pool } from 'pg';
import dotenv from 'dotenv';
import { log } from '../config/logger.js';

dotenv.config();

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: { rejectUnauthorized: false },
	max: 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
	log.info('Database connected successfully');
});
pool.on('error', (err) => {
	log.error('Unexpected database error:', err.message);
});

export default pool;
