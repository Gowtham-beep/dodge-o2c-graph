import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import os from 'os';
import { fileURLToPath } from 'url';

const { Client } = pg;

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Configure dotenv
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATA_DIR = path.join(os.homedir(), 'Downloads/sap-order-to-cash-dataset/sap-o2c-data');

const FOLDER_TO_TABLE = {
    'business_partners': 'business_partners',
    'business_partner_addresses': 'business_partner_addresses',
    'customer_company_assignments': 'customer_company_assignments',
    'customer_sales_area_assignments': 'customer_sales_area_assignments',
    'plants': 'plants',
    'products': 'products',
    'product_descriptions': 'product_descriptions',
    'product_plants': 'product_plants',
    'product_storage_locations': 'product_storage_locations',
    'sales_order_headers': 'sales_order_headers',
    'sales_order_items': 'sales_order_items',
    'sales_order_schedule_lines': 'sales_order_schedule_lines',
    'outbound_delivery_headers': 'outbound_delivery_headers',
    'outbound_delivery_items': 'outbound_delivery_items',
    'billing_document_headers': 'billing_document_headers',
    'billing_document_items': 'billing_document_items',
    'billing_document_cancellations': 'billing_document_cancellations',
    'journal_entry_items_accounts_receivable': 'journal_entry_items',
    'payments_accounts_receivable': 'payments'
};

const BATCH_SIZE = 500;

async function runSchema(client) {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running schema.sql...');
    await client.query(schemaSql);
    console.log('Schema created successfully.');
}

async function insertBatch(client, table, columns, batch) {
    if (batch.length === 0) return;

    const placeholders = batch.map((_, i) => {
        const offset = i * columns.length;
        const itemPlaceholders = columns.map((_, j) => `$${offset + j + 1}`).join(', ');
        return `(${itemPlaceholders})`;
    }).join(', ');

    const values = batch.flatMap(row => columns.map(col => row[col]));

    const query = `
    INSERT INTO ${table} (${columns.map(c => `"${c}"`).join(', ')})
    VALUES ${placeholders}
    ON CONFLICT DO NOTHING
  `;

    await client.query(query, values);
}

async function seedTable(client, folderName, tableName) {
    const folderPath = path.join(DATA_DIR, folderName);

    if (!fs.existsSync(folderPath)) {
        console.warn(`Folder not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.jsonl'));

    console.log(`Seeding ${tableName}...`);
    let totalInserted = 0;

    const colRes = await client.query('SELECT column_name FROM information_schema.columns WHERE table_schema = \'public\' AND table_name = $1', [tableName]);
    if (colRes.rows.length === 0) {
        console.warn(`Table ${tableName} does not exist or has no columns.`);
        return;
    }
    const validColumns = colRes.rows.map(r => r.column_name);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let batch = [];

        for await (const line of rl) {
            if (!line.trim()) continue;

            const record = JSON.parse(line);

            batch.push(record);

            if (batch.length >= BATCH_SIZE) {
                await insertBatch(client, tableName, validColumns, batch);
                totalInserted += batch.length;
                batch = [];
            }
        }

        if (batch.length > 0) {
            await insertBatch(client, tableName, validColumns, batch);
            totalInserted += batch.length;
        }
    }

    console.log(`${tableName}: inserted ${totalInserted} rows`);
}

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        await runSchema(client);

        for (const [folderName, tableName] of Object.entries(FOLDER_TO_TABLE)) {
            try {
                await seedTable(client, folderName, tableName);
            } catch (err) {
                console.error(`Error seeding table ${tableName}:`, err.message);
            }
        }

        console.log('Seeding completed.');
    } catch (err) {
        console.error('Fatal error during seeding:', err.message);
    } finally {
        await client.end();
    }
}

main();