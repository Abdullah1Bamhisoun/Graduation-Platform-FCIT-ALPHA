-- ============================================
-- GPP (Graduation Project Platform) Seed Data
-- Sample data for testing and development
-- ============================================

-- ============================================
-- SAMPLE USERS
-- ============================================
-- Password for all test users: "password123" (hashed)
-- In production, use proper password hashing!

-- Admin/Coordinator
INSERT INTO users (email, password_hash, name, role, phone) VALUES
('coordinator@kau.edu.sa', 'hashed_password_here', 'Dr. Ahmad Al-Coordinator', 'coordinator', '+966501234567'),
('admin@kau.edu.sa', 'hashed_password_here', 'System Admin', 'admin', '+966501234568');

-- Supervisors
INSERT INTO users (email, password_hash, name, role, phone) VALUES
('h.labani@kau.edu.sa', 'hashed_password_here', 'Dr. Hasan Labani', 'supervisor', '+966501234569'),
('supervisor2@kau.edu.sa', 'hashed_password_here', 'Dr. Fatima Al-Supervisor', 'supervisor', '+966501234570'),
('supervisor3@kau.edu.sa', 'hashed_password_here', 'Dr. Mohammed Al-Professor', 'supervisor', '+966501234571');

-- Students (GPP Team)
INSERT INTO users (email, password_hash, name, role, phone) VALUES
('asolymani@stu.kau.edu.sa', 'hashed_password_here', 'Abdulrahman Solymani', 'student', '+966551234567'),
('abamhisoun@stu.kau.edu.sa', 'hashed_password_here', 'Abdullah Bamhisoun', 'student', '+966551234568');

-- More sample students
INSERT INTO users (email, password_hash, name, role, phone) VALUES
('student3@stu.kau.edu.sa', 'hashed_password_here', 'Omar Al-Student', 'student', '+966551234569'),
('student4@stu.kau.edu.sa', 'hashed_password_here', 'Sara Al-Learner', 'student', '+966551234570'),
('student5@stu.kau.edu.sa', 'hashed_password_here', 'Khalid Al-Researcher', 'student', '+966551234571'),
('student6@stu.kau.edu.sa', 'hashed_password_here', 'Noura Al-Developer', 'student', '+966551234572');

-- ============================================
-- SAMPLE ADMINS
-- ============================================

INSERT INTO admins (user_id, admin_type, department) VALUES
(1, 'coordinator', 'Information Systems'),
(2, 'system_admin', 'Information Systems');

-- ============================================
-- SAMPLE SUPERVISORS
-- ============================================

INSERT INTO supervisors (user_id, office_location, expertise, max_groups, current_groups) VALUES
(3, 'Building 31, Office 205', 'Web Development, Database Systems, Software Engineering', 4, 2),
(4, 'Building 31, Office 210', 'Machine Learning, Data Science, AI', 4, 1),
(5, 'Building 31, Office 215', 'Networks, Security, Cloud Computing', 3, 1);

-- ============================================
-- SAMPLE COURSES
-- ============================================

INSERT INTO courses (course_code, course_name, term, academic_year, start_date, end_date, is_active) VALUES
('CPIS-498', 'Graduation Project 1', 'Fall 2025', '2025-2026', '2025-09-01', '2025-12-31', 1),
('CPIS-499', 'Graduation Project 2', 'Spring 2026', '2025-2026', '2026-01-15', '2026-05-15', 0);

-- ============================================
-- SAMPLE GROUPS
-- ============================================

INSERT INTO groups (group_name, course_id, supervisor_id, max_members, status) VALUES
('GPP Team', 1, 1, 2, 'active'),  -- Abdulrahman & Abdullah's group
('AI Vision', 1, 2, 2, 'active'),
('SecureNet', 1, 3, 2, 'active');

-- ============================================
-- SAMPLE STUDENTS (with group assignments)
-- ============================================

INSERT INTO students (user_id, university_id, department, track, academic_year, group_id) VALUES
(6, '2236143', 'Information Systems', 'Software Engineering', 'Senior', 1),  -- Abdulrahman
(7, '2236500', 'Information Systems', 'Software Engineering', 'Senior', 1),  -- Abdullah
(8, '2236001', 'Information Systems', 'Data Science', 'Senior', 2),
(9, '2236002', 'Information Systems', 'Data Science', 'Senior', 2),
(10, '2236003', 'Information Systems', 'Network Security', 'Senior', 3),
(11, '2236004', 'Information Systems', 'Network Security', 'Senior', 3);

-- ============================================
-- SAMPLE PROJECTS
-- ============================================

INSERT INTO projects (group_id, title, abstract, description, status, start_date, expected_end_date) VALUES
(1, 'Graduation Project Management Platform (GPP)', 
   'A web-based system that centralizes all graduation project activities including submissions, evaluations, and announcements for FCIT.',
   'This project addresses the problem of fragmented graduation project management at FCIT. Currently, activities are scattered across emails, forms, and spreadsheets. GPP provides a unified platform for students, supervisors, and administrators.',
   'in_progress', '2025-09-01', '2026-05-15'),

(2, 'AI-Powered Document Analysis System',
   'An intelligent system that uses machine learning to analyze and categorize academic documents.',
   'This project develops an AI system capable of reading academic documents, extracting key information, and providing summaries and classifications.',
   'in_progress', '2025-09-01', '2026-05-15'),

(3, 'Secure Cloud Storage Platform',
   'A secure file storage solution with end-to-end encryption for university use.',
   'This project creates a secure cloud storage system specifically designed for academic institutions with emphasis on data privacy and security.',
   'in_progress', '2025-09-01', '2026-05-15');

-- ============================================
-- SAMPLE MILESTONES (for CPIS-498)
-- ============================================

INSERT INTO milestones (course_id, name, description, milestone_type, due_date, open_date, close_date, weight, is_mandatory, allow_late) VALUES
-- Weekly Reports
(1, 'Weekly Report - Week 1', 'First week progress report', 'weekly_report', '2025-09-07 23:59:00', '2025-09-01 00:00:00', '2025-09-08 23:59:00', 1, 1, 1),
(1, 'Weekly Report - Week 2', 'Second week progress report', 'weekly_report', '2025-09-14 23:59:00', '2025-09-08 00:00:00', '2025-09-15 23:59:00', 1, 1, 1),
(1, 'Weekly Report - Week 3', 'Third week progress report', 'weekly_report', '2025-09-21 23:59:00', '2025-09-15 00:00:00', '2025-09-22 23:59:00', 1, 1, 1),

-- Chapter Submissions
(1, 'Chapter 1 - Introduction', 'Project introduction and problem statement', 'chapter', '2025-09-30 23:59:00', '2025-09-01 00:00:00', '2025-10-02 23:59:00', 10, 1, 1),
(1, 'Chapter 2 - Related Work', 'Literature review and related systems', 'chapter', '2025-10-15 23:59:00', '2025-10-01 00:00:00', '2025-10-17 23:59:00', 10, 1, 1),
(1, 'Chapter 3 - Requirements', 'System requirements and use cases', 'chapter', '2025-10-31 23:59:00', '2025-10-16 00:00:00', '2025-11-02 23:59:00', 15, 1, 1),

-- Demos
(1, 'Demo 1', 'First project demonstration', 'demo', '2025-11-15 23:59:00', '2025-11-01 00:00:00', '2025-11-15 23:59:00', 15, 1, 0),
(1, 'Demo 2', 'Second project demonstration', 'demo', '2025-12-10 23:59:00', '2025-12-01 00:00:00', '2025-12-10 23:59:00', 15, 1, 0),

-- Final Report
(1, 'Final Report (498)', 'Complete CPIS-498 report', 'final_report', '2025-12-20 23:59:00', '2025-12-01 00:00:00', '2025-12-22 23:59:00', 20, 1, 1);

-- ============================================
-- SAMPLE RUBRICS
-- ============================================

INSERT INTO rubrics (milestone_id, name, description, max_score) VALUES
(4, 'Chapter 1 Rubric', 'Grading criteria for Introduction chapter', 100),
(7, 'Demo 1 Rubric', 'Grading criteria for first demonstration', 100);

-- ============================================
-- SAMPLE RUBRIC CRITERIA
-- ============================================

-- Chapter 1 Rubric Criteria
INSERT INTO rubric_criteria (rubric_id, name, description, max_points, weight, order_index) VALUES
(1, 'Problem Statement', 'Clear identification and explanation of the problem', 25, 1.0, 1),
(1, 'Objectives', 'Well-defined and measurable objectives', 25, 1.0, 2),
(1, 'Scope', 'Clear project scope and boundaries', 20, 1.0, 3),
(1, 'Writing Quality', 'Grammar, structure, and formatting', 15, 1.0, 4),
(1, 'References', 'Proper citations and references', 15, 1.0, 5);

-- Demo 1 Rubric Criteria
INSERT INTO rubric_criteria (rubric_id, name, description, max_points, weight, order_index) VALUES
(2, 'Technical Implementation', 'Quality of code and technical work', 30, 1.0, 1),
(2, 'Functionality', 'Working features demonstrated', 25, 1.0, 2),
(2, 'Presentation', 'Clear explanation and communication', 20, 1.0, 3),
(2, 'Progress', 'Amount of work completed since last milestone', 15, 1.0, 4),
(2, 'Q&A', 'Ability to answer questions', 10, 1.0, 5);

-- ============================================
-- SAMPLE SUBMISSIONS
-- ============================================

INSERT INTO submissions (project_id, milestone_id, submitted_by, file_name, file_type, version, status, submission_date, is_late) VALUES
-- GPP Team submissions
(1, 1, 6, 'weekly_report_week1.pdf', 'pdf', 1, 'approved', '2025-09-07 20:30:00', 0),
(1, 2, 6, 'weekly_report_week2.pdf', 'pdf', 1, 'approved', '2025-09-14 22:00:00', 0),
(1, 4, 7, 'chapter1_introduction.pdf', 'pdf', 1, 'under_review', '2025-09-29 18:00:00', 0),

-- AI Vision Team submissions
(2, 1, 8, 'ai_weekly_week1.pdf', 'pdf', 1, 'approved', '2025-09-07 15:00:00', 0),
(2, 4, 8, 'ai_chapter1.pdf', 'pdf', 1, 'changes_requested', '2025-09-30 10:00:00', 0);

-- ============================================
-- SAMPLE WEEKLY REPORTS
-- ============================================

INSERT INTO weekly_reports (project_id, submission_id, week_number, work_completed, blockers, next_steps, hours_worked, status, supervisor_comments, reviewed_by, reviewed_at) VALUES
(1, 1, 1, 'Set up project repository, completed initial research on existing systems, drafted project proposal outline.', 'None', 'Complete literature review, start writing Chapter 1', 15, 'reviewed', 'Good start! Make sure to document your sources properly.', 3, '2025-09-08 10:00:00'),
(1, 2, 2, 'Completed related work section draft, analyzed 3 existing systems, started requirements gathering interviews.', 'Difficulty scheduling interview with coordinator', 'Complete interviews, finalize Chapter 2', 18, 'reviewed', 'Excellent progress. The system analysis is thorough.', 3, '2025-09-15 14:00:00');

-- ============================================
-- SAMPLE FEEDBACK
-- ============================================

INSERT INTO feedback (submission_id, given_by, feedback_text, feedback_type, is_private, action_required) VALUES
(3, 3, 'Good structure for Chapter 1. Please expand the problem statement section with more specific examples from FCIT.', 'suggestion', 0, 1),
(3, 3, 'Consider adding a section about the impact on stakeholders.', 'comment', 0, 0),
(5, 4, 'The methodology section needs more detail. Please revise and resubmit.', 'action_required', 0, 1);

-- ============================================
-- SAMPLE EVALUATIONS
-- ============================================

INSERT INTO evaluations (submission_id, evaluator_id, rubric_id, total_score, max_score, percentage, status, general_comments, evaluation_date) VALUES
(1, 3, NULL, 9, 10, 90, 'completed', 'Well-organized weekly report with clear progress tracking.', '2025-09-08 10:00:00'),
(2, 3, NULL, 8.5, 10, 85, 'completed', 'Good progress documented. Keep up the momentum.', '2025-09-15 14:00:00');

-- ============================================
-- SAMPLE ANNOUNCEMENTS
-- ============================================

INSERT INTO announcements (created_by, title, content, target_audience, course_id, priority, is_published, publish_date, expiry_date) VALUES
(1, 'Welcome to CPIS-498 Fall 2025', 
   'Welcome to Graduation Project 1! Please make sure to review the course manual and submit your weekly reports on time. Office hours are available for questions.',
   'students', 1, 'high', 1, '2025-09-01 08:00:00', '2025-09-15 23:59:00'),

(1, 'Demo 1 Schedule Released',
   'The schedule for Demo 1 presentations has been released. Please check your assigned time slot and prepare your demonstrations accordingly.',
   'all', 1, 'urgent', 1, '2025-11-01 09:00:00', '2025-11-15 23:59:00'),

(1, 'Reminder: Chapter 1 Due Soon',
   'This is a reminder that Chapter 1 (Introduction) is due on September 30th. Late submissions will have a 10% penalty per day.',
   'students', 1, 'normal', 1, '2025-09-25 08:00:00', '2025-10-01 23:59:00');

-- ============================================
-- SAMPLE NOTIFICATIONS
-- ============================================

INSERT INTO notifications (user_id, title, message, notification_type, related_entity_type, related_entity_id, is_read) VALUES
(6, 'Feedback Received', 'Dr. Hasan Labani has provided feedback on your Chapter 1 submission.', 'feedback', 'submission', 3, 0),
(6, 'Deadline Reminder', 'Chapter 2 - Related Work is due in 3 days.', 'deadline', 'milestone', 5, 0),
(7, 'Weekly Report Approved', 'Your Week 2 progress report has been approved.', 'grade', 'submission', 2, 1),
(8, 'Changes Requested', 'Your Chapter 1 submission requires changes. Please review the feedback.', 'feedback', 'submission', 5, 0);

-- ============================================
-- SAMPLE AUDIT LOG
-- ============================================

INSERT INTO audit_log (user_id, action, entity_type, entity_id, description, created_at) VALUES
(6, 'LOGIN', 'user', 6, 'User logged in successfully', '2025-09-07 20:00:00'),
(6, 'SUBMIT', 'submission', 1, 'Submitted Weekly Report - Week 1', '2025-09-07 20:30:00'),
(3, 'REVIEW', 'submission', 1, 'Reviewed and approved submission', '2025-09-08 10:00:00'),
(3, 'GRADE', 'evaluation', 1, 'Created evaluation with score 90%', '2025-09-08 10:05:00'),
(1, 'ANNOUNCE', 'announcement', 1, 'Published welcome announcement', '2025-09-01 08:00:00');

-- ============================================
-- SAMPLE SCHEDULES (for demos)
-- ============================================

INSERT INTO schedules (milestone_id, project_id, scheduled_date, start_time, end_time, location, meeting_link, evaluators, status) VALUES
(7, 1, '2025-11-15', '09:00:00', '09:30:00', 'Building 31, Room 101', 'https://teams.microsoft.com/meeting123', '[3]', 'scheduled'),
(7, 2, '2025-11-15', '09:30:00', '10:00:00', 'Building 31, Room 101', 'https://teams.microsoft.com/meeting124', '[4]', 'scheduled'),
(7, 3, '2025-11-15', '10:00:00', '10:30:00', 'Building 31, Room 101', 'https://teams.microsoft.com/meeting125', '[5]', 'scheduled');

-- ============================================
-- End of Seed Data
-- ============================================
