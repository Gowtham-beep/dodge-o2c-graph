import { getGraph } from '../graph/buildGraph.js';
import { handleChat } from '../llm/chat.js';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

let graphCache = {
    data: null,
    timestamp: 0
};

export default async function apiRoutes(fastify, options) {
    fastify.get('/api/graph', async (request, reply) => {
        const now = Date.now();
        // 5 minutes = 5 * 60 * 1000 = 300000 ms
        if (graphCache.data && (now - graphCache.timestamp < 300000)) {
            return graphCache.data;
        }

        const client = await pool.connect();
        try {
            const data = await getGraph(client);
            graphCache = {
                data,
                timestamp: now
            };
            return data;
        } finally {
            client.release();
        }
    });

    fastify.post('/api/chat', async (request, reply) => {
        const { message, history } = request.body || {};
        if (!message || message.trim() === '') {
            reply.code(400);
            return { error: "Message is required" };
        }

        const client = await pool.connect();
        try {
            const result = await handleChat(message, history || [], client);
            return result;
        } finally {
            client.release();
        }
    });
}
