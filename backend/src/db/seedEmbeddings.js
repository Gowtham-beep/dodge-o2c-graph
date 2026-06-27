import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seed() {
    if (!process.env.DATABASE_URL || !process.env.NEON_DATABASE_URL) {
        console.error('Both DATABASE_URL and NEON_DATABASE_URL must be set.');
        process.exit(1);
    }

    const aivenPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const neonPool = new pg.Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const aivenClient = await aivenPool.connect();
    const neonClient = await neonPool.connect();

    try {
        console.log('Loading embedding model...');
        const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

        console.log('Fetching products from Aiven DB...');
        const res = await aivenClient.query(`
            SELECT pd."product" as material_id, pd."productDescription" as description
            FROM product_descriptions pd
            WHERE pd."language" = 'EN'
        `);

        console.log(`Found ${res.rows.length} products. Generating embeddings...`);

        for (const row of res.rows) {
            const { material_id, description } = row;
            if (!description) continue;

            const output = await extractor(description, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data);

            const embeddingStr = '[' + embedding.join(',') + ']';

            await neonClient.query(`
                INSERT INTO product_embeddings (material_id, description, embedding)
                VALUES ($1, $2, $3)
                ON CONFLICT (material_id) DO UPDATE SET
                    description = EXCLUDED.description,
                    embedding = EXCLUDED.embedding
            `, [material_id, description, embeddingStr]);
            
            console.log(`Processed: ${material_id} - ${description}`);
        }

        console.log('Embedding seeding complete.');
    } catch (e) {
        console.error('Error seeding embeddings:', e);
    } finally {
        aivenClient.release();
        neonClient.release();
        await aivenPool.end();
        await neonPool.end();
    }
}

seed();
