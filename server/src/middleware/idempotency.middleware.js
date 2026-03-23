const { supabaseAdmin } = require('../config/supabase');

/**
 * Idempotency middleware — prevents duplicate mutations from retries / double-clicks.
 *
 * Clients send:  Idempotency-Key: <uuid-or-any-unique-string>
 *
 * Behaviour:
 *   1. No header → passes through (idempotency is optional per-route)
 *   2. Header present, key seen before and not expired → replay stored response
 *   3. Header present, key is new → execute handler, store response, return it
 *
 * The key is scoped to (user_id + endpoint path + client key) so two different
 * users with the same string never collide.
 *
 * Requires the idempotency_keys table (see migrations/003_idempotency_keys.sql).
 *
 * Usage:
 *   const { idempotency } = require('../middleware/idempotency.middleware');
 *   router.post('/', authenticate, idempotency(), controller.create);
 *   router.post('/', authenticate, idempotency({ ttlHours: 48 }), controller.create);
 */
function idempotency({ ttlHours = 24 } = {}) {
  return async (req, res, next) => {
    const rawKey = req.headers['idempotency-key'];

    // Header not provided — allow the request through unchanged
    if (!rawKey) return next();

    // Basic key sanitization
    if (typeof rawKey !== 'string' || rawKey.length > 256 || rawKey.trim() === '') {
      return res.status(400).json({ error: 'Idempotency-Key header must be a non-empty string ≤ 256 characters' });
    }

    // req.user is set by authenticate middleware (must run before this)
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required for idempotent requests' });
    }

    const scopedKey = `${req.user.id}:${req.path}:${rawKey.trim()}`;
    const now = new Date().toISOString();

    try {
      // 1. Check for an existing, non-expired response
      const { data: existing, error: lookupError } = await supabaseAdmin
        .from('idempotency_keys')
        .select('status_code, response_body')
        .eq('scoped_key', scopedKey)
        .gt('expires_at', now)
        .maybeSingle();

      if (lookupError) {
        // Table may not exist yet — degrade gracefully and let the request through
        console.warn('[idempotency] lookup failed (table may be missing):', lookupError.message);
        return next();
      }

      if (existing) {
        // Replay the stored response
        return res.status(existing.status_code).json(existing.response_body);
      }

      // 2. Intercept res.json to store the response after the handler runs
      const expiresAt = new Date(Date.now() + ttlHours * 3_600_000).toISOString();
      const originalJson = res.json.bind(res);

      res.json = async function idempotentJson(body) {
        // Store response (best-effort — ignore race conditions on concurrent identical requests)
        const { error: insertError } = await supabaseAdmin
          .from('idempotency_keys')
          .insert({
            scoped_key: scopedKey,
            user_id: req.user.id,
            endpoint: req.path,
            status_code: res.statusCode,
            response_body: body,
            expires_at: expiresAt,
          });

        if (insertError && insertError.code !== '23505') {
          // 23505 = unique_violation (concurrent duplicate) — safe to ignore
          console.warn('[idempotency] insert failed:', insertError.message);
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      // Never block the request due to idempotency infra failure
      console.error('[idempotency] unexpected error:', err.message);
      next();
    }
  };
}

module.exports = { idempotency };
