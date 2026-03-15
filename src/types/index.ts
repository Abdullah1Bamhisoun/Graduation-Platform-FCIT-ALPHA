// ─── User Roles ──────────────────────────────────────────────────────────────

/** All possible roles a user can hold */
export type UserRole = 'student' | 'supervisor' | 'coordinator' | 'admin';

/** Roles that faculty members can switch between in the header */
export type FacultyActiveRole = 'supervisor' | 'coordinator';

// ─── Status Types ─────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'changes-requested'
  | 'approved';

// ─── Course ───────────────────────────────────────────────────────────────────

export interface Course {
  id: string;
  code: string;   // e.g. 'CPIS-498', 'CPIS-499'
  name: string;   // e.g. 'Graduation Project I'
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserRoleEntry {
  roleId: string;
  roleName: UserRole;
  /** Only set when roleName === 'coordinator' */
  coordinatorCourseId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** Primary role stored in profiles.role (legacy / display) */
  role: UserRole;
  /** All roles from user_roles table (authoritative) */
  roles: UserRole[];
  /** Which role is currently active – drives dashboard & sidebar */
  activeRole: UserRole;
  /** Course UUID this user coordinates (undefined if not a coordinator) */
  coordinatorCourseId?: string;
  studentId?: string;
  employeeNumber?: string;
  avatarUrl?: string;
  department?: string;
  gender?: string;
}

// ─── Milestone ────────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  name: string;
  type: 'weekly-report' | 'chapter' | 'final-report' | 'poster' | 'presentation';
  course: string;   // course code string, e.g. 'CPIS-498'
  openDate: string;
  dueDate: string;
  status: SubmissionStatus;
  lastAction?: string;
  description?: string;
  rubric?: RubricCriterion[];
  allowLateSubmission?: boolean;
}

// ─── Rubric ───────────────────────────────────────────────────────────────────

export interface RubricCriterion {
  id: string;
  name: string;
  maxScore: number;
  score?: number;
  comment?: string;
}

// ─── Submission ───────────────────────────────────────────────────────────────

export interface Submission {
  id: string;
  milestoneId: string;
  milestoneName: string;
  studentId: string;
  studentName: string;
  projectName: string;
  submittedAt: string;
  status: SubmissionStatus;
  versions: SubmissionVersion[];
  currentVersion: number;
  feedback?: Feedback;
  /** The group this submission belongs to */
  groupId?: string;
  /** All members of the group */
  groupMembers?: { id: string; name: string }[];
}

export interface SubmissionVersion {
  version: number;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  notes?: string;
  filePath?: string;
}

export interface Feedback {
  rubric: RubricCriterion[];
  overallComment: string;
  reviewedBy: string;
  reviewedAt: string;
  totalScore: number;
  maxScore: number;
}

// ─── Weekly Report ────────────────────────────────────────────────────────────

export interface WeeklyReport {
  id: string;
  groupId: string;
  weekNumber: number;
  dateRange: string;
  course: string;
  allMembersAttended: boolean;
  absentStudentName?: string;
  progressStatus: 'excellent' | 'good' | 'satisfactory' | 'needs-improvement';
  supervisorComments: string;
  submittedAt?: string;
  reviewedBy?: string;
  status: SubmissionStatus;
  supervisorName?: string;
  // ── Spec fields ──
  studentProgress?: string;
  futureWork?: string;
  discussionPoints?: string;
  submissionStatus: 'not_submitted' | 'submitted';
  supervisorResponseStatus: 'pending' | 'responded';
  studentMark: 0 | 1;
  supervisorMark: 0 | 1;
}

// ─── Week Status ──────────────────────────────────────────────────────────────

export type WeekDisplayStatus = 'Not Opened' | 'Open' | 'Closed' | 'Locked';

export interface WeekStatus {
  id: string;
  department: string;
  courseType: '498' | '499';
  weekNumber: number;
  isOpen: boolean;
  isLocked: boolean;
  wasOpened: boolean;
  semester: string;
  openedAt?: string;
  closedAt?: string;
  lockedAt?: string;
  openedBy?: string;
}

// ─── Grading Schema ───────────────────────────────────────────────────────────

export interface GradingSchema {
  id: string;
  department: string;
  courseType: '498' | '499';
  componentName: string;
  weight: number;
  /** Who grades this component: supervisor | coordinator | committee | student | auto */
  role: string;
  semester: string;
  isActive: boolean;
}

// ─── Grading Component (new rubric system) ────────────────────────────────────

export interface GradingComponentDef {
  id: string;
  courseType: '498' | '499';
  componentKey: string;
  componentName: string;
  totalMarks: number;
  evaluatorRole: string;
  displayOrder: number;
  isActive: boolean;
}

export interface RubricCriterionDef {
  id: string;
  courseType: '498' | '499';
  componentKey: string;
  criterionKey: string;
  criterionName: string;
  maxRawScore: number;
  description1?: string;
  description2?: string;
  description3?: string;
  description4?: string;
  description5?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SupervisorRubricEntry {
  criterionKey: string;
  rawScore: number;   // 1–5
  gradedBy?: string;
  submissionStatus: 'draft' | 'submitted' | 'locked';
}

export interface CommitteeRubricEntry {
  criterionKey: string;
  score: number;      // 0–5
  evaluatorId: string;
  submissionStatus: 'draft' | 'submitted' | 'locked';
}

export interface CoordinatorDeliverableEntry {
  deliverableKey: string;
  score: number;
  maxScore: number;
  isLocked: boolean;
}

// ─── Weekly Grade Summary ─────────────────────────────────────────────────────

export interface WeeklyGradeSummary {
  weeksOpened: number;
  totalRaw: number;         // sum of student_mark + supervisor_mark across opened weeks (uncapped)
  maxRaw: number;           // weeksOpened × 2
  cappedScore: number;      // min(totalRaw, maxWeeklyMarks) — the actual weekly grade
  maxWeeklyMarks: number;   // hard cap: 22 for CPIS-499, 20 for CPIS-498
  normalizedScore: number;  // deprecated alias for cappedScore (backward-compat)
  weight: number;           // from grading schema (22 for 499, 20 for 498)
  weekMarks?: Record<number, { studentMark: number; supervisorMark: number }>;
}

// ─── Late Request ─────────────────────────────────────────────────────────────

export interface LateRequest {
  id: string;
  groupId: string;
  weekNumber: number;
  courseType: '498' | '499';
  department: string;
  semester: string;
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  requestedAt: string;
  requestedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

// ─── Admin Committee Score (CPIS-499 Coordinator 15%) ─────────────────────────

export interface AdminCommitteeScore {
  id: string;
  groupId: string;
  posterDayScore: number;       // 0–5
  implementationScore: number;  // 0–5
  testingScore: number;         // 0–5
  totalScore: number;           // sum ≤ 15
  semester: string;
  gradedBy?: string;
  gradedAt?: string;
}

// ─── Comment ──────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  author: string;
  authorRole: UserRole;
  content: string;
  timestamp: string;
  avatarUrl?: string;
}

// ─── Grading ──────────────────────────────────────────────────────────────────

export interface DeliverableEntry {
  score?: number;
  maxScore: number;
  status: 'not-submitted' | 'submitted' | 'graded';
}

export interface GroupGrade {
  groupId: string;
  groupName: string;
  course: string;
  students: { id: string; name: string }[];
  supervisorName: string;

  /** CPIS-498: keyed by deliverable slug (chapter1, finalReport, etc.).
   *  CPIS-499: always empty — coordinator scores live in admin_committee_scores. */
  deliverables: Record<string, DeliverableEntry>;
  deliverablesTotal: number;

  weeklyProgress: {
    score?: number;
    maxScore: number;    // 22 for CPIS-499, 20 for CPIS-498
    reportsSubmitted: number;
    totalReports: number;
  };

  supervisorAssessment: {
    [studentId: string]: {
      score?: number;
      maxScore: number;    // 23 for CPIS-499, 20 for CPIS-498
      comment?: string;
      gradedBy?: string;
      gradedAt?: string;
    };
  };
}

// ─── Presentation ─────────────────────────────────────────────────────────────

export interface PresentationSchedule {
  groupId: string;
  groupName: string;
  students: { id: string; name: string }[];
  day: string;
  timeSlot: string;
  projectName: string;
  projectDescription: string;
  committeeMembers: string[];
}

export interface StudentPresentationSelection {
  groupId: string;
  groupName: string;
  students: { id: string; name: string }[];
  selectedDay?: string;
  selectedTimeSlot?: string;
  projectName: string;
  projectDescription: string;
  selectedAt?: string;
}

// ─── Student Grade ────────────────────────────────────────────────────────────

export interface StudentGrade {
  studentId: string;
  studentName: string;
  groupId: string;
  course: string;

  supervisorAssessment: {
    score?: number;
    maxScore: number;    // 23 for CPIS-499, 20 for CPIS-498
    comment?: string;
    gradedBy?: string;
    gradedAt?: string;
  };

  committeeEvaluation: {
    score?: number;
    maxScore: 40;
    evaluatorName?: string;
    comment?: string;
    evaluatedAt?: string;
  };

  peerFeedback: {
    score?: number;
    maxScore: 5;
    evaluations?: PeerEvaluation[];
  };

  /** CPIS-498: sum of chapter grades (15 max). */
  deliverablesTotal?: number;
  /** CPIS-499: coordinator Course Deliverables total (poster+impl+testing, 15 max). */
  adminCommitteeTotal?: number;
  weeklyProgressScore?: number;
  totalScore: number;
  finalGrade?: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'deadline' | 'feedback' | 'grade' | 'announcement';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

// ─── Announcement ─────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author: string;
  publishedAt: string;
  expiresAt?: string;
  targetRoles: UserRole[];
  attachments?: string[];
}

// ─── Milestone Config ─────────────────────────────────────────────────────────

export interface MilestoneConfig {
  id: string;
  name: string;
  course: string;
  courseId?: string;
  openDate: string;
  closeDate: string;
  visible: boolean;
  allowLateSubmission: boolean;
  requireJustification: boolean;
  description?: string;
  /** Grading criterion linked from Grade Scheme Editor (coordinator_deliverables) */
  gradingCriterionId?: string;
  gradingCriterionKey?: string;
  gradingCriterionName?: string;
  gradingCriterionMax?: number;
  /** When true, this milestone appears in Committee Evaluation for file review + feedback */
  includeInCommitteeEval?: boolean;
  /**
   * Restrict uploaded file type. Undefined / empty string = any format.
   * Example values: 'pdf', 'docx', 'pptx', 'zip', 'xlsx'
   */
  allowedFileType?: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  context: string;
}

// ─── Peer Evaluation ──────────────────────────────────────────────────────────

export interface PeerEvaluation {
  evaluatorId: string;
  evaluatorName: string;
  score: number;
  comment?: string;
  submittedAt: string;
}

// ─── Role Switch Log ──────────────────────────────────────────────────────────

export interface RoleSwitchLog {
  id: string;
  userId: string;
  fromRole: UserRole;
  toRole: UserRole;
  switchedAt: string;
}

// ─── Approval Record ──────────────────────────────────────────────────────────

export interface ApprovalRecord {
  id: string;
  userId: string;
  approvedBy: string;
  approvedRole: UserRole;
  courseScope?: string;
  timestamp: string;
}
