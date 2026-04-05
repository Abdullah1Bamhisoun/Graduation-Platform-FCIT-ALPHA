'use strict';

/**
 * Redis cache utility.
 *
 * All functions degrade gracefully — if Redis is unavailable the caller
 * receives null from get() and set()/del() become no-ops, so the server
 * continues to work without caching.
 *
 * TTL constants (seconds):
 *   AUTH_TTL     — user profile + roles cached per token  (60 s)
 *   SHORT_TTL    — frequently-read, occasionally-mutated data (60 s)
 *   MEDIUM_TTL   — semi-static data (2 min)
 *   LONG_TTL     — rarely-changing data like courses/grading scheme (5 min)
 */

const { getRedisClient, isRedisReady } = require('../config/redis');

const TTL = {
  AUTH:   60,
  SHORT:  60,
  MEDIUM: 120,
  LONG:   300,
};

/**
 * Get a cached value.
 * @returns {Promise<any|null>} parsed value or null on miss / Redis down
 */
async function cacheGet(key) {
  if (!isRedisReady()) return null;
  try {
    const raw = await getRedisClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Store a value in cache.
 * @param {string} key
 * @param {any} value  — must be JSON-serialisable
 * @param {number} ttl — seconds
 */
async function cacheSet(key, value, ttl = TTL.SHORT) {
  if (!isRedisReady()) return;
  try {
    await getRedisClient().set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    // non-fatal
  }
}

/**
 * Delete one or more exact cache keys.
 * @param {...string} keys
 */
async function cacheDel(...keys) {
  if (!isRedisReady() || keys.length === 0) return;
  try {
    await getRedisClient().del(...keys);
  } catch {
    // non-fatal
  }
}

/**
 * Delete all keys matching a glob pattern.
 * Uses SCAN to avoid blocking the Redis event loop.
 * @param {string} pattern  e.g. "announcements:*"
 */
async function cacheDelPattern(pattern) {
  if (!isRedisReady()) return;
  try {
    const redis = getRedisClient();
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {
    // non-fatal
  }
}

module.exports = { cacheGet, cacheSet, cacheDel, cacheDelPattern, TTL };
