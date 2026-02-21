import { supabase } from '../lib/supabase';
import type { AdminCommitteeScore } from '../types';

function mapRow(row: any): AdminCommitteeScore {
  const poster  = Number(row.poster_day_score ?? 0);
  const impl    = Number(row.implementation_score ?? 0);
  const testing = Number(row.testing_score ?? 0);
  return {
    id:                  row.id,
    groupId:             row.group_id,
    posterDayScore:      poster,
    implementationScore: impl,
    testingScore:        testing,
    totalScore:          poster + impl + testing,
    semester:            row.semester,
    gradedBy:            row.graded_by ?? undefined,
    gradedAt:            row.graded_at ?? undefined,
  };
}

/** Fetch the CPIS-499 coordinator committee score for a group. */
export async function getAdminCommitteeScore(
  groupId: string,
  semester: string
): Promise<AdminCommitteeScore | null> {
  const { data, error } = await supabase
    .from('admin_committee_scores')
    .select('*')
    .eq('group_id', groupId)
    .eq('semester', semester)
    .maybeSingle();

  if (error) throw error;
  return data ? mapRow(data) : null;
}

/** Fetch all admin committee scores for a semester (coordinator/admin view). */
export async function getAllAdminCommitteeScores(
  semester: string
): Promise<AdminCommitteeScore[]> {
  const { data, error } = await supabase
    .from('admin_committee_scores')
    .select('*')
    .eq('semester', semester)
    .order('graded_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

/**
 * Coordinator upserts committee scores for a group.
 * Validates total ≤ 15 before saving.
 */
export async function upsertAdminCommitteeScore(params: {
  groupId: string;
  semester: string;
  posterDayScore: number;
  implementationScore: number;
  testingScore: number;
  gradedBy: string;
}): Promise<void> {
  const total = params.posterDayScore + params.implementationScore + params.testingScore;
  if (total > 15) {
    throw new Error(`Total committee score (${total}) exceeds maximum of 15.`);
  }
  if (params.posterDayScore < 0 || params.posterDayScore > 5) {
    throw new Error('Poster Day score must be between 0 and 5.');
  }
  if (params.implementationScore < 0 || params.implementationScore > 5) {
    throw new Error('Implementation score must be between 0 and 5.');
  }
  if (params.testingScore < 0 || params.testingScore > 5) {
    throw new Error('Testing score must be between 0 and 5.');
  }

  const { error } = await supabase
    .from('admin_committee_scores')
    .upsert(
      {
        group_id:             params.groupId,
        semester:             params.semester,
        poster_day_score:     params.posterDayScore,
        implementation_score: params.implementationScore,
        testing_score:        params.testingScore,
        graded_by:            params.gradedBy,
        graded_at:            new Date().toISOString(),
      },
      { onConflict: 'group_id,semester' }
    );

  if (error) throw error;
}
