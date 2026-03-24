const Fastify = require('fastify');
const cors = require('@fastify/cors');
require('dotenv').config();

const fastify = Fastify({
    logger: true
});

fastify.register(cors, {
    origin: '*'
});

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

start();
