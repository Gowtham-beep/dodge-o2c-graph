process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';

dotenv.config();

const fastify = Fastify({
    logger: true
});

fastify.register(cors, {
    origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://dodge-o2c-graph.vercel.app',
        /\.vercel\.app$/
    ],
    methods: ['GET', 'POST', 'OPTIONS']
});

fastify.register(apiRoutes);

fastify.get('/health', async (request, reply) => {
    return { status: 'ok', time: new Date().toISOString() };
});

const start = async () => {
    try {
        const port = process.env.PORT || 3001;
        await fastify.listen({ port: port, host: '0.0.0.0' });
        console.log(`Server listening on port ${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Keep-alive for Render free tier
const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_URL) {
    setInterval(async () => {
        try {
            await fetch(`${RENDER_URL}/health`);
            console.log('Keep-alive ping sent');
        } catch (err) {
            console.error('Keep-alive ping failed:', err.message);
        }
    }, 14 * 60 * 1000); // 14 mins
}

start();
