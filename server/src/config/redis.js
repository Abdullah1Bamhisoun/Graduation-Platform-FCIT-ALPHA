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
let cacheClient = null;
let isConnected = false;

function getRedisClient() {
  if (cacheClient) return cacheClient;

  cacheClient = new Redis({
    ...REDIS_CONFIG,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  cacheClient.on('connect', () => {
    isConnected = true;
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
function createBullMQConnection() {
  return new Redis({
    ...REDIS_CONFIG,
    maxRetriesPerRequest: null,   // required by BullMQ
    enableOfflineQueue: true,
  });
}

function isRedisReady() {
  return isConnected && cacheClient?.status === 'ready';
}

module.exports = { getRedisClient, createBullMQConnection, isRedisReady };
