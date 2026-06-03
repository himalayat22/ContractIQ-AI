import { loadEnv, getConfig } from './config/env.js';
import { connectMongo, disconnectMongo } from './infrastructure/mongodb/connect.js';
import { createApp } from './app.js';
import { createContractRuntime } from './workers/index.js';

loadEnv();

async function bootstrap() {
  const config = getConfig();

  await connectMongo({
    uri: config.mongoUri,
    dbName: config.mongoDbName,
  });

  console.log(`[contract-service] MongoDB connected (${config.mongoDbName})`);

  const runtime = createContractRuntime(config);

  if (runtime.ingestionWorker) {
    console.log(
      `[contract-service] Ingestion worker listening on queue "${config.ingestionQueueName}"`,
    );
  }
  if (runtime.analysisCompleteWorker) {
    console.log(
      `[contract-service] Analysis-complete worker listening on queue "${config.analysisCompleteQueueName}"`,
    );
  }

  const app = createApp({ contractService: runtime.contractService });
  const server = app.listen(config.port, () => {
    console.log(`[contract-service] Listening on http://localhost:${config.port}`);
    console.log(`[contract-service] Health: http://localhost:${config.port}/api/v1/health`);
  });

  const shutdown = async (signal) => {
    console.log(`[contract-service] ${signal} — shutting down`);
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
  console.error('[contract-service] Failed to start:', error);
  process.exit(1);
});
