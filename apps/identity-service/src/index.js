import { loadEnv, getConfig } from './config/env.js';
import { connectMongo, disconnectMongo } from './infrastructure/mongodb/connect.js';
import { createApp } from './app.js';

loadEnv();

async function bootstrap() {
  const config = getConfig();

  if (!config.jwtSecret) {
    console.warn('[identity-service] Warning: JWT_SECRET is not set');
  }

  await connectMongo({
    uri: config.mongoUri,
    dbName: config.mongoDbName,
  });

  console.log(`[identity-service] MongoDB connected (${config.mongoDbName})`);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[identity-service] Listening on http://localhost:${config.port}`);
    console.log(`[identity-service] Health: http://localhost:${config.port}/api/v1/health`);
  });

  const shutdown = async (signal) => {
    console.log(`[identity-service] ${signal} — shutting down`);
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[identity-service] Failed to start:', error);
  process.exit(1);
});
