import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let loaded = false;

export function loadEnv() {
  if (loaded) return;

  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
  dotenv.config();
  loaded = true;
}

function normalizeEnvString(value) {
  if (value == null || value === '') return undefined;
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function getConfig() {
  return {
    port: Number(process.env.CONTRACT_SERVICE_PORT ?? 4002),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mongoUri: normalizeEnvString(process.env.MONGODB_URI),
    mongoDbName: normalizeEnvString(process.env.MONGODB_DB_CONTRACT) ?? 'contractiq_contract',
    uploadDir: normalizeEnvString(process.env.CONTRACT_UPLOAD_DIR),
    redisUrl: normalizeEnvString(process.env.REDIS_URL) ?? 'redis://localhost:6379',
    ingestionQueueName:
      normalizeEnvString(process.env.BULL_QUEUE_INGESTION_EXTRACT) ?? 'ingestion.extract',
    aiAnalyzeQueueName: normalizeEnvString(process.env.BULL_QUEUE_AI_ANALYZE) ?? 'ai.analyze',
    analysisCompleteQueueName:
      normalizeEnvString(process.env.BULL_QUEUE_ANALYSIS_COMPLETE) ?? 'analysis.complete',
    notificationServiceUrl:
      normalizeEnvString(process.env.NOTIFICATION_SERVICE_URL) ?? 'http://localhost:4004',
    internalApiKey: normalizeEnvString(process.env.INTERNAL_API_KEY),
    runWorker: process.env.CONTRACT_RUN_WORKER !== 'false',
  };
}
