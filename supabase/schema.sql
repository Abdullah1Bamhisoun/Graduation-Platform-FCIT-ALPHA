-- =====================================================
-- GRADUATION PLATFORM FCIT - DATABASE SCHEMA
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE user_role AS ENUM ('student', 'supervisor', 'admin');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'under_review', 'changes_requested', 'approved');
CREATE TYPE milestone_type AS ENUM ('weekly_report', 'chapter', 'final_report', 'poster', 'presentation');
CREATE TYPE course_code AS ENUM ('CPIS_498', 'CPIS_499');
CREATE TYPE progress_status AS ENUM ('excellent', 'good', 'satisfactory', 'needs_improvement');
CREATE TYPE notification_type AS ENUM ('deadline', 'feedback', 'grade', 'announcement');
CREATE TYPE registration_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE account_type AS ENUM ('student', 'supervisor');
CREATE TYPE department_type AS ENUM ('CS', 'IT', 'IS');
CREATE TYPE deliverable_status AS ENUM ('not_submitted', 'submitted', 'graded');

-- =====================================================
-- TABLES
-- =====================================================

-- User Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL,
  student_id TEXT UNIQUE,
  employee_number TEXT UNIQUE,
  department department_type,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code course_code NOT NULL,
  name TEXT NOT NULL,
  term TEXT NOT NULL,
  year INTEGER NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(code, term, year)
);

-- Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_code TEXT UNIQUE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_description TEXT,
  supervisor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Members (junction table)
CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, student_id)
);

-- Milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type milestone_type NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  open_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  description TEXT,
  visible BOOLEAN DEFAULT true,
  allow_late_submission BOOLEAN DEFAULT false,
  require_justification BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rubric Criteria
CREATE TABLE rubric_criteria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_score INTEGER NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  status submission_status DEFAULT 'draft',
  current_version INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(milestone_id, student_id)
);

-- Submission Versions
CREATE TABLE submission_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT NOT NULL,
  file_path TEXT NOT NULL,
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submission_id, version)
);

-- Submission Feedback
CREATE TABLE submission_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE UNIQUE,
  overall_comment TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  total_score NUMERIC(5,2),
  max_score NUMERIC(5,2)
);

-- Feedback Scores (per rubric criterion)
CREATE TABLE feedback_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feedback_id UUID REFERENCES submission_feedback(id) ON DELETE CASCADE,
  rubric_criterion_id UUID REFERENCES rubric_criteria(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  comment TEXT,
  UNIQUE(feedback_id, rubric_criterion_id)
);

-- Weekly Reports
CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  date_range TEXT NOT NULL,
  course_id UUID REFERENCES courses(id),
  all_members_attended BOOLEAN DEFAULT true,
  absent_student_name TEXT,
  progress_status progress_status NOT NULL,
  supervisor_comments TEXT NOT NULL,
  status submission_status DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id),
  UNIQUE(group_id, week_number)
);

-- Group Deliverable Grades
CREATE TABLE group_deliverable_grades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  deliverable_key TEXT NOT NULL, -- 'chapter1', 'chapter2', 'finalReport', etc.
  score NUMERIC(5,2),
  max_score NUMERIC(5,2) NOT NULL,
  status deliverable_status DEFAULT 'not_submitted',
  graded_by UUID REFERENCES profiles(id),
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, course_id, deliverable_key)
);

-- Supervisor Assessments (20 marks per student)
CREATE TABLE supervisor_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  score NUMERIC(5,2) CHECK (score <= 20),
  max_score NUMERIC(5,2) DEFAULT 20,
  comment TEXT,
  graded_by UUID REFERENCES profiles(id),
  graded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, group_id, course_id)
);

-- Committee Evaluations (40 marks per student)
CREATE TABLE committee_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  score NUMERIC(5,2) CHECK (score <= 40),
  max_score NUMERIC(5,2) DEFAULT 40,
  evaluator_id UUID REFERENCES profiles(id),
  comment TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, group_id, course_id, evaluator_id)
);

-- Peer Evaluations (5 marks per student)
CREATE TABLE peer_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  score NUMERIC(5,2) CHECK (score <= 5),
  max_score NUMERIC(5,2) DEFAULT 5,
  comment TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, evaluator_id, group_id, course_id)
);

-- Presentation Schedules
CREATE TABLE presentation_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE UNIQUE,
  day TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  committee_members TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id),
  published_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  target_roles user_role[] NOT NULL,
  attachments TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read ON notifications(user_id, read);

-- Pending Registrations
CREATE TABLE pending_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type account_type NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  department department_type NOT NULL,
  status registration_status DEFAULT 'pending',

  -- Student-specific fields
  student_id TEXT,
  course TEXT,
  term TEXT,
  group_id TEXT,
  project_name TEXT,
  project_idea TEXT,
  teammate_submitted_idea BOOLEAN,

  -- Supervisor-specific fields
  employee_number TEXT,

  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_pending_registrations_status ON pending_registrations(status);
CREATE INDEX idx_pending_registrations_email ON pending_registrations(email);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  context JSONB
);

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_deliverable_grades_updated_at BEFORE UPDATE ON group_deliverable_grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presentation_schedules_updated_at BEFORE UPDATE ON presentation_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubric_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_deliverable_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE peer_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role can insert profiles" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');

-- Courses policies
CREATE POLICY "Everyone can view courses" ON courses
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage courses" ON courses
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Groups policies
CREATE POLICY "Everyone can view groups" ON groups
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage groups" ON groups
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Group members policies
CREATE POLICY "Everyone can view group members" ON group_members
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage group members" ON group_members
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Milestones policies
CREATE POLICY "Everyone can view visible milestones" ON milestones
  FOR SELECT USING (visible = true OR get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage milestones" ON milestones
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Rubric criteria policies
CREATE POLICY "Everyone can view rubric criteria" ON rubric_criteria
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage rubric criteria" ON rubric_criteria
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Submissions policies
CREATE POLICY "Students can view own submissions" ON submissions
  FOR SELECT USING (
    student_id = auth.uid() OR
    get_user_role(auth.uid()) IN ('supervisor', 'admin')
  );

CREATE POLICY "Students can create own submissions" ON submissions
  FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own submissions" ON submissions
  FOR UPDATE USING (student_id = auth.uid());

CREATE POLICY "Supervisors and admins can update submissions" ON submissions
  FOR UPDATE USING (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

-- Submission versions policies
CREATE POLICY "Users can view submission versions" ON submission_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = submission_versions.submission_id
      AND (submissions.student_id = auth.uid() OR get_user_role(auth.uid()) IN ('supervisor', 'admin'))
    )
  );

CREATE POLICY "Students can create submission versions" ON submission_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = submission_versions.submission_id
      AND submissions.student_id = auth.uid()
    )
  );

-- Submission feedback policies
CREATE POLICY "Users can view feedback" ON submission_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions
      WHERE submissions.id = submission_feedback.submission_id
      AND (submissions.student_id = auth.uid() OR get_user_role(auth.uid()) IN ('supervisor', 'admin'))
    )
  );

CREATE POLICY "Supervisors and admins can create feedback" ON submission_feedback
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

CREATE POLICY "Supervisors and admins can update feedback" ON submission_feedback
  FOR UPDATE USING (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

-- Feedback scores policies
CREATE POLICY "Users can view feedback scores" ON feedback_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submission_feedback sf
      JOIN submissions s ON sf.submission_id = s.id
      WHERE sf.id = feedback_scores.feedback_id
      AND (s.student_id = auth.uid() OR get_user_role(auth.uid()) IN ('supervisor', 'admin'))
    )
  );

CREATE POLICY "Supervisors and admins can manage feedback scores" ON feedback_scores
  FOR ALL USING (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

-- Weekly reports policies
CREATE POLICY "Group members and supervisors can view weekly reports" ON weekly_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id = weekly_reports.group_id
      AND (gm.student_id = auth.uid() OR g.supervisor_id = auth.uid() OR get_user_role(auth.uid()) = 'admin')
    )
  );

CREATE POLICY "Supervisors can create weekly reports" ON weekly_reports
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

CREATE POLICY "Supervisors can update weekly reports" ON weekly_reports
  FOR UPDATE USING (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

-- Grading policies (supervisor assessments, committee evaluations, peer evaluations)
CREATE POLICY "Students can view own grades" ON supervisor_assessments
  FOR SELECT USING (student_id = auth.uid() OR get_user_role(auth.uid()) IN ('supervisor', 'admin'));

CREATE POLICY "Supervisors can manage assessments" ON supervisor_assessments
  FOR ALL USING (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

CREATE POLICY "Users can view committee evaluations" ON committee_evaluations
  FOR SELECT USING (
    student_id = auth.uid() OR
    evaluator_id = auth.uid() OR
    get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Supervisors can create evaluations" ON committee_evaluations
  FOR INSERT WITH CHECK (get_user_role(auth.uid()) IN ('supervisor', 'admin'));

CREATE POLICY "Evaluators can update own evaluations" ON committee_evaluations
  FOR UPDATE USING (evaluator_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Students can view peer evaluations" ON peer_evaluations
  FOR SELECT USING (
    student_id = auth.uid() OR
    get_user_role(auth.uid()) IN ('supervisor', 'admin')
  );

CREATE POLICY "Students can submit peer evaluations" ON peer_evaluations
  FOR INSERT WITH CHECK (evaluator_id = auth.uid());

-- Group deliverable grades policies
CREATE POLICY "Group members can view deliverable grades" ON group_deliverable_grades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = group_deliverable_grades.group_id
      AND group_members.student_id = auth.uid()
    ) OR get_user_role(auth.uid()) IN ('supervisor', 'admin')
  );

CREATE POLICY "Admins can manage deliverable grades" ON group_deliverable_grades
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Presentation schedules policies
CREATE POLICY "Everyone can view presentation schedules" ON presentation_schedules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage presentation schedules" ON presentation_schedules
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Announcements policies
CREATE POLICY "Users can view announcements for their role" ON announcements
  FOR SELECT USING (
    get_user_role(auth.uid()) = ANY(target_roles) OR
    get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Pending registrations policies (public can insert, admins can manage)
CREATE POLICY "Anyone can submit registration" ON pending_registrations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own registration" ON pending_registrations
  FOR SELECT USING (email = auth.email() OR get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can manage registrations" ON pending_registrations
  FOR ALL USING (get_user_role(auth.uid()) = 'admin');

-- Audit log policies
CREATE POLICY "Admins can view audit log" ON audit_log
  FOR SELECT USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "System can insert audit log" ON audit_log
  FOR INSERT WITH CHECK (true);
