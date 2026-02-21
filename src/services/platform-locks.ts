import { supabase } from '../lib/supabase';

export type LockEntityType =
  | 'weekly_reports'
  | 'submissions'
  | 'evaluations'
  | 'grades'
  | 'announcements'
  | 'milestones'
  | 'presentations'
  | 'important_files'
  | 'groups'
  | 'all';

export interface PlatformLock {
  id: string;
  entityType: LockEntityType;
  entityId: string | null;
  isLocked: boolean;
  lockedBy: string | null;
  lockedByName?: string | null;
  lockedAt: string | null;
  unlockedBy: string | null;
  unlockedAt: string | null;
  reason: string | null;
  updatedAt: string | null;
}

function mapDbLock(data: any): PlatformLock {
  return {
    id: data.id,
    entityType: data.entity_type as LockEntityType,
    entityId: data.entity_id ?? null,
    isLocked: data.is_locked,
    lockedBy: data.locked_by ?? null,
    lockedByName: data.locker?.name ?? null,
    lockedAt: data.locked_at ?? null,
    unlockedBy: data.unlocked_by ?? null,
    unlockedAt: data.unlocked_at ?? null,
    reason: data.reason ?? null,
    updatedAt: data.updated_at ?? null,
  };
}

const LOCK_SELECT = `*, locker:profiles!locked_by(name)`;

/** Fetch all platform lock records. Used by Admin Lock Manager. */
export async function getAllLocks(): Promise<PlatformLock[]> {
  const { data, error } = await supabase
    .from('platform_locks')
    .select(LOCK_SELECT)
    .order('entity_type');

  if (error) throw error;
  return (data || []).map(mapDbLock);
}

/**
 * Check if an entity type is currently locked.
 * Returns true if the specific entity_type lock OR the global 'all' lock is active.
 */
export async function isEntityLocked(
  entityType: LockEntityType,
  entityId?: string
): Promise<boolean> {
  // Check global lock
  const { data: globalLock } = await supabase
    .from('platform_locks')
    .select('is_locked')
    .eq('entity_type', 'all')
    .is('entity_id', null)
    .maybeSingle();

  if (globalLock?.is_locked) return true;

  // Check type-wide lock (entity_id IS NULL)
  const { data: typeLock } = await supabase
    .from('platform_locks')
    .select('is_locked')
    .eq('entity_type', entityType)
    .is('entity_id', null)
    .maybeSingle();

  if (typeLock?.is_locked) return true;

  // Check specific entity lock if entityId provided
  if (entityId) {
    const { data: entityLock } = await supabase
      .from('platform_locks')
      .select('is_locked')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .maybeSingle();

    if (entityLock?.is_locked) return true;
  }

  return false;
}

/** Fetch the active lock record for a given entity type (type-wide lock). */
export async function getLockForType(entityType: LockEntityType): Promise<PlatformLock | null> {
  const { data } = await supabase
    .from('platform_locks')
    .select(LOCK_SELECT)
    .eq('entity_type', entityType)
    .is('entity_id', null)
    .maybeSingle();

  return data ? mapDbLock(data) : null;
}
