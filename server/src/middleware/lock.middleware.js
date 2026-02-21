const { supabaseAdmin } = require('../config/supabase');

/**
 * Returns an Express middleware that rejects the request (HTTP 423) if the
 * given module is locked by Admin or if the global platform lock is active.
 *
 * Usage:
 *   router.post('/', authenticate, checkLocked('weekly_reports'), handler);
 *
 * @param {string} entityType  One of the LockEntityType values.
 */
function checkLocked(entityType) {
  return async (req, res, next) => {
    try {
      // Admins always bypass locks — they have full override authority
      if (req.user && req.user.roles && req.user.roles.includes('admin')) {
        return next();
      }

      // 1. Check global platform lock
      const { data: globalLock } = await supabaseAdmin
        .from('platform_locks')
        .select('is_locked')
        .eq('entity_type', 'all')
        .is('entity_id', null)
        .maybeSingle();

      if (globalLock?.is_locked) {
        return res.status(423).json({
          error: 'Platform is currently locked by Admin. No changes are allowed.',
        });
      }

      // 2. Check type-wide lock for this module
      const { data: typeLock } = await supabaseAdmin
        .from('platform_locks')
        .select('is_locked')
        .eq('entity_type', entityType)
        .is('entity_id', null)
        .maybeSingle();

      if (typeLock?.is_locked) {
        return res.status(423).json({
          error: `The "${entityType}" module is currently locked by Admin.`,
        });
      }

      next();
    } catch (err) {
      console.error('Lock middleware error:', err);
      // Fail open — don't block requests if the lock check itself errors
      next();
    }
  };
}

module.exports = { checkLocked };
