-- ============================================
-- GPP (Graduation Project Platform) Database Schema
-- Faculty of Computing and Information Technology (FCIT)
-- King Abdulaziz University
-- ============================================
-- This schema creates all tables needed for the GPP system
-- Database: SQLite
-- ============================================

-- ============================================
-- 1. USERS TABLE (Base table for all users)
-- ============================================
-- This is the main table - everyone logs in through here
-- The 'role' field determines what they can do

CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'supervisor', 'admin', 'coordinator')),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. STUDENTS TABLE (Student-specific data)
-- ============================================
-- Links to users table via user_id
-- Stores student-specific information

CREATE TABLE IF NOT EXISTS students (
    student_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    university_id VARCHAR(20) UNIQUE NOT NULL,  -- e.g., "2236143"
    department VARCHAR(100) DEFAULT 'Information Systems',
    track VARCHAR(100),  -- e.g., "Data Science", "Software Engineering"
    academic_year VARCHAR(20),  -- e.g., "Senior"
    group_id INTEGER,  -- Will be linked after groups table is created
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================
-- 3. SUPERVISORS TABLE (Supervisor-specific data)
-- ============================================
-- Links to users table via user_id
-- Stores supervision capacity and expertise

CREATE TABLE IF NOT EXISTS supervisors (
    supervisor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    office_location VARCHAR(100),
    expertise TEXT,  -- e.g., "Machine Learning, Web Development"
    max_groups INTEGER DEFAULT 4,  -- Maximum groups they can supervise
    current_groups INTEGER DEFAULT 0,  -- Current number of groups
    is_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================
-- 4. ADMINS TABLE (Admin/Coordinator-specific data)
-- ============================================
-- Links to users table via user_id
-- Admins can configure milestones, assign supervisors, etc.

CREATE TABLE IF NOT EXISTS admins (
    admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    admin_type VARCHAR(20) DEFAULT 'coordinator' CHECK (admin_type IN ('coordinator', 'head_of_department', 'system_admin')),
    department VARCHAR(100) DEFAULT 'Information Systems',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================
-- 5. COURSES TABLE (CPIS-498 and CPIS-499)
-- ============================================
-- Represents the graduation project courses

CREATE TABLE IF NOT EXISTS courses (
    course_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_code VARCHAR(20) NOT NULL,  -- e.g., "CPIS-498", "CPIS-499"
    course_name VARCHAR(255) NOT NULL,
    term VARCHAR(20) NOT NULL,  -- e.g., "Fall 2025", "Spring 2026"
    academic_year VARCHAR(20) NOT NULL,  -- e.g., "2025-2026"
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 6. GROUPS TABLE (Student project groups)
-- ============================================
-- Each group has students and one supervisor
-- Each group works on one project

CREATE TABLE IF NOT EXISTS groups (
    group_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_name VARCHAR(100),  -- e.g., "Group A", "Team GPP"
    course_id INTEGER NOT NULL,
    supervisor_id INTEGER,
    max_members INTEGER DEFAULT 3,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(course_id),
    FOREIGN KEY (supervisor_id) REFERENCES supervisors(supervisor_id)
);

-- Add foreign key to students table for group_id
-- (SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we handle this in application logic)

-- ============================================
-- 7. PROJECTS TABLE (The graduation projects)
-- ============================================
-- Each project belongs to a group
-- Central entity that connects everything

CREATE TABLE IF NOT EXISTS projects (
    project_id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    abstract TEXT,
    description TEXT,
    status VARCHAR(30) DEFAULT 'in_progress' CHECK (status IN ('proposal', 'in_progress', 'under_review', 'completed', 'failed')),
    start_date DATE,
    expected_end_date DATE,
    actual_end_date DATE,
    final_grade DECIMAL(5,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(group_id)
);

-- ============================================
-- 8. MILESTONES TABLE (Deadlines and checkpoints)
-- ============================================
-- Defines what needs to be submitted and when
-- e.g., Weekly Report, Demo 1, Demo 2, Final Report

CREATE TABLE IF NOT EXISTS milestones (
    milestone_id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,  -- e.g., "Weekly Report Week 1", "Demo 1", "Final Report"
    description TEXT,
    milestone_type VARCHAR(50) NOT NULL CHECK (milestone_type IN ('weekly_report', 'chapter', 'demo', 'poster', 'final_report', 'presentation')),
    due_date DATETIME NOT NULL,
    open_date DATETIME,  -- When submissions open
    close_date DATETIME,  -- When submissions close (can be after due_date with penalty)
    weight DECIMAL(5,2) DEFAULT 0,  -- Percentage of final grade
    is_mandatory BOOLEAN DEFAULT 1,
    allow_late BOOLEAN DEFAULT 0,
    late_penalty_percent DECIMAL(5,2) DEFAULT 0,  -- e.g., 10% per day
    reminder_days INTEGER DEFAULT 3,  -- Days before due date to send reminder
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- ============================================
-- 9. SUBMISSIONS TABLE (What students upload)
-- ============================================
-- Each submission is for a specific milestone
-- Tracks versions and status

CREATE TABLE IF NOT EXISTS submissions (
    submission_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    milestone_id INTEGER NOT NULL,
    submitted_by INTEGER NOT NULL,  -- user_id of student who submitted
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_type VARCHAR(50),  -- e.g., "pdf", "docx", "zip"
    file_size INTEGER,  -- in bytes
    version INTEGER DEFAULT 1,
    status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected')),
    submission_date DATETIME,
    is_late BOOLEAN DEFAULT 0,
    late_reason TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id),
    FOREIGN KEY (milestone_id) REFERENCES milestones(milestone_id),
    FOREIGN KEY (submitted_by) REFERENCES users(user_id)
);

-- ============================================
-- 10. RUBRICS TABLE (Grading criteria)
-- ============================================
-- Defines how submissions are graded
-- Each milestone can have a rubric

CREATE TABLE IF NOT EXISTS rubrics (
    rubric_id INTEGER PRIMARY KEY AUTOINCREMENT,
    milestone_id INTEGER,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_score DECIMAL(5,2) DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (milestone_id) REFERENCES milestones(milestone_id)
);

-- ============================================
-- 11. RUBRIC_CRITERIA TABLE (Individual criteria in a rubric)
-- ============================================
-- Each rubric has multiple criteria
-- e.g., "Code Quality", "Documentation", "Presentation"

CREATE TABLE IF NOT EXISTS rubric_criteria (
    criterion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rubric_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_points DECIMAL(5,2) NOT NULL,
    weight DECIMAL(5,2) DEFAULT 1.0,  -- Multiplier for this criterion
    order_index INTEGER DEFAULT 0,  -- Display order
    FOREIGN KEY (rubric_id) REFERENCES rubrics(rubric_id) ON DELETE CASCADE
);

-- ============================================
-- 12. EVALUATIONS TABLE (Grades given to submissions)
-- ============================================
-- Supervisors evaluate submissions
-- Links submission to evaluator and scores

CREATE TABLE IF NOT EXISTS evaluations (
    evaluation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    evaluator_id INTEGER NOT NULL,  -- supervisor's user_id
    rubric_id INTEGER,
    total_score DECIMAL(5,2),
    max_score DECIMAL(5,2),
    percentage DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    general_comments TEXT,
    evaluation_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
    FOREIGN KEY (evaluator_id) REFERENCES users(user_id),
    FOREIGN KEY (rubric_id) REFERENCES rubrics(rubric_id)
);

-- ============================================
-- 13. EVALUATION_SCORES TABLE (Individual criterion scores)
-- ============================================
-- Detailed scores for each criterion in an evaluation

CREATE TABLE IF NOT EXISTS evaluation_scores (
    score_id INTEGER PRIMARY KEY AUTOINCREMENT,
    evaluation_id INTEGER NOT NULL,
    criterion_id INTEGER NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evaluation_id) REFERENCES evaluations(evaluation_id) ON DELETE CASCADE,
    FOREIGN KEY (criterion_id) REFERENCES rubric_criteria(criterion_id)
);

-- ============================================
-- 14. FEEDBACK TABLE (Comments on submissions)
-- ============================================
-- Supervisors can give feedback without formal evaluation
-- Useful for draft reviews and guidance

CREATE TABLE IF NOT EXISTS feedback (
    feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    given_by INTEGER NOT NULL,  -- user_id of supervisor
    feedback_text TEXT NOT NULL,
    feedback_type VARCHAR(30) DEFAULT 'comment' CHECK (feedback_type IN ('comment', 'suggestion', 'action_required', 'approval')),
    is_private BOOLEAN DEFAULT 0,  -- Private notes not visible to students
    is_read BOOLEAN DEFAULT 0,
    action_required BOOLEAN DEFAULT 0,
    action_completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
    FOREIGN KEY (given_by) REFERENCES users(user_id)
);

-- ============================================
-- 15. WEEKLY_REPORTS TABLE (Weekly progress reports)
-- ============================================
-- Structured weekly reports from students

CREATE TABLE IF NOT EXISTS weekly_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    submission_id INTEGER,  -- Links to the submission if file uploaded
    week_number INTEGER NOT NULL,
    work_completed TEXT,  -- What was done this week
    blockers TEXT,  -- Problems faced
    next_steps TEXT,  -- Plan for next week
    hours_worked DECIMAL(5,2),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewed')),
    supervisor_comments TEXT,
    reviewed_by INTEGER,  -- supervisor's user_id
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id),
    FOREIGN KEY (submission_id) REFERENCES submissions(submission_id),
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);

-- ============================================
-- 16. ANNOUNCEMENTS TABLE (System announcements)
-- ============================================
-- Admins/Coordinators post announcements

CREATE TABLE IF NOT EXISTS announcements (
    announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_by INTEGER NOT NULL,  -- admin's user_id
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    target_audience VARCHAR(30) DEFAULT 'all' CHECK (target_audience IN ('all', 'students', 'supervisors', 'admins')),
    course_id INTEGER,  -- If specific to a course
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_published BOOLEAN DEFAULT 0,
    publish_date DATETIME,
    expiry_date DATETIME,
    attachment_path VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- ============================================
-- 17. NOTIFICATIONS TABLE (User notifications)
-- ============================================
-- In-app notifications for users

CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) DEFAULT 'info' CHECK (notification_type IN ('info', 'deadline', 'feedback', 'grade', 'announcement', 'reminder', 'warning')),
    related_entity_type VARCHAR(50),  -- e.g., 'submission', 'milestone', 'project'
    related_entity_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    is_email_sent BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================
-- 18. AUDIT_LOG TABLE (Track all actions)
-- ============================================
-- Records all important actions for accountability

CREATE TABLE IF NOT EXISTS audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,  -- e.g., 'LOGIN', 'SUBMIT', 'GRADE', 'UPDATE'
    entity_type VARCHAR(50),  -- e.g., 'submission', 'evaluation', 'user'
    entity_id INTEGER,
    old_value TEXT,  -- JSON of old values (for updates)
    new_value TEXT,  -- JSON of new values
    ip_address VARCHAR(50),
    user_agent TEXT,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================
-- 19. FILE_VERSIONS TABLE (Track file versions)
-- ============================================
-- Keeps history of all file versions for submissions

CREATE TABLE IF NOT EXISTS file_versions (
    version_id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER NOT NULL,
    upload_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES submissions(submission_id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

-- ============================================
-- 20. SCHEDULES TABLE (Demo/Presentation schedules)
-- ============================================
-- For scheduling demos, poster presentations, etc.

CREATE TABLE IF NOT EXISTS schedules (
    schedule_id INTEGER PRIMARY KEY AUTOINCREMENT,
    milestone_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255),
    meeting_link VARCHAR(500),  -- For online meetings
    evaluators TEXT,  -- JSON array of supervisor user_ids
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (milestone_id) REFERENCES milestones(milestone_id),
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- ============================================
-- INDEXES (For faster queries)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_students_university_id ON students(university_id);
CREATE INDEX IF NOT EXISTS idx_students_group_id ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_submissions_project_id ON submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_submissions_milestone_id ON submissions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_submission_id ON evaluations(submission_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- ============================================
-- End of Schema
-- ============================================
