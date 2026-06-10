import { startServer } from './server.js';

const port = Number(process.env.WS_PORT || 8081);
const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';

startServer({ port, allowedOrigins });
