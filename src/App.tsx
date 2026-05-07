import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './lib/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// ── Auth ──────────────────────────────────────────────────────────────────────
import { Login } from './features/auth/components/Login';
import { Register } from './features/auth/components/Register';
import { AccountConfirmed } from './features/auth/components/AccountConfirmed';
import { ForgotPassword } from './features/auth/components/ForgotPassword';
import { ResetPassword } from './features/auth/components/ResetPassword';

// ── Shared pages ──────────────────────────────────────────────────────────────
import { Calendar } from './pages/shared/Calendar';
import { Settings } from './pages/shared/Settings';
import { Announcements } from './pages/shared/Announcements';
import { ImportantFiles } from './pages/shared/ImportantFiles';
import { ContactUs } from './pages/shared/ContactUs';

// ── Student pages ─────────────────────────────────────────────────────────────
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentMilestones } from './pages/student/Milestones';
import { StudentWeeklyReports } from './pages/student/WeeklyReports';
import { StudentSubmissionDetail } from './pages/student/SubmissionDetail';
import { StudentFeedback } from './pages/student/Feedback';
import { StudentGradesOverview } from './pages/student/GradesOverview';
import { StudentPresentationSelection } from './pages/student/PresentationSelection';
import { StudentMyPresentation } from './pages/student/MyPresentation';
import { StudentMeetings } from './pages/student/Meetings';

// ── Supervisor pages ──────────────────────────────────────────────────────────
import { SupervisorDashboard } from './pages/supervisor/Dashboard';
import { SupervisorSubmissionReview } from './pages/supervisor/SubmissionReview';
import { SupervisorMyGroupsAndReviews } from './pages/supervisor/MyGroupsAndReviews';
import { SupervisorWeeklyReports } from './pages/supervisor/WeeklyReports';
import { SupervisorGradingAssessment } from './pages/supervisor/GradingAssessment';
import { SupervisorGradesCommittee } from './pages/supervisor/GradesCommittee';
import { SupervisorEvaluation } from './pages/supervisor/Evaluation';
import { SupervisorMyAvailability } from './pages/supervisor/MyAvailability';
import { SupervisorGradingEvaluation } from './pages/supervisor/GradingEvaluation';
import { SupervisorEvaluateGroup } from './pages/supervisor/EvaluateGroup';
import { SupervisorMeetings } from './pages/supervisor/Meetings';

// ── Coordinator pages ─────────────────────────────────────────────────────────
import { CoordinatorDashboard } from './pages/coordinator/Dashboard';
import { CoordinatorApprovals } from './pages/coordinator/Approvals';
import { CoordinatorWeeklyReports } from './pages/coordinator/WeeklyReports';
import { CoordinatorMilestonesConfig } from './pages/coordinator/MilestonesConfig';
import { CoordinatorSupervisors } from './pages/coordinator/Supervisors';
import { CoordinatorWeekManager } from './pages/coordinator/WeekManager';
import { CoordinatorLateRequests } from './pages/coordinator/LateRequests';
import { CoordinatorCommitteeScores } from './pages/coordinator/CommitteeScores';
import { CoordinatorGradeSchemeEditor } from './pages/coordinator/GradeSchemeEditor';
import { CoordinatorCourseGrades } from './pages/coordinator/CoordinatorCourseGrades';
import { CoordinatorEvaluateGroup } from './pages/coordinator/CoordinatorEvaluateGroup';
import { AnnouncementsManager } from './pages/admin/AnnouncementsManager';
import { CoordinatorMeetings } from './pages/coordinator/Meetings';

// ── Admin pages ───────────────────────────────────────────────────────────────
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminMilestonesConfig } from './pages/admin/MilestonesConfig';
import { AdminExportsAudit } from './pages/admin/ExportsAudit';
import { ImportantFilesManager } from './pages/admin/ImportantFilesManager';
import { AdminUserManagement } from './pages/admin/UserManagement';
import { AdminWeeklyReports } from './pages/admin/WeeklyReports';
import { AdminGradesDeliverables } from './pages/admin/GradesDeliverables';
import { AdminCourseGrades } from './pages/admin/AdminCourseGrades';
import { AdminPresentationCommittee } from './pages/admin/PresentationCommittee';
import { AdminLockManager } from './pages/admin/LockManager';
import { AdminTermMigration } from './pages/admin/TermMigration';
import { AdminTermHistory } from './pages/admin/TermHistory';

// Coordinator can access its own routes; admin has full override
const COORDINATOR_ROLES = ['coordinator', 'admin'] as const;
const SUPERVISOR_ROLES   = ['supervisor', 'admin'] as const;

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Auth ── */}
          <Route path="/login"             element={<Login />} />
          <Route path="/register"          element={<Register />} />
          <Route path="/account-confirmed" element={<AccountConfirmed />} />
          <Route path="/forgot-password"   element={<ForgotPassword />} />
          <Route path="/reset-password"    element={<ResetPassword />} />
          <Route path="/"                  element={<Navigate to="/login" replace />} />

          {/* ── Student Routes ── */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/milestones" element={<ProtectedRoute allowedRoles={['student']}><StudentMilestones /></ProtectedRoute>} />
          <Route path="/student/weekly-reports" element={<ProtectedRoute allowedRoles={['student']}><StudentWeeklyReports /></ProtectedRoute>} />
          <Route path="/student/submissions/:id" element={<ProtectedRoute allowedRoles={['student']}><StudentSubmissionDetail /></ProtectedRoute>} />
          <Route path="/student/feedback" element={<ProtectedRoute allowedRoles={['student']}><StudentFeedback /></ProtectedRoute>} />
          <Route path="/student/grades" element={<ProtectedRoute allowedRoles={['student']}><StudentGradesOverview /></ProtectedRoute>} />
          <Route path="/student/presentation-selection" element={<ProtectedRoute allowedRoles={['student']}><StudentPresentationSelection /></ProtectedRoute>} />
          <Route path="/student/my-presentation" element={<ProtectedRoute allowedRoles={['student']}><StudentMyPresentation /></ProtectedRoute>} />
          <Route path="/student/announcements" element={<ProtectedRoute allowedRoles={['student']}><Announcements /></ProtectedRoute>} />
          <Route path="/student/calendar" element={<ProtectedRoute allowedRoles={['student']}><Calendar /></ProtectedRoute>} />
          <Route path="/student/important-files" element={<ProtectedRoute allowedRoles={['student']}><ImportantFiles /></ProtectedRoute>} />
          <Route path="/student/meetings"       element={<ProtectedRoute allowedRoles={['student']}><StudentMeetings /></ProtectedRoute>} />
          <Route path="/student/settings"      element={<ProtectedRoute allowedRoles={['student']}><Settings /></ProtectedRoute>} />
          <Route path="/student/contact"       element={<ProtectedRoute allowedRoles={['student']}><ContactUs /></ProtectedRoute>} />

          {/* ── Supervisor Routes ── */}
          <Route path="/supervisor" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorDashboard /></ProtectedRoute>} />
          <Route path="/supervisor/groups" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorMyGroupsAndReviews /></ProtectedRoute>} />
          <Route path="/supervisor/review/:id" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorSubmissionReview /></ProtectedRoute>} />
          <Route path="/supervisor/weekly-reports" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorWeeklyReports /></ProtectedRoute>} />
          <Route path="/supervisor/grading" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorGradingAssessment /></ProtectedRoute>} />
          <Route path="/supervisor/committee" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorGradesCommittee /></ProtectedRoute>} />
          <Route path="/supervisor/weekly-report/:id" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorMyGroupsAndReviews /></ProtectedRoute>} />
          <Route path="/supervisor/schedule" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><Calendar /></ProtectedRoute>} />
          <Route path="/supervisor/announcements" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><Announcements /></ProtectedRoute>} />
          <Route path="/supervisor/important-files" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><ImportantFiles /></ProtectedRoute>} />
          <Route path="/supervisor/evaluation" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorEvaluation /></ProtectedRoute>} />
          <Route path="/supervisor/my-availability" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorMyAvailability /></ProtectedRoute>} />
          <Route path="/supervisor/grading-evaluation" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorGradingEvaluation /></ProtectedRoute>} />
          <Route path="/supervisor/evaluate-group/:groupId" element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorEvaluateGroup /></ProtectedRoute>} />
          <Route path="/supervisor/meetings"  element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><SupervisorMeetings /></ProtectedRoute>} />
          <Route path="/supervisor/settings"  element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><Settings /></ProtectedRoute>} />
          <Route path="/supervisor/contact"  element={<ProtectedRoute allowedRoles={[...SUPERVISOR_ROLES]}><ContactUs /></ProtectedRoute>} />

          {/* ── Coordinator Routes ── */}
          <Route path="/coordinator" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorDashboard /></ProtectedRoute>} />
          <Route path="/coordinator/approvals" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorApprovals /></ProtectedRoute>} />
          <Route path="/coordinator/weekly-reports" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorWeeklyReports /></ProtectedRoute>} />
          <Route path="/coordinator/milestones" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorMilestonesConfig /></ProtectedRoute>} />
          <Route path="/coordinator/supervisors" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorSupervisors /></ProtectedRoute>} />
          <Route path="/coordinator/grades" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorCourseGrades /></ProtectedRoute>} />
          <Route path="/coordinator/week-manager" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorWeekManager /></ProtectedRoute>} />
          <Route path="/coordinator/late-requests" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorLateRequests /></ProtectedRoute>} />
          <Route path="/coordinator/committee-scores" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorCommitteeScores /></ProtectedRoute>} />
          <Route path="/coordinator/grade-scheme" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorGradeSchemeEditor /></ProtectedRoute>} />
          <Route path="/coordinator/evaluate-group/:groupId" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorEvaluateGroup /></ProtectedRoute>} />
          <Route path="/coordinator/announcements" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><AnnouncementsManager /></ProtectedRoute>} />
          <Route path="/coordinator/calendar" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><Calendar /></ProtectedRoute>} />
          <Route path="/coordinator/meetings" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><CoordinatorMeetings /></ProtectedRoute>} />
          <Route path="/coordinator/settings" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><Settings /></ProtectedRoute>} />
          <Route path="/coordinator/contact" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><ContactUs /></ProtectedRoute>} />

          {/* ── Admin Routes ── */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/milestones" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><AdminMilestonesConfig /></ProtectedRoute>} />
          <Route path="/admin/weekly-reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminWeeklyReports /></ProtectedRoute>} />
          <Route path="/admin/grades-deliverables" element={<ProtectedRoute allowedRoles={['admin']}><AdminGradesDeliverables /></ProtectedRoute>} />
          <Route path="/admin/course-grades" element={<ProtectedRoute allowedRoles={['admin']}><AdminCourseGrades /></ProtectedRoute>} />
          <Route path="/admin/presentation-committee" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><AdminPresentationCommittee /></ProtectedRoute>} />
          <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AnnouncementsManager /></ProtectedRoute>} />
          <Route path="/admin/exports" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><AdminExportsAudit /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><AdminUserManagement /></ProtectedRoute>} />
          <Route path="/admin/calendar" element={<ProtectedRoute allowedRoles={['admin']}><Calendar /></ProtectedRoute>} />
          <Route path="/admin/important-files" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><ImportantFilesManager /></ProtectedRoute>} />
          <Route path="/admin/locks" element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><AdminLockManager /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>} />
          <Route path="/admin/term-migration" element={<ProtectedRoute allowedRoles={['admin']}><AdminTermMigration /></ProtectedRoute>} />
          <Route path="/admin/term-history"   element={<ProtectedRoute allowedRoles={[...COORDINATOR_ROLES]}><AdminTermHistory /></ProtectedRoute>} />
          <Route path="/admin/contact"  element={<ProtectedRoute allowedRoles={['admin']}><ContactUs /></ProtectedRoute>} />

          {/* Legacy / catch-all */}
          <Route path="/settings" element={<Navigate to="/login" replace />} />
          <Route path="*"         element={<Navigate to="/login" replace />} />
        </Routes>

        <Toaster position="top-center" />
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
