import { User, Milestone, Submission, WeeklyReport, Notification, Announcement, AuditLogEntry, MilestoneConfig, StudentGrade, GroupGrade, PresentationSchedule, StudentPresentationSelection } from './types';

// Current user (can be switched for demo)
export const mockUsers: Record<string, User> = {
  student: {
    id: '2236500',
    name: 'Abdullah Bamhisoun',
    email: 'abdullah.b@stu.kau.edu.sa',
    role: 'student',
    studentId: '2236500',
  },
  supervisor: {
    id: 'sup-001',
    name: 'Dr. Hasan Labani',
    email: 'hlabani@kau.edu.sa',
    role: 'supervisor',
    employeeNumber: '0000482731',
  },
  admin: {
    id: 'admin-001',
    name: 'Dr. Abdulaziz Alsulami',
    email: 'aalsulami@kau.edu.sa',
    role: 'admin',
    employeeNumber: '0000195847',
  },
};

// Milestones
export const mockMilestones: Milestone[] = [
  {
    id: 'wk5',
    name: 'Weekly Report - Week 5',
    type: 'weekly-report',
    course: 'CPIS-498',
    openDate: '2025-02-03',
    dueDate: '2025-02-09',
    status: 'approved',
    lastAction: 'Reviewed by Dr. Hasan Labani',
  },
  {
    id: 'wk9',
    name: 'Weekly Report - Week 9',
    type: 'weekly-report',
    course: 'CPIS-498',
    openDate: '2025-03-03',
    dueDate: '2025-03-09',
    status: 'approved',
    lastAction: 'Reviewed by Dr. Hasan Labani',
  },
  {
    id: 'ch1',
    name: 'Chapter 1 - Introduction',
    type: 'chapter',
    course: 'CPIS-498',
    openDate: '2025-02-10',
    dueDate: '2025-03-10',
    status: 'approved',
    lastAction: 'Reviewed by Dr. Hasan Labani',
    description: 'Submit your project introduction including problem statement, objectives, and scope.',
  },
  {
    id: 'ch2',
    name: 'Chapter 2 - Literature Review',
    type: 'chapter',
    course: 'CPIS-498',
    openDate: '2025-03-11',
    dueDate: '2025-04-15',
    status: 'approved',
    lastAction: 'Reviewed by Dr. Hasan Labani',
  },
  {
    id: 'ch3',
    name: 'Chapter 3 - Methodology',
    type: 'chapter',
    course: 'CPIS-498',
    openDate: '2025-04-16',
    dueDate: '2025-05-20',
    status: 'changes-requested',
    lastAction: 'Reviewed by Dr. Hasan Labani',
    description: 'Describe your research methodology, design approach, and implementation plan.',
  },
  {
    id: 'ch4',
    name: 'Chapter 4 - Implementation',
    type: 'chapter',
    course: 'CPIS-499',
    openDate: '2025-09-01',
    dueDate: '2025-10-15',
    status: 'under-review',
    lastAction: 'Reviewed by Dr. Hasan Labani',
  },
  {
    id: 'final',
    name: 'Final Report',
    type: 'final-report',
    course: 'CPIS-499',
    openDate: '2025-10-20',
    dueDate: '2025-11-10',
    status: 'submitted',
    lastAction: 'Under review by Dr. Hasan Labani',
    description: 'Complete final report including all chapters, results, and conclusions.',
    rubric: [
      { id: 'r1', name: 'Structure & Organization', maxScore: 10 },
      { id: 'r2', name: 'Content Depth & Quality', maxScore: 15 },
      { id: 'r3', name: 'Clarity & Writing Quality', maxScore: 10 },
      { id: 'r4', name: 'References & Citations', maxScore: 5 },
      { id: 'r5', name: 'Originality & Innovation', maxScore: 10 },
    ],
  },
  {
    id: 'poster',
    name: 'Poster Presentation',
    type: 'poster',
    course: 'CPIS-499',
    openDate: '2025-11-11',
    dueDate: '2025-11-20',
    status: 'draft',
    lastAction: 'Not yet submitted',
  },
];

// Submissions
export const mockSubmissions: Submission[] = [
  {
    id: 'sub-ch3',
    milestoneId: 'ch3',
    milestoneName: 'Chapter 3 - Methodology',
    studentId: '2236500',
    studentName: 'Abdullah Bamhisoun',
    projectName: 'Graduation Project Platform',
    submittedAt: '2025-05-18T14:30:00',
    status: 'changes-requested',
    currentVersion: 2,
    versions: [
      {
        version: 1,
        fileName: 'Chapter3_Methodology_v1.pdf',
        fileSize: '2.4 MB',
        uploadedAt: '2025-05-18T14:30:00',
        notes: 'Initial submission',
      },
      {
        version: 2,
        fileName: 'Chapter3_Methodology_v2.pdf',
        fileSize: '2.6 MB',
        uploadedAt: '2025-05-20T10:15:00',
        notes: 'Revised methodology section based on initial feedback',
      },
    ],
    feedback: {
      rubric: [
        { id: 'r1', name: 'Research Design', maxScore: 15, score: 12, comment: 'Good approach, but needs more detail on data collection methods.' },
        { id: 'r2', name: 'Methodology Clarity', maxScore: 10, score: 7, comment: 'Please elaborate on the ML model selection process.' },
        { id: 'r3', name: 'Feasibility', maxScore: 10, score: 9, comment: 'Well-planned implementation timeline.' },
      ],
      overallComment: 'Good progress on methodology. Please address the comments about data collection and model selection. Add more details about your evaluation metrics.',
      reviewedBy: 'Dr Hasan Labani',
      reviewedAt: '2025-05-19T16:45:00',
      totalScore: 28,
      maxScore: 35,
    },
  },
  {
    id: 'sub-ch4',
    milestoneId: 'ch4',
    milestoneName: 'Chapter 4 - Implementation',
    studentId: '2236500',
    studentName: 'Abdullah Bamhisoun',
    projectName: 'Graduation Project Platform',
    submittedAt: '2025-10-14T22:30:00',
    status: 'under-review',
    currentVersion: 1,
    versions: [
      {
        version: 1,
        fileName: 'Chapter4_Implementation.pdf',
        fileSize: '3.8 MB',
        uploadedAt: '2025-10-14T22:30:00',
        notes: 'Complete implementation chapter with code samples and architecture diagrams',
      },
    ],
  },
  {
    id: 'sub-final',
    milestoneId: 'final',
    milestoneName: 'Final Report',
    studentId: '2236500',
    studentName: 'Abdullah Bamhisoun',
    projectName: 'Graduation Project Platform',
    submittedAt: '2025-11-02T20:00:00',
    status: 'submitted',
    currentVersion: 1,
    versions: [
      {
        version: 1,
        fileName: 'FinalReport_SmartParking.pdf',
        fileSize: '5.2 MB',
        uploadedAt: '2025-11-02T20:00:00',
        notes: 'Complete final report with all chapters integrated',
      },
    ],
  },
];

// Weekly Reports
export const mockWeeklyReports: WeeklyReport[] = [
  {
    id: 'wr-1',
    groupId: '13_498_2026_01_M',
    weekNumber: 1,
    dateRange: 'Jan 6 - Jan 12, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'good',
    supervisorComments: 'The group started well with initial project discussion.',
    submittedAt: '2025-01-12T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-2',
    groupId: '13_498_2026_01_M',
    weekNumber: 2,
    dateRange: 'Jan 13 - Jan 19, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'good',
    supervisorComments: 'Good progress on research and initial planning.',
    submittedAt: '2025-01-19T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-3',
    groupId: '13_498_2026_01_M',
    weekNumber: 3,
    dateRange: 'Jan 20 - Jan 26, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'excellent',
    supervisorComments: 'Excellent work on the literature review.',
    submittedAt: '2025-01-26T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-4',
    groupId: '13_498_2026_01_M',
    weekNumber: 4,
    dateRange: 'Jan 27 - Feb 2, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'good',
    supervisorComments: 'Making steady progress on requirements analysis.',
    submittedAt: '2025-02-02T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-5',
    groupId: '13_498_2026_01_M',
    weekNumber: 5,
    dateRange: 'Feb 3 - Feb 9, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'excellent',
    supervisorComments: 'Completed initial requirements gathering and stakeholder interviews. Good progress on system architecture design.',
    submittedAt: '2025-02-09T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-6',
    groupId: '13_498_2026_01_M',
    weekNumber: 6,
    dateRange: 'Feb 10 - Feb 16, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'satisfactory',
    supervisorComments: 'Some delays but the team is working to catch up.',
    submittedAt: '2025-02-16T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-7',
    groupId: '13_498_2026_01_M',
    weekNumber: 7,
    dateRange: 'Feb 17 - Feb 23, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'excellent',
    supervisorComments: 'Excellent progress on the design phase. The team has completed the database schema and UI mockups.',
    submittedAt: '2025-02-23T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-8',
    groupId: '13_498_2026_01_M',
    weekNumber: 8,
    dateRange: 'Feb 24 - Mar 2, 2025',
    course: 'CPIS-498',
    allMembersAttended: false,
    absentStudentName: 'Abdulrahman Solymani',
    progressStatus: 'good',
    supervisorComments: 'Good progress despite one absence. Working on methodology chapter.',
    submittedAt: '2025-03-02T18:00:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
  {
    id: 'wr-9',
    groupId: '13_498_2026_01_M',
    weekNumber: 9,
    dateRange: 'Mar 3 - Mar 9, 2025',
    course: 'CPIS-498',
    allMembersAttended: true,
    progressStatus: 'excellent',
    supervisorComments: 'The students sent me their work on Chapter 4. They are progressing in a good way.',
    submittedAt: '2025-03-09T19:30:00',
    reviewedBy: 'Dr. Hasan Labani',
    supervisorName: 'Dr. Hasan Labani',
    status: 'approved',
  },
];

// Notifications
export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'feedback',
    title: 'Chapter 3 reviewed',
    message: 'Dr. Hasan Labani has reviewed your Chapter 3 submission and requested changes.',
    timestamp: '2025-05-19T16:45:00',
    read: false,
    link: '/student/submissions/ch3',
  },
  {
    id: 'n2',
    type: 'deadline',
    title: 'Upcoming deadline',
    message: 'Final Report is due in 8 days (Nov 10, 2025)',
    timestamp: '2025-11-02T09:00:00',
    read: false,
  },
  {
    id: 'n3',
    type: 'announcement',
    title: 'New announcement',
    message: 'Poster presentation schedule has been published',
    timestamp: '2025-11-01T11:00:00',
    read: true,
  },
];

// Announcements
export const mockAnnouncements: Announcement[] = [
  {
    id: 'ann1',
    title: 'Poster Presentation Schedule Published',
    content: 'The schedule for final poster presentations has been published. Please check the calendar for your assigned time slot. All presentations will be held in Building 51, Hall A.',
    author: 'Dr. Hasan Labani',
    publishedAt: '2025-11-01T11:00:00',
    targetRoles: ['student', 'supervisor'],
  },
  {
    id: 'ann2',
    title: 'Reminder: Final Report Deadline',
    content: 'This is a reminder that the final report deadline is November 10, 2025. Please ensure all chapters are integrated and properly formatted according to the guidelines.',
    author: 'Dr. Hasan Labani',
    publishedAt: '2025-10-28T10:00:00',
    targetRoles: ['student'],
  },
];

// Milestone Configurations
export const mockMilestoneConfigs: MilestoneConfig[] = [
  {
    id: 'cfg-ch1',
    name: 'Chapter 1 - Introduction',
    course: 'CPIS-498',
    openDate: '2025-02-10',
    closeDate: '2025-03-10',
    visible: true,
    allowLateSubmission: true,
    requireJustification: true,
  },
  {
    id: 'cfg-ch2',
    name: 'Chapter 2 - Literature Review',
    course: 'CPIS-498',
    openDate: '2025-03-11',
    closeDate: '2025-04-15',
    visible: true,
    allowLateSubmission: true,
    requireJustification: true,
  },
  {
    id: 'cfg-final',
    name: 'Final Report',
    course: 'CPIS-499',
    openDate: '2025-10-20',
    closeDate: '2025-11-10',
    visible: true,
    allowLateSubmission: false,
    requireJustification: false,
  },
];

// Audit Log
export const mockAuditLog: AuditLogEntry[] = [
  {
    id: 'aud1',
    timestamp: '2025-11-02T20:00:00',
    actor: 'Abdullah Bamhisoun (2236500)',
    action: 'Submitted',
    entity: 'Final Report',
    context: 'Version 1 uploaded',
  },
  {
    id: 'aud2',
    timestamp: '2025-10-28T14:30:00',
    actor: 'Dr. Hasan Labani',
    action: 'Published',
    entity: 'Announcement',
    context: 'Final Report Deadline Reminder',
  },
  {
    id: 'aud3',
    timestamp: '2025-05-19T16:45:00',
    actor: 'Dr. Hasan Labani',
    action: 'Reviewed',
    entity: 'Chapter 3 - Methodology',
    context: 'Changes requested - Score: 28/35',
  },
];

// Group Grades (CPIS-498 Assessment - Deliverables)
export const mockGroupGrades: GroupGrade[] = [
  {
    groupId: '13_498_2026_01_M',
    groupName: 'Group 13 - Graduation Project Platform',
    course: 'CPIS-498',
    students: [
      { id: '2236500', name: 'Abdullah Bamhisoun' },
      { id: '2236501', name: 'Abdulrahman Solymani' },
    ],
    supervisorName: 'Dr. Hasan Labani',
    
    deliverables: {
      chapter1: { score: 5, maxScore: 5, status: 'graded' },
      chapter2: { maxScore: 1, status: 'submitted' },
      chapter3: { maxScore: 0, status: 'submitted' },
      chapter4: { maxScore: 3, status: 'not-submitted' },
      finalReport: { maxScore: 3, status: 'not-submitted' },
      revisedFinalReport: { maxScore: 3, status: 'not-submitted' },
      presentation: { maxScore: 0, status: 'not-submitted' },
    },
    deliverablesTotal: 5,
    
    weeklyProgress: {
      score: 14.4,
      maxScore: 20,
      reportsSubmitted: 8,
      totalReports: 14,
    },
    
    supervisorAssessment: {
      '2236500': {
        maxScore: 20,
        gradedBy: 'Dr. Hasan Labani',
      },
      '2236501': {
        maxScore: 20,
        gradedBy: 'Dr. Hasan Labani',
      },
    },
  },
  {
    groupId: '14_498_2026_01_M',
    groupName: 'Group 14 - E-Learning Platform',
    course: 'CPIS-498',
    students: [
      { id: '2236502', name: 'Abdullah Bamhisoun' },
      { id: '2236503', name: 'Abdulrahman Solymani' },
    ],
    supervisorName: 'Dr. Hasan Labani',
    
    deliverables: {
      chapter1: { score: 4, maxScore: 5, status: 'graded' },
      chapter2: { maxScore: 1, status: 'submitted' },
      chapter3: { maxScore: 0, status: 'not-submitted' },
      chapter4: { maxScore: 3, status: 'not-submitted' },
      finalReport: { maxScore: 3, status: 'not-submitted' },
      revisedFinalReport: { maxScore: 3, status: 'not-submitted' },
      presentation: { maxScore: 0, status: 'not-submitted' },
    },
    deliverablesTotal: 4,
    
    weeklyProgress: {
      score: 10,
      maxScore: 20,
      reportsSubmitted: 7,
      totalReports: 14,
    },
    
    supervisorAssessment: {
      '2236502': {
        maxScore: 20,
        gradedBy: 'Dr. Hasan Labani',
      },
      '2236503': {
        maxScore: 20,
        gradedBy: 'Dr. Hasan Labani',
      },
    },
  },
];

// Presentation Schedules for Committee Evaluation
export const mockPresentationSchedules: PresentationSchedule[] = [
  {
    groupId: '13_498_2026_01_M',
    groupName: 'Group 13',
    students: [
      { id: '2236500', name: 'Abdullah Bamhisoun' },
      { id: '2236501', name: 'Abdulrahman Solymani' },
    ],
    day: 'Wednesday',
    timeSlot: '11:00 AM - 11:30 AM',
    projectName: 'Graduation Project Platform',
    projectDescription: 'Web platform for managing graduation projects and academic activities',
    committeeMembers: ['Dr. Wafi Bedwai', 'Dr. Sultan Al-Qarni'],
  },
  {
    groupId: '15_498_2026_01_M',
    groupName: 'Group 15',
    students: [
      { id: '2236504', name: 'Turki Al-Mutairi' },
      { id: '2236505', name: 'Saad Al-Dosari' },
    ],
    day: 'Monday',
    timeSlot: '9:00 AM - 9:30 AM',
    projectName: 'Healthcare App',
    projectDescription: 'Mobile application for patient health records management',
    committeeMembers: ['Dr. Wafi Bedwai', 'Dr. Fouad Alallah'],
  },
  {
    groupId: '17_498_2026_01_M',
    groupName: 'Group 17',
    students: [
      { id: '2236506', name: 'Faisal Al-Ghamdi' },
      { id: '2236507', name: 'Khalid Al-Shahrani' },
    ],
    day: 'Monday',
    timeSlot: '9:30 AM - 10:00 AM',
    projectName: 'Mobile Banking App',
    projectDescription: 'Secure banking application with biometric authentication',
    committeeMembers: ['Dr. Sultan Al-Qarni', 'Dr. Fouad Alallah'],
  },
  {
    groupId: '18_498_2026_01_M',
    groupName: 'Group 18',
    students: [
      { id: '2236508', name: 'Omar Al-Zahrani' },
      { id: '2236509', name: 'Mansour Al-Qahtani' },
    ],
    day: 'Tuesday',
    timeSlot: '10:00 AM - 10:30 AM',
    projectName: 'Smart Library System',
    projectDescription: 'Automated library management with RFID technology',
    committeeMembers: ['Dr. Wafi Bedwai', 'Dr. Fouad Alallah'],
  },
  {
    groupId: '19_498_2026_01_M',
    groupName: 'Group 19',
    students: [
      { id: '2236510', name: 'Yazeed Al-Harbi' },
    ],
    day: 'Tuesday',
    timeSlot: '10:30 AM - 11:00 AM',
    projectName: 'Food Delivery Platform',
    projectDescription: 'Real-time food delivery tracking system',
    committeeMembers: ['Dr. Sultan Al-Qarni', 'Dr. Mohammed Al-Rasheed'],
  },
];

// Student Presentation Selections
export const mockStudentPresentationSelections: StudentPresentationSelection[] = [
  {
    groupId: '13_498_2026_01_M',
    groupName: 'Group 13',
    students: [
      { id: '2236500', name: 'Abdullah Bamhisoun' },
      { id: '2236501', name: 'Abdulrahman Solymani' },
    ],
    projectName: 'Graduation Project Platform',
    projectDescription: 'Web platform for managing graduation projects and academic activities',
  },
  {
    groupId: '14_498_2026_01_M',
    groupName: 'Group 14',
    students: [
      { id: '2236502', name: 'Nawaf Al-Otaibi' },
      { id: '2236503', name: 'Saud Al-Subai' },
    ],
    selectedDay: 'Wednesday',
    selectedTimeSlot: '11:00 AM - 11:30 AM',
    projectName: 'E-Learning Platform',
    projectDescription: 'Comprehensive online learning platform with interactive features',
    selectedAt: '2025-11-01T10:30:00Z',
  },
];

// Student Grades (CPIS-498 Assessment - Individual)
export const mockStudentGrades: StudentGrade[] = [
  {
    studentId: '2236500',
    studentName: 'Abdullah Bamhisoun',
    groupId: '13_498_2026_01_M',
    course: 'CPIS-498',
    
    supervisorAssessment: {
      maxScore: 20,
      gradedBy: 'Dr. Hasan Labani',
    },
    
    committeeEvaluation: {
      maxScore: 40,
    },
    
    peerFeedback: {
      maxScore: 5,
    },
    
    deliverablesTotal: 5,
    weeklyProgressScore: 14.4,
    
    totalScore: 19.4,
    finalGrade: 'In Progress',
  },
  {
    studentId: '2236501',
    studentName: 'Abdulrahman Solymani',
    groupId: '13_498_2026_01_M',
    course: 'CPIS-498',
    
    supervisorAssessment: {
      maxScore: 20,
      gradedBy: 'Dr. Hasan Labani',
    },
    
    committeeEvaluation: {
      maxScore: 40,
    },
    
    peerFeedback: {
      maxScore: 5,
    },
    
    deliverablesTotal: 5,
    weeklyProgressScore: 14.4,
    
    totalScore: 19.4,
    finalGrade: 'In Progress',
  },
];
