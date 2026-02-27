-- ============================================================
-- GPP Full Grading System Migration
-- Run this in your Supabase SQL editor (supabase.co → SQL Editor)
-- ============================================================

-- ─── 1. Grading Rubric Criteria ──────────────────────────────────────────────
-- Stores the official rubric criteria for each grading component.
-- Coordinator can edit these to customize the scheme.

CREATE TABLE IF NOT EXISTS grading_rubric_criteria (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_type     TEXT NOT NULL CHECK (course_type IN ('498', '499')),
  component_key   TEXT NOT NULL,  -- 'supervisor_eval' | 'committee_eval' | 'coordinator_deliverables'
  criterion_key   TEXT NOT NULL,  -- e.g. 'literature_review', 'system_analysis'
  criterion_name  TEXT NOT NULL,
  max_raw_score   INTEGER NOT NULL DEFAULT 5,
  description_1   TEXT,
  description_2   TEXT,
  description_3   TEXT,
  description_4   TEXT,
  description_5   TEXT,
  display_order   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_type, component_key, criterion_key)
);

-- ─── 2. Grading Components (high-level weights) ───────────────────────────────
-- Stores the total marks for each high-level component.
-- Coordinator can adjust weights; total must remain 100.

CREATE TABLE IF NOT EXISTS grading_components (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_type     TEXT NOT NULL CHECK (course_type IN ('498', '499')),
  component_key   TEXT NOT NULL,
  component_name  TEXT NOT NULL,
  total_marks     INTEGER NOT NULL,
  evaluator_role  TEXT NOT NULL,
  display_order   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_type, component_key)
);

-- ─── 3. Supervisor Rubric Scores (per-criterion) ──────────────────────────────
CREATE TABLE IF NOT EXISTS supervisor_rubric_scores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  criterion_key   TEXT NOT NULL,
  raw_score       INTEGER NOT NULL DEFAULT 1 CHECK (raw_score >= 1 AND raw_score <= 5),
  graded_by       UUID REFERENCES profiles(id),
  graded_at       TIMESTAMPTZ DEFAULT now(),
  submission_status TEXT DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'locked')),
  UNIQUE(student_id, group_id, course_id, criterion_key)
);

-- ─── 4. Committee Rubric Scores (per-criterion, per evaluator) ────────────────
CREATE TABLE IF NOT EXISTS committee_rubric_scores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  evaluator_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  criterion_key   TEXT NOT NULL,
  score           INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 5),
  submitted_at    TIMESTAMPTZ DEFAULT now(),
  submission_status TEXT DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'locked')),
  UNIQUE(group_id, course_id, evaluator_id, criterion_key)
);

-- ─── 5. Coordinator Deliverable Scores ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS coordinator_deliverable_scores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id        UUID REFERENCES groups(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE,
  deliverable_key TEXT NOT NULL,
  score           NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_score       NUMERIC(5,2) NOT NULL,
  graded_by       UUID REFERENCES profiles(id),
  graded_at       TIMESTAMPTZ DEFAULT now(),
  is_locked       BOOLEAN DEFAULT FALSE,
  UNIQUE(group_id, course_id, deliverable_key)
);


-- ============================================================
-- SEED: Default Grading Components
-- ============================================================

-- CPIS-498 Components (total = 100)
INSERT INTO grading_components (course_type, component_key, component_name, total_marks, evaluator_role, display_order) VALUES
  ('498', 'supervisor_eval',             'Supervisor Evaluation',          18, 'supervisor',  1),
  ('498', 'progress_reports',            'Progress Reports',               22, 'auto',        2),
  ('498', 'committee_eval',              'Examination Committee',          40, 'committee',   3),
  ('498', 'coordinator_deliverables',    'Senior Project Coordinator',     15, 'coordinator', 4),
  ('498', 'peer_review',                 'Peer Review',                     5, 'student',     5)
ON CONFLICT (course_type, component_key) DO UPDATE SET
  component_name = EXCLUDED.component_name,
  total_marks    = EXCLUDED.total_marks,
  evaluator_role = EXCLUDED.evaluator_role,
  display_order  = EXCLUDED.display_order,
  updated_at     = now();

-- CPIS-499 Components (total = 100)
INSERT INTO grading_components (course_type, component_key, component_name, total_marks, evaluator_role, display_order) VALUES
  ('499', 'supervisor_eval',             'Supervisor Group Evaluation',    23, 'supervisor',  1),
  ('499', 'progress_reports',            'Supervisor Weekly Reports',      22, 'auto',        2),
  ('499', 'committee_eval',              'Examination Committee',          40, 'committee',   3),
  ('499', 'coordinator_deliverables',    'Senior Project Coordinator',     10, 'coordinator', 4),
  ('499', 'peer_review',                 'Peer Evaluation',                 5, 'student',     5)
ON CONFLICT (course_type, component_key) DO UPDATE SET
  component_name = EXCLUDED.component_name,
  total_marks    = EXCLUDED.total_marks,
  evaluator_role = EXCLUDED.evaluator_role,
  display_order  = EXCLUDED.display_order,
  updated_at     = now();


-- ============================================================
-- SEED: CPIS-498 Supervisor Rubric (4 × 5 = 20 raw → normalized to 18)
-- ============================================================

INSERT INTO grading_rubric_criteria
  (course_type, component_key, criterion_key, criterion_name, max_raw_score,
   description_1, description_2, description_3, description_4, description_5, display_order)
VALUES
  ('498', 'supervisor_eval', 'literature_review', 'Literature Review', 5,
   'No related work', 'Weak/incomplete review',
   'Adequate review covering main topics', 'Good synthesis of relevant sources',
   'Thorough review with seminal works and critical analysis', 1),
  ('498', 'supervisor_eval', 'system_analysis', 'System Analysis', 5,
   'No requirements identified', 'Weak analysis, missing major requirements',
   'Identifies and prioritizes key requirements', 'Strong analysis with clear documentation',
   'Comprehensive, well-documented with full functional & non-functional requirements', 2),
  ('498', 'supervisor_eval', 'system_design', 'System Design', 5,
   'No architecture or design artifacts', 'Weak design missing major components',
   'Structured and realistic design', 'Well-designed with clear diagrams',
   'Sophisticated, innovative, and fully documented design', 3),
  ('498', 'supervisor_eval', 'technical_writing', 'Technical Writing', 5,
   'Unclear, disorganized writing', 'Frequent grammar and structure errors',
   'Clear with minor issues', 'Professional formatting throughout',
   'Polished, error-free academic writing', 4)
ON CONFLICT (course_type, component_key, criterion_key) DO UPDATE SET
  criterion_name = EXCLUDED.criterion_name, max_raw_score = EXCLUDED.max_raw_score,
  description_1 = EXCLUDED.description_1, description_2 = EXCLUDED.description_2,
  description_3 = EXCLUDED.description_3, description_4 = EXCLUDED.description_4,
  description_5 = EXCLUDED.description_5, display_order = EXCLUDED.display_order,
  updated_at = now();


-- ============================================================
-- SEED: CPIS-498 Committee Rubric (8 × 5 = 40 direct)
-- ============================================================

INSERT INTO grading_rubric_criteria
  (course_type, component_key, criterion_key, criterion_name, max_raw_score,
   description_1, description_2, description_3, description_4, description_5, display_order)
VALUES
  ('498', 'committee_eval', 'problem_definition', 'Problem Definition and Aims', 5,
   'Problem is unclear or trivial', 'Partially defined, limited feasibility',
   'Adequate definition with basic alignment', 'Clear, feasible and well-aligned with objectives',
   'Excellent clarity, strong feasibility and perfect alignment', 1),
  ('498', 'committee_eval', 'literature_review', 'Literature Review', 5,
   'No coverage of related work', 'Superficial coverage',
   'Adequate coverage of main sources', 'Good coverage with relevant comparison',
   'Comprehensive with critical comparison of multiple sources', 2),
  ('498', 'committee_eval', 'methodology', 'Methodology', 5,
   'No methodology described', 'Vague approach with little justification',
   'Clear approach with basic justification', 'Well-justified methodology',
   'Thorough, clearly justified and appropriate methodology', 3),
  ('498', 'committee_eval', 'requirements_analysis', 'Requirements and Analysis', 5,
   'No requirements identified', 'Incomplete functional requirements only',
   'Basic functional and non-functional requirements', 'Complete requirements with priority analysis',
   'Comprehensive, well-prioritized and fully documented', 4),
  ('498', 'committee_eval', 'initial_solution', 'Initial Solution / Design', 5,
   'No design artifacts', 'Incomplete or unrealistic design',
   'Basic architecture with key diagrams', 'Well-designed with clear diagrams and feasibility',
   'Innovative, scalable architecture with detailed justification', 5),
  ('498', 'committee_eval', 'originality', 'Originality / Creativity', 5,
   'No innovative aspect', 'Minor differentiation from existing solutions',
   'Some creative elements with added value', 'Significant original contribution',
   'Highly innovative with clear added value to the field', 6),
  ('498', 'committee_eval', 'report_style', 'Report Style and Format', 5,
   'Poor structure, no referencing', 'Basic structure with frequent formatting issues',
   'Acceptable academic structure', 'Professional formatting with proper referencing',
   'Excellent academic structure, consistent referencing throughout', 7),
  ('498', 'committee_eval', 'presentation_skills', 'Presentation Skills and Responses', 5,
   'Unable to present or answer questions', 'Weak delivery and limited responses',
   'Adequate presentation with basic responses', 'Confident delivery with clear responses',
   'Excellent presentation, highly confident with insightful responses', 8)
ON CONFLICT (course_type, component_key, criterion_key) DO UPDATE SET
  criterion_name = EXCLUDED.criterion_name, max_raw_score = EXCLUDED.max_raw_score,
  description_1 = EXCLUDED.description_1, description_2 = EXCLUDED.description_2,
  description_3 = EXCLUDED.description_3, description_4 = EXCLUDED.description_4,
  description_5 = EXCLUDED.description_5, display_order = EXCLUDED.display_order,
  updated_at = now();


-- ============================================================
-- SEED: CPIS-498 Coordinator Deliverables (total = 15)
-- ============================================================

INSERT INTO grading_rubric_criteria
  (course_type, component_key, criterion_key, criterion_name, max_raw_score, description_1, display_order)
VALUES
  ('498', 'coordinator_deliverables', 'chapter1',             'Chapter 1 — Project Outlines',  2, 'Manual entry by coordinator', 1),
  ('498', 'coordinator_deliverables', 'chapter2',             'Chapter 2 — Literature Review', 2, 'Manual entry by coordinator', 2),
  ('498', 'coordinator_deliverables', 'chapter3',             'Chapter 3 — Analysis',          2, 'Manual entry by coordinator', 3),
  ('498', 'coordinator_deliverables', 'chapter4',             'Chapter 4 — System Design',     2, 'Manual entry by coordinator', 4),
  ('498', 'coordinator_deliverables', 'final_report',         'Final Report',                  3, 'Manual entry by coordinator', 5),
  ('498', 'coordinator_deliverables', 'revised_final_report', 'Revised Final Report',          2, 'Manual entry by coordinator', 6),
  ('498', 'coordinator_deliverables', 'presentation',         'Presentation',                  2, 'Manual entry by coordinator', 7)
ON CONFLICT (course_type, component_key, criterion_key) DO UPDATE SET
  criterion_name = EXCLUDED.criterion_name, max_raw_score = EXCLUDED.max_raw_score,
  display_order = EXCLUDED.display_order, updated_at = now();


-- ============================================================
-- SEED: CPIS-499 Supervisor Rubric (10 × 5 = 50 raw → normalized to 23)
-- ============================================================

INSERT INTO grading_rubric_criteria
  (course_type, component_key, criterion_key, criterion_name, max_raw_score,
   description_1, description_2, description_3, description_4, description_5, display_order)
VALUES
  ('499', 'supervisor_eval', 'attendance', 'Attendance to Meetings', 5,
   'Rarely attends meetings', 'Attends less than half of meetings',
   'Attends most meetings', 'Attends almost all meetings',
   'Attends all scheduled meetings without exception', 1),
  ('499', 'supervisor_eval', 'ethics', 'Ethics', 5,
   'Unprofessional behavior observed', 'Occasional lapses in professional conduct',
   'Generally ethical conduct', 'Consistently ethical and professional',
   'Exemplary ethical conduct and academic integrity', 2),
  ('499', 'supervisor_eval', 'soft_skills', 'Soft Skills', 5,
   'Poor communication and interpersonal skills', 'Limited communication effectiveness',
   'Adequate communication skills', 'Good professional communication',
   'Excellent communication, presentation and leadership skills', 3),
  ('499', 'supervisor_eval', 'teamwork', 'Teamwork and Engagement (SO4)', 5,
   'Does not contribute to team efforts', 'Minimal participation in team activities',
   'Adequate teamwork participation', 'Strong team contributions',
   'Outstanding collaborative engagement and leadership', 4),
  ('499', 'supervisor_eval', 'response_tasks', 'Response to Tasks', 5,
   'Does not complete assigned tasks', 'Frequently late or incomplete',
   'Completes tasks adequately', 'Timely and quality task completion',
   'Exceeds task expectations with proactive initiative', 5),
  ('499', 'supervisor_eval', 'implementation', 'Implementation', 5,
   'Little to no implementation progress', 'Basic incomplete implementation',
   'Core features implemented', 'Complete functional implementation',
   'Comprehensive, high-quality implementation exceeding requirements', 6),
  ('499', 'supervisor_eval', 'testing', 'Testing', 5,
   'No testing performed', 'Minimal ad-hoc testing',
   'Basic functional testing', 'Systematic test plan and execution',
   'Comprehensive testing with full documentation and coverage', 7),
  ('499', 'supervisor_eval', 'report_style', 'Report Style and Format', 5,
   'Poor document quality and structure', 'Basic structure with major formatting issues',
   'Acceptable academic format', 'Professional academic report',
   'Excellent academic writing with consistent professional formatting', 8),
  ('499', 'supervisor_eval', 'plagiarism', 'Overall Plagiarism Check', 5,
   'High similarity index (>30%)', 'Significant similarity issues (20-30%)',
   'Acceptable similarity level (10-20%)', 'Low similarity (<10%) with proper citations',
   'Minimal similarity with exemplary citation practices', 9),
  ('499', 'supervisor_eval', 'peer_evaluation', 'Peer Evaluation (from teammates)', 5,
   'Very poor peer ratings', 'Below average peer ratings',
   'Average peer ratings', 'Above average peer ratings',
   'Excellent peer ratings from all team members', 10)
ON CONFLICT (course_type, component_key, criterion_key) DO UPDATE SET
  criterion_name = EXCLUDED.criterion_name, max_raw_score = EXCLUDED.max_raw_score,
  description_1 = EXCLUDED.description_1, description_2 = EXCLUDED.description_2,
  description_3 = EXCLUDED.description_3, description_4 = EXCLUDED.description_4,
  description_5 = EXCLUDED.description_5, display_order = EXCLUDED.display_order,
  updated_at = now();


-- ============================================================
-- SEED: CPIS-499 Committee Rubric (8 × 5 = 40 direct)
-- ============================================================

INSERT INTO grading_rubric_criteria
  (course_type, component_key, criterion_key, criterion_name, max_raw_score,
   description_1, description_2, description_3, description_4, description_5, display_order)
VALUES
  ('499', 'committee_eval', 'detailed_design', 'Detailed Design', 5,
   'No design documentation', 'Incomplete design missing major components',
   'Basic design with core architecture', 'Complete design with scalability consideration',
   'Comprehensive scalable architecture with full documentation', 1),
  ('499', 'committee_eval', 'implementation', 'Implementation', 5,
   'Little to no functional implementation', 'Incomplete implementation with major gaps',
   'Core features implemented and functional', 'Complete implementation with good code quality',
   'High-quality, feature-complete implementation exceeding requirements', 2),
  ('499', 'committee_eval', 'testing', 'Testing', 5,
   'No test plan or execution', 'Minimal ad-hoc testing',
   'Basic test plan with key scenarios', 'Systematic testing with good coverage',
   'Comprehensive test plan, full coverage and documented results', 3),
  ('499', 'committee_eval', 'project_results', 'Project Results', 5,
   'No meaningful results', 'Results below expectations',
   'Adequate results meeting basic requirements', 'Good results demonstrating strong performance',
   'Excellent results with performance benchmarks', 4),
  ('499', 'committee_eval', 'conclusion_future', 'Conclusion and Future Works', 5,
   'No conclusion or future work', 'Superficial conclusion',
   'Adequate conclusion with basic future plans', 'Reflective conclusion with realistic improvements',
   'Insightful conclusion with well-justified future roadmap', 5),
  ('499', 'committee_eval', 'technicality', 'Technicality and Complexity', 5,
   'No advanced techniques used', 'Basic technology with minimal complexity',
   'Appropriate technology selection', 'Advanced techniques applied effectively',
   'Highly technical with innovative application of advanced techniques', 6),
  ('499', 'committee_eval', 'documentation', 'Documentation (Style and Format)', 5,
   'Poor or missing documentation', 'Basic documentation with major issues',
   'Acceptable professional documentation', 'Professional academic documentation',
   'Outstanding documentation following all academic standards', 7),
  ('499', 'committee_eval', 'presentation_knowledge', 'Presentation and In-depth Knowledge', 5,
   'Unable to defend or present', 'Weak presentation with poor question handling',
   'Adequate presentation with basic responses', 'Confident presentation with clear technical responses',
   'Excellent defense with deep technical knowledge demonstrated', 8)
ON CONFLICT (course_type, component_key, criterion_key) DO UPDATE SET
  criterion_name = EXCLUDED.criterion_name, max_raw_score = EXCLUDED.max_raw_score,
  description_1 = EXCLUDED.description_1, description_2 = EXCLUDED.description_2,
  description_3 = EXCLUDED.description_3, description_4 = EXCLUDED.description_4,
  description_5 = EXCLUDED.description_5, display_order = EXCLUDED.display_order,
  updated_at = now();


-- ============================================================
-- SEED: CPIS-499 Coordinator Deliverables (total = 10)
-- ============================================================

INSERT INTO grading_rubric_criteria
  (course_type, component_key, criterion_key, criterion_name, max_raw_score, description_1, display_order)
VALUES
  ('499', 'coordinator_deliverables', 'demo1',                  'Demo 1',                   2, 'Manual entry by coordinator', 1),
  ('499', 'coordinator_deliverables', 'demo2',                  'Demo 2',                   2, 'Manual entry by coordinator', 2),
  ('499', 'coordinator_deliverables', 'poster_day',             'Poster Day',               2, 'Manual entry by coordinator', 3),
  ('499', 'coordinator_deliverables', 'chapter_implementation', 'Chapter Implementation',   2, 'Manual entry by coordinator', 4),
  ('499', 'coordinator_deliverables', 'chapter_testing',        'Chapter Testing',          2, 'Manual entry by coordinator', 5)
ON CONFLICT (course_type, component_key, criterion_key) DO UPDATE SET
  criterion_name = EXCLUDED.criterion_name, max_raw_score = EXCLUDED.max_raw_score,
  display_order = EXCLUDED.display_order, updated_at = now();


-- ============================================================
-- Enable Row Level Security
-- ============================================================

ALTER TABLE grading_rubric_criteria        ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_components             ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_rubric_scores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_rubric_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE coordinator_deliverable_scores ENABLE ROW LEVEL SECURITY;

-- Public read (authenticated)
CREATE POLICY "read_rubric_criteria"    ON grading_rubric_criteria        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_grading_components" ON grading_components             FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_sup_rubric"         ON supervisor_rubric_scores       FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_comm_rubric"        ON committee_rubric_scores        FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_coord_deliverables" ON coordinator_deliverable_scores FOR SELECT USING (auth.role() = 'authenticated');

-- Helper: true when the current user is a coordinator or admin.
-- Checks BOTH profiles.role (cast to text to avoid enum type mismatch)
-- AND the authoritative user_roles + roles join table.
CREATE OR REPLACE FUNCTION is_coordinator_or_admin() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role::text IN ('coordinator', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('coordinator', 'admin')
    );
$$;

-- Write policies
CREATE POLICY "write_rubric_criteria" ON grading_rubric_criteria FOR ALL
  USING (is_coordinator_or_admin());

CREATE POLICY "write_grading_components" ON grading_components FOR ALL
  USING (is_coordinator_or_admin());

CREATE POLICY "write_sup_rubric" ON supervisor_rubric_scores FOR ALL
  USING (graded_by = auth.uid() OR is_coordinator_or_admin());

CREATE POLICY "write_comm_rubric" ON committee_rubric_scores FOR ALL
  USING (evaluator_id = auth.uid() OR is_coordinator_or_admin());

CREATE POLICY "write_coord_deliverables" ON coordinator_deliverable_scores FOR ALL
  USING (graded_by = auth.uid() OR is_coordinator_or_admin());
