require('dotenv').config();
const path = require('path');
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const staticPlugin = require('@fastify/static');
const orvcRoutes = require('./routes/orvc');
const ivvcRoutes = require('./routes/ivvc');
const db = require('./db');

const server = Fastify({ logger: true });

server.register(cors, {
  origin: true,
  methods: ['GET', 'HEAD', 'OPTIONS']
});

// Serve built React SPA from ./public (populated during Docker build)
const publicDir = path.join(__dirname, '..', 'public');
server.register(staticPlugin, { root: publicDir, prefix: '/' });

// SPA route: /list/<TABLE>/html/*.html → serve index.html (Vite output)
server.get('/list/:table/html/:file', async (_req, reply) => {
  return reply.sendFile('index.html');
});

server.register(orvcRoutes, { prefix: '/api/v2' });
server.register(ivvcRoutes, { prefix: '/api/v2' });

server.get('/health', async () => ({ ok: true }));

// Runtime config for client — ERP base URL without trailing slash
server.get('/api/config', async () => ({
  erpUrl: (process.env.ERP_URL || '').replace(/\/$/, '')
}));

async function start() {
  try {
    await db.raw('select 1 as ok');
    server.log.info({ dbHost: process.env.DB_HOST, dbName: process.env.DB_NAME }, 'DB connection OK');
  } catch (err) {
    server.log.error({ err }, 'DB connection FAILED');
  }

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await server.listen({ port, host: '0.0.0.0' });
}

start().catch((err) => {
  server.log.error(err);
  process.exit(1);
});
