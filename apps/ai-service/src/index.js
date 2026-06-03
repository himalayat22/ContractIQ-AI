import { loadEnv, getConfig } from './config/env.js';
import { connectMongo, disconnectMongo } from './infrastructure/mongodb/connect.js';
import { createApp } from './app.js';
import { createAiRuntime } from './workers/index.js';

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

  console.log(`[ai-service] MongoDB connected (${config.mongoDbName})`);
  console.log(`[ai-service] Gemini model: ${config.geminiModel}`);

  const runtime = createAiRuntime(config);

  if (runtime.analysisWorker) {
    console.log(`[ai-service] Analysis worker listening on queue "${config.aiAnalyzeQueueName}"`);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[ai-service] Listening on http://localhost:${config.port}`);
    console.log(`[ai-service] Health: http://localhost:${config.port}/api/v1/health`);
  });

  const shutdown = async (signal) => {
    console.log(`[ai-service] ${signal} — shutting down`);
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
  console.error('[ai-service] Failed to start:', error);
  process.exit(1);
});
