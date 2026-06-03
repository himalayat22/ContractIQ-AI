import Redis from 'ioredis';

/** @type {Redis | null} */
let sharedConnection = null;

/**
 * BullMQ requires `maxRetriesPerRequest: null` on ioredis connections.
 */
export function createRedisConnection(redisUrl) {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export function getSharedRedisConnection(redisUrl) {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection(redisUrl);
  }
  return sharedConnection;
}

export function getRedisStatus() {
  if (!sharedConnection) {
    return 'down';
  }
  return sharedConnection.status === 'ready' ? 'up' : 'down';
}

export async function closeRedisConnections() {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
