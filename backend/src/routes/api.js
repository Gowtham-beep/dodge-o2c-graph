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
            // Check if client expects streaming (could be based on a header or param, but we'll assume streaming if asked)
            // To be completely safe and just do SSE:
            reply.raw.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });

            // Stream tokens
            const { handleChatStream } = await import('../llm/chat.js');
            
            // For now, since `handleChatStream` computes SQL internally, we can't emit SQL *before* the stream starts easily
            // without modifying how handleChatStream yields the SQL. However, we can patch `handleChatStream` internally later.
            // Wait, the prompt instruction said: `data: ${JSON.stringify({ type: 'sql', sql: generatedSql })}`.
            // Let's modify handleChatStream to support a callback for SQL, or just refactor.
            // Oh, the prompt said: 
            // "// First send the SQL immediately when generated
            // reply.raw.write(`data: ${JSON.stringify({ type: 'sql', sql: generatedSql })}\n\n`)"
            
            // To achieve that I need to pass an onSql callback into handleChatStream. 
            // Let's rewrite the call:
            await handleChatStream(
                message, 
                history || [], 
                client,
                (token) => {
                    reply.raw.write(`data: ${JSON.stringify({ 
                        type: 'token', content: token 
                    })}\n\n`);
                },
                (generatedSql) => {
                    reply.raw.write(`data: ${JSON.stringify({ 
                        type: 'sql', sql: generatedSql 
                    })}\n\n`);
                }
            ).then((finalResult) => {
                reply.raw.write(`data: ${JSON.stringify({ 
                    type: 'done', nodeIds: finalResult.nodeIds 
                })}\n\n`);
                reply.raw.end();
            }).catch(e => {
                reply.raw.end();
            });
            // Tell fastify we are handling the response manually
            return reply;
        } finally {
            client.release();
        }
    });
}
