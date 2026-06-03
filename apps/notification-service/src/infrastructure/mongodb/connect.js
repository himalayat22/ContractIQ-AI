import mongoose from 'mongoose';
import { ensureResolvableDns } from './ensureDns.js';

export async function connectMongo({ uri, dbName }) {
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  ensureResolvableDns();

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10_000,
  });

  return mongoose.connection;
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

export function getMongoStatus() {
  const states = {
    0: 'down',
    1: 'up',
    2: 'down',
    3: 'down',
  };
  return states[mongoose.connection.readyState] ?? 'down';
}
