import { loadEnv, getConfig } from './config/env.js';
import { connectMongo, disconnectMongo } from './infrastructure/mongodb/connect.js';
import { createApp } from './app.js';
import { createNotificationRuntime } from './workers/index.js';

loadEnv();

async function bootstrap() {
  const config = getConfig();

  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required');
  }

  await connectMongo({
    uri: config.mongoUri,
    dbName: config.mongoDbName,
  });
  console.log(`[notification-service] MongoDB connected (${config.mongoDbName})`);

  const runtime = createNotificationRuntime(config);

  if (runtime.worker) {
    console.log(
      `[notification-service] BullMQ worker listening on queue "${config.notificationQueueName}"`,
    );
  }

  const app = createApp({
    internalNotificationController: runtime.internalNotificationController,
  });

  const server = app.listen(config.port, () => {
    console.log(`[notification-service] Listening on http://localhost:${config.port}`);
    console.log(`[notification-service] Health: http://localhost:${config.port}/api/v1/health`);
  });

  const shutdown = async (signal) => {
    console.log(`[notification-service] ${signal} — shutting down`);
    server.close(async () => {
      await runtime.close();
      await disconnectMongo();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[notification-service] Failed to start:', error);
  process.exit(1);
});
