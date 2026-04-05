const router = require('express').Router();
const { supabaseAdmin } = require('../config/supabase');
const { isRedisReady } = require('../config/redis');

/**
 * GET /health
 * Lightweight liveness + readiness probe.
 * Returns 200 when healthy, 503 when the database is unreachable.
 * Does NOT require authentication — intended for load-balancers and uptime monitors.
 */
router.get('/', async (req, res) => {
  const status = {
    api:       'ok',
    database:  'unknown',
    cache:     isRedisReady() ? 'ok' : 'unavailable',
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
  };

  try {
    // Cheap query — just checks connectivity; no full table scan
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1);

    status.database = error ? 'degraded' : 'ok';
  } catch {
    status.database = 'unreachable';
  }

  const httpStatus = status.database === 'unreachable' ? 503 : 200;
  res.status(httpStatus).json(status);
});

module.exports = router;
