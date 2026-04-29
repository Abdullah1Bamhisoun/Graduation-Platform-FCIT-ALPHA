const Redis = require('ioredis');
const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./env');

const REDIS_CONFIG = {
  host:     REDIS_HOST     || 'localhost',
  port:     REDIS_PORT     || 6379,
  password: REDIS_PASSWORD || undefined,
  lazyConnect: true,
};

// ── Cache client (used by cache.js) ──────────────────────────────────────────
// maxRetriesPerRequest: 1 — fails fast so cache misses don't slow requests down
// retryStrategy: gives up after 5 attempts so logs aren't spammed when Redis
//   is unreachable (server keeps running without cache)
let cacheClient = null;
let isConnected = false;
let gaveUpReconnecting = false;

function getRedisClient() {
  if (cacheClient) return cacheClient;

  cacheClient = new Redis({
    ...REDIS_CONFIG,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 5) {
        if (!gaveUpReconnecting) {
          console.warn('[Redis] Giving up after 5 reconnect attempts — caching disabled');
          gaveUpReconnecting = true;
        }
        return null; // stop retrying
      }
      return Math.min(times * 500, 3000);
    },
    reconnectOnError: () => false,
  });

  cacheClient.on('connect', () => {
    isConnected = true;
    gaveUpReconnecting = false;
    console.log('[Redis] Connected');
  });

  cacheClient.on('error', (err) => {
    if (isConnected) {
      console.warn('[Redis] Connection error — caching disabled:', err.message);
    }
    isConnected = false;
  });

  cacheClient.on('close', () => { isConnected = false; });

  cacheClient.connect().catch(() => {
    // Redis is optional — server continues without it
  });

  return cacheClient;
}

// ── BullMQ client factory ─────────────────────────────────────────────────────
// BullMQ requires maxRetriesPerRequest: null on every connection it owns.
// Each call returns a NEW instance — BullMQ manages the lifecycle itself.
// retryStrategy gives up after 5 attempts so logs aren't spammed when Redis
// is unreachable. The queue.service falls back to direct email send.
function createBullMQConnection() {
  const client = new Redis({
    ...REDIS_CONFIG,
    maxRetriesPerRequest: null,   // required by BullMQ
    enableOfflineQueue: true,
    retryStrategy: (times) => {
      if (times > 5) return null;
      return Math.min(times * 500, 3000);
    },
    reconnectOnError: () => false,
  });
  // Swallow connection errors — handled by isRedisReady() fallback
  client.on('error', () => {});
  return client;
}

function isRedisReady() {
  return isConnected && cacheClient?.status === 'ready';
}

module.exports = { getRedisClient, createBullMQConnection, isRedisReady };
