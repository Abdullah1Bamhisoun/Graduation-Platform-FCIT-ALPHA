const { supabaseAdmin } = require('../config/supabase');

const VALID_ENTITY_TYPES = [
  'weekly_reports',
  'submissions',
  'evaluations',
  'grades',
  'announcements',
  'milestones',
  'presentations',
  'important_files',
  'groups',
  'all',
];

/**
 * GET /api/locks
 * Returns all platform lock records.
 * Accessible by admin only.
 */
async function getLocks(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_locks')
      .select('*, locker:profiles!locked_by(name)')
      .order('entity_type');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('getLocks error:', err);
    res.status(500).json({ error: 'Failed to fetch locks' });
  }
}

/**
 * POST /api/locks
 * Body: { entityType, entityId?, isLocked, reason? }
 * Upserts (creates or updates) a lock record. Admin only.
 */
async function setLock(req, res) {
  try {
    const { entityType, entityId = null, isLocked, reason } = req.body;

    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ error: `Invalid entityType. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` });
    }

    if (typeof isLocked !== 'boolean') {
      return res.status(400).json({ error: 'isLocked must be a boolean' });
    }

    const now = new Date().toISOString();

    // Build the record to upsert
    const record = {
      entity_type: entityType,
      entity_id: entityId || null,
      is_locked: isLocked,
      reason: reason || null,
      updated_at: now,
    };

    if (isLocked) {
      record.locked_by = req.user.id;
      record.locked_at = now;
      record.unlocked_by = null;
      record.unlocked_at = null;
    } else {
      record.unlocked_by = req.user.id;
      record.unlocked_at = now;
    }

    // Upsert using entity_type + entity_id as the unique key
    const { data, error } = await supabaseAdmin
      .from('platform_locks')
      .upsert(record, {
        onConflict: 'entity_type,entity_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) throw error;

    const action = isLocked ? 'locked' : 'unlocked';
    res.json({ success: true, message: `Module "${entityType}" has been ${action}.`, lock: data });
  } catch (err) {
    console.error('setLock error:', err);
    res.status(500).json({ error: 'Failed to update lock state' });
  }
}

/**
 * DELETE /api/locks/:entityType
 * Removes the lock record entirely (equivalent to unlocking).
 * Admin only.
 */
async function removeLock(req, res) {
  try {
    const { entityType } = req.params;

    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entityType' });
    }

    const { error } = await supabaseAdmin
      .from('platform_locks')
      .delete()
      .eq('entity_type', entityType)
      .is('entity_id', null);

    if (error) throw error;
    res.json({ success: true, message: `Lock removed for "${entityType}"` });
  } catch (err) {
    console.error('removeLock error:', err);
    res.status(500).json({ error: 'Failed to remove lock' });
  }
}

module.exports = { getLocks, setLock, removeLock };
