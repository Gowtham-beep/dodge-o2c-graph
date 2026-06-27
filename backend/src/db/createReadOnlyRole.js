import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function setupReadOnlyRole() {
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is not set.');
        process.exit(1);
    }
    const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    const client = await pool.connect();
    try {
        console.log('Creating read-only role...');
        // Ignore error if role already exists
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'o2c_readonly') THEN
                    CREATE ROLE o2c_readonly WITH LOGIN PASSWORD 'readonly_pass_123';
                END IF;
            END
            $$;
        `);

        // Grant permissions
        await client.query(`GRANT CONNECT ON DATABASE o2c_graph TO o2c_readonly;`);
        await client.query(`GRANT USAGE ON SCHEMA public TO o2c_readonly;`);
        await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public TO o2c_readonly;`);
        await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO o2c_readonly;`);
        
        console.log('Read-only role setup complete.');
        
        // Append to .env if not exists
        const envContent = fs.readFileSync(envPath, 'utf8');
        if (!envContent.includes('DATABASE_URL_READONLY')) {
            const roUrl = 'DATABASE_URL_READONLY="postgresql://o2c_readonly:readonly_pass_123@localhost:5432/o2c_graph"\n';
            fs.appendFileSync(envPath, `\n${roUrl}`);
            console.log('Appended DATABASE_URL_READONLY to .env');
        }
    } catch (e) {
        console.error('Error setting up read-only role:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

setupReadOnlyRole();
