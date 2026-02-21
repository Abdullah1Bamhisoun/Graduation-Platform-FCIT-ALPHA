import type { SubmissionStatus } from '../types';

// --- Submission Status ---
const submissionStatusMap: Record<string, SubmissionStatus> = {
  draft: 'draft',
  submitted: 'submitted',
  under_review: 'under-review',
  changes_requested: 'changes-requested',
  approved: 'approved',
};

const submissionStatusReverseMap: Record<string, string> = {
  draft: 'draft',
  submitted: 'submitted',
  'under-review': 'under_review',
  'changes-requested': 'changes_requested',
  approved: 'approved',
};

export function mapSubmissionStatus(dbVal: string): SubmissionStatus {
  return submissionStatusMap[dbVal] ?? (dbVal as SubmissionStatus);
}

export function toDbSubmissionStatus(val: SubmissionStatus): string {
  return submissionStatusReverseMap[val] ?? val;
}

// --- Milestone Type ---
type MilestoneType = 'weekly-report' | 'chapter' | 'final-report' | 'poster' | 'presentation';

const milestoneTypeMap: Record<string, MilestoneType> = {
  weekly_report: 'weekly-report',
  chapter: 'chapter',
  final_report: 'final-report',
  poster: 'poster',
  presentation: 'presentation',
};

const milestoneTypeReverseMap: Record<string, string> = {
  'weekly-report': 'weekly_report',
  chapter: 'chapter',
  'final-report': 'final_report',
  poster: 'poster',
  presentation: 'presentation',
};

export function mapMilestoneType(dbVal: string): MilestoneType {
  return milestoneTypeMap[dbVal] ?? (dbVal as MilestoneType);
}

export function toDbMilestoneType(val: string): string {
  return milestoneTypeReverseMap[val] ?? val;
}

// --- Course Code ---
// DB now stores hyphen format (CPIS-498) after migration.
// Legacy underscore values (CPIS_498) are also handled for backward compatibility.

const courseCodeMap: Record<string, string> = {
  // Legacy underscore format → hyphen format
  CPIS_498: 'CPIS-498',
  CPIS_499: 'CPIS-499',
  // New hyphen format passes through unchanged
  'CPIS-498': 'CPIS-498',
  'CPIS-499': 'CPIS-499',
};

// DB now stores hyphens natively — no conversion needed for writes
export function mapCourseCode(dbVal: string): string {
  return courseCodeMap[dbVal] ?? dbVal;
}

export function toDbCourseCode(val: string): string {
  // DB uses hyphen format; pass through as-is (no underscore conversion needed)
  return val;
}

// --- Progress Status ---
type ProgressStatus = 'excellent' | 'good' | 'satisfactory' | 'needs-improvement';

const progressStatusMap: Record<string, ProgressStatus> = {
  excellent: 'excellent',
  good: 'good',
  satisfactory: 'satisfactory',
  needs_improvement: 'needs-improvement',
};

const progressStatusReverseMap: Record<string, string> = {
  excellent: 'excellent',
  good: 'good',
  satisfactory: 'satisfactory',
  'needs-improvement': 'needs_improvement',
};

export function mapProgressStatus(dbVal: string): ProgressStatus {
  return progressStatusMap[dbVal] ?? (dbVal as ProgressStatus);
}

export function toDbProgressStatus(val: string): string {
  return progressStatusReverseMap[val] ?? val;
}

// --- Deliverable Status ---
type DeliverableStatus = 'not-submitted' | 'submitted' | 'graded';

const deliverableStatusMap: Record<string, DeliverableStatus> = {
  not_submitted: 'not-submitted',
  submitted: 'submitted',
  graded: 'graded',
};

export function mapDeliverableStatus(dbVal: string): DeliverableStatus {
  return deliverableStatusMap[dbVal] ?? (dbVal as DeliverableStatus);
}

export function toDbDeliverableStatus(val: string): string {
  if (val === 'not-submitted') return 'not_submitted';
  return val;
}
