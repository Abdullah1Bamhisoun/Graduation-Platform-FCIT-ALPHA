// User roles
export type UserRole = 'student' | 'supervisor' | 'admin';

// Status types
export type SubmissionStatus = 'draft' | 'submitted' | 'under-review' | 'changes-requested' | 'approved';

// User type
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  studentId?: string;
  employeeNumber?: string;
  avatarUrl?: string;
  department?: string;
  gender?: string;
}

// Milestone types
export interface Milestone {
  id: string;
  name: string;
  type: 'weekly-report' | 'chapter' | 'final-report' | 'poster' | 'presentation';
  course: 'CPIS-498' | 'CPIS-499';
  openDate: string;
  dueDate: string;
  status: SubmissionStatus;
  lastAction?: string;
  description?: string;
  rubric?: RubricCriterion[];
}

// Rubric types
export interface RubricCriterion {
  id: string;
  name: string;
  maxScore: number;
  score?: number;
  comment?: string;
}

// Submission types
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
}

export interface SubmissionVersion {
  version: number;
  fileName: string;
  fileSize: string;
  uploadedAt: string;
  notes?: string;
}

export interface Feedback {
  rubric: RubricCriterion[];
  overallComment: string;
  reviewedBy: string;
  reviewedAt: string;
  totalScore: number;
  maxScore: number;
}

// Weekly Report types
export interface WeeklyReport {
  id: string;
  groupId: string;
  weekNumber: number;
  dateRange: string;
  course: 'CPIS-498' | 'CPIS-499';
  allMembersAttended: boolean;
  absentStudentName?: string;
  progressStatus: 'excellent' | 'good' | 'satisfactory' | 'needs-improvement';
  supervisorComments: string;
  submittedAt?: string;
  reviewedBy?: string;
  status: SubmissionStatus;
  supervisorName?: string;
}

// Comment types
export interface Comment {
  id: string;
  author: string;
  authorRole: UserRole;
  content: string;
  timestamp: string;
  avatarUrl?: string;
}

// Grading types (CPIS-498 Assessment)
export interface GroupGrade {
  groupId: string;
  groupName: string;
  course: 'CPIS-498' | 'CPIS-499';
  students: { id: string; name: string }[];
  supervisorName: string;
  
  // Course Deliverables (15 marks) - Managed by Admin (per group)
  deliverables: {
    chapter1: { score?: number; maxScore: 5; status: 'not-submitted' | 'submitted' | 'graded' };
    chapter2: { score?: number; maxScore: 1; status: 'not-submitted' | 'submitted' | 'graded' };
    chapter3: { score?: number; maxScore: 1; status: 'not-submitted' | 'submitted' | 'graded' };
    chapter4: { score?: number; maxScore: 3; status: 'not-submitted' | 'submitted' | 'graded' };
    finalReport: { score?: number; maxScore: 3; status: 'not-submitted' | 'submitted' | 'graded' };
    revisedFinalReport: { score?: number; maxScore: 3; status: 'not-submitted' | 'submitted' | 'graded' };
    presentation: { score?: number; maxScore: 0; status: 'not-submitted' | 'submitted' | 'graded' };
  };
  deliverablesTotal: number; // out of 15
  
  // Weekly Progress Reports (20 marks) - Auto-calculated from weekly reports
  weeklyProgress: {
    score?: number;
    maxScore: 20;
    reportsSubmitted: number;
    totalReports: number;
  };
  
  // Supervisor Assessment (20 marks) - Graded per student in group
  supervisorAssessment: {
    [studentId: string]: {
      score?: number;
      maxScore: 20;
      comment?: string;
      gradedBy?: string;
      gradedAt?: string;
    };
  };
}

// Presentation scheduling for committee evaluation
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

// Student's selected presentation slot
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

export interface StudentGrade {
  studentId: string;
  studentName: string;
  groupId: string;
  course: 'CPIS-498' | 'CPIS-499';
  
  // Supervisor Assessment (20 marks) - Managed by Supervisor (per student)
  supervisorAssessment: {
    score?: number;
    maxScore: 20;
    comment?: string;
    gradedBy?: string;
    gradedAt?: string;
  };
  
  // Evaluation Committee (40 marks) - Other supervisors evaluate (per student)
  committeeEvaluation: {
    score?: number;
    maxScore: 40;
    evaluatorName?: string;
    comment?: string;
    evaluatedAt?: string;
  };
  
  // Peer Feedback (5 marks) - Student peer evaluation
  peerFeedback: {
    score?: number;
    maxScore: 5;
    evaluations?: PeerEvaluation[];
  };
  
  // Group deliverables and weekly (from GroupGrade)
  deliverablesTotal?: number;
  weeklyProgressScore?: number;
  
  // Total
  totalScore: number; // out of 100
  finalGrade?: string; // A+, A, B+, etc.
}

// Notification types
export interface Notification {
  id: string;
  type: 'deadline' | 'feedback' | 'grade' | 'announcement';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

// Announcement types
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

// Admin/Coordinator types
export interface MilestoneConfig {
  id: string;
  name: string;
  course: 'CPIS-498' | 'CPIS-499';
  openDate: string;
  closeDate: string;
  visible: boolean;
  allowLateSubmission: boolean;
  requireJustification: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  context: string;
}

export interface PeerEvaluation {
  evaluatorId: string;
  evaluatorName: string;
  score: number;
  comment?: string;
  submittedAt: string;
}
