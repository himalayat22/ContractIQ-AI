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
  if (value == null || value === '') {
    return undefined;
  }

  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function getConfig() {
  return {
    port: Number(process.env.NOTIFICATION_SERVICE_PORT ?? 4004),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mongoUri: normalizeEnvString(process.env.MONGODB_URI),
    mongoDbName:
      normalizeEnvString(process.env.MONGODB_DB_NOTIFICATION) ?? 'contractiq_notification',
    redisUrl: normalizeEnvString(process.env.REDIS_URL) ?? 'redis://localhost:6379',
    notificationQueueName:
      normalizeEnvString(process.env.BULL_QUEUE_NOTIFICATION_SEND) ?? 'notification.send',
    internalApiKey: normalizeEnvString(process.env.INTERNAL_API_KEY),
    smtp: {
      host: normalizeEnvString(process.env.SMTP_HOST) ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      user: normalizeEnvString(process.env.SMTP_USER),
      pass: normalizeEnvString(process.env.SMTP_PASS),
    },
    emailFrom: normalizeEnvString(process.env.EMAIL_FROM) ?? 'noreply@contractiq.local',
    emailFromName: normalizeEnvString(process.env.EMAIL_FROM_NAME) ?? 'ContractIQ AI',
    webUrl: normalizeEnvString(process.env.WEB_URL) ?? 'http://localhost:5173',
    runWorker: process.env.NOTIFICATION_RUN_WORKER !== 'false',
  };
}
