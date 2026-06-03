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

function normalizeEnvInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getConfig() {
  return {
    port: Number(process.env.AI_SERVICE_PORT ?? 4003),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mongoUri: normalizeEnvString(process.env.MONGODB_URI),
    mongoDbName: normalizeEnvString(process.env.MONGODB_DB_AI) ?? 'contractiq_ai',
    geminiApiKey: normalizeEnvString(process.env.GEMINI_API_KEY),
    geminiModel: normalizeEnvString(process.env.GEMINI_MODEL) ?? 'gemini-2.0-flash',
    geminiTimeoutMs: normalizeEnvInt(process.env.GEMINI_TIMEOUT_MS, 120_000),
    geminiMaxRetries: normalizeEnvInt(process.env.GEMINI_MAX_RETRIES, 3),
    geminiRetryBaseDelayMs: normalizeEnvInt(process.env.GEMINI_RETRY_BASE_DELAY_MS, 1_000),
    geminiMaxContractChars: normalizeEnvInt(process.env.GEMINI_MAX_CONTRACT_CHARS, 120_000),
  };
}
