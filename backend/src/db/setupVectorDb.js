import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function setup() {
    if (!process.env.NEON_DATABASE_URL) {
        console.error('NEON_DATABASE_URL is not set.');
        process.exit(1);
    }
    const pool = new pg.Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
        console.log('Enabling pgvector extension...');
        await client.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

        console.log('Creating product_embeddings table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS product_embeddings (
                id SERIAL PRIMARY KEY,
                material_id TEXT UNIQUE NOT NULL,
                description TEXT,
                embedding vector(384)
            );
        `);
        console.log('Vector DB setup complete.');
    } catch (e) {
        console.error('Error setting up Vector DB:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

setup();
