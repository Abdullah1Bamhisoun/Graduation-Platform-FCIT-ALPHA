import { supabase } from '../lib/supabase';
import type { AuditLogEntry } from '../types';

function mapDbAuditEntry(data: any): AuditLogEntry {
  const actorName = data.actor?.name ?? 'System';
  const actorId = data.actor?.student_id || data.actor?.employee_number;
  return {
    id: data.id,
    timestamp: data.timestamp,
    actor: actorId ? `${actorName} (${actorId})` : actorName,
    action: data.action,
    entity: data.entity,
    context: typeof data.context === 'object' ? JSON.stringify(data.context) : (data.context ?? ''),
  };
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*, actor:profiles!actor_id(name, student_id, employee_number)')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbAuditEntry);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return [];
  }
}

export async function createAuditEntry(
  actorId: string,
  action: string,
  entity: string,
  context: string
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert({
    actor_id: actorId,
    action,
    entity,
    context,
  });

  if (error) {
    console.error('Error creating audit entry:', error);
  }
}
