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
type CourseCode = 'CPIS-498' | 'CPIS-499';

const courseCodeMap: Record<string, CourseCode> = {
  CPIS_498: 'CPIS-498',
  CPIS_499: 'CPIS-499',
};

const courseCodeReverseMap: Record<string, string> = {
  'CPIS-498': 'CPIS_498',
  'CPIS-499': 'CPIS_499',
};

export function mapCourseCode(dbVal: string): CourseCode {
  return courseCodeMap[dbVal] ?? (dbVal as CourseCode);
}

export function toDbCourseCode(val: string): string {
  return courseCodeReverseMap[val] ?? val;
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
