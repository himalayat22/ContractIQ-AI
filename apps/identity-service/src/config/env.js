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
    port: Number(process.env.IDENTITY_SERVICE_PORT ?? 4001),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    mongoUri: normalizeEnvString(process.env.MONGODB_URI),
    mongoDbName: normalizeEnvString(process.env.MONGODB_DB_IDENTITY) ?? 'contractiq_identity',
    jwtSecret: normalizeEnvString(process.env.JWT_SECRET),
  };
}
