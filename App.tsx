import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './lib/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Auth
import { Login } from './pages/Login';

// Student Pages
import { StudentDashboard } from './pages/student/Dashboard';
import { StudentMilestones } from './pages/student/Milestones';
import { StudentWeeklyReports } from './pages/student/WeeklyReports';
import { StudentSubmissionDetail } from './pages/student/SubmissionDetail';
import { StudentFeedback } from './pages/student/Feedback';
import { StudentGradesOverview } from './pages/student/GradesOverview';
import { StudentPeerFeedback } from './pages/student/PeerFeedback';
import { StudentPresentationSelection } from './pages/student/PresentationSelection';
import { StudentMyPresentation } from './pages/student/MyPresentation';

// Supervisor Pages
import { SupervisorDashboard } from './pages/supervisor/Dashboard';
import { SupervisorSubmissionReview } from './pages/supervisor/SubmissionReview';
import { SupervisorMyGroupsAndReviews } from './pages/supervisor/MyGroupsAndReviews';
import { SupervisorWeeklyReports } from './pages/supervisor/WeeklyReports';
import { SupervisorGradingAssessment } from './pages/supervisor/GradingAssessment';
import { SupervisorGradesCommittee } from './pages/supervisor/GradesCommittee';
import { SupervisorEvaluation } from './pages/supervisor/Evaluation';
import { SupervisorMyAvailability } from './pages/supervisor/MyAvailability';
import { SupervisorGradingEvaluation } from './pages/supervisor/GradingEvaluation';

// Admin Pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { AdminMilestonesConfig } from './pages/admin/MilestonesConfig';
import { AdminExportsAudit } from './pages/admin/ExportsAudit';
import { AnnouncementsManager } from './pages/admin/AnnouncementsManager';
import { ImportantFilesManager } from './pages/admin/ImportantFilesManager';
import { AdminUserManagement } from './pages/admin/UserManagement';
import { AdminWeeklyReports } from './pages/admin/WeeklyReports';
import { AdminGradesDeliverables } from './pages/admin/GradesDeliverables';
import { AdminPresentationAndCommittee } from './pages/admin/PresentationAndCommittee';
import { AdminPresentationCommittee } from './pages/admin/PresentationCommittee';

// Shared Pages
import { Calendar } from './pages/shared/Calendar';
import { Settings } from './pages/shared/Settings';
import { Announcements } from './pages/shared/Announcements';
import { ImportantFiles } from './pages/shared/ImportantFiles';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Student Routes */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/milestones" element={<ProtectedRoute allowedRoles={['student']}><StudentMilestones /></ProtectedRoute>} />
          <Route path="/student/weekly-reports" element={<ProtectedRoute allowedRoles={['student']}><StudentWeeklyReports /></ProtectedRoute>} />
          <Route path="/student/submissions/:id" element={<ProtectedRoute allowedRoles={['student']}><StudentSubmissionDetail /></ProtectedRoute>} />
          <Route path="/student/feedback" element={<ProtectedRoute allowedRoles={['student']}><StudentFeedback /></ProtectedRoute>} />
          <Route path="/student/grades" element={<ProtectedRoute allowedRoles={['student']}><StudentGradesOverview /></ProtectedRoute>} />
          <Route path="/student/peer-feedback" element={<ProtectedRoute allowedRoles={['student']}><StudentPeerFeedback /></ProtectedRoute>} />
          <Route path="/student/presentation-selection" element={<ProtectedRoute allowedRoles={['student']}><StudentPresentationSelection /></ProtectedRoute>} />
          <Route path="/student/my-presentation" element={<ProtectedRoute allowedRoles={['student']}><StudentMyPresentation /></ProtectedRoute>} />
          <Route path="/student/announcements" element={<ProtectedRoute allowedRoles={['student']}><Announcements userRole="student" /></ProtectedRoute>} />
          <Route path="/student/calendar" element={<ProtectedRoute allowedRoles={['student']}><Calendar userRole="student" /></ProtectedRoute>} />
          <Route path="/student/important-files" element={<ProtectedRoute allowedRoles={['student']}><ImportantFiles userRole="student" /></ProtectedRoute>} />

          {/* Supervisor Routes */}
          <Route path="/supervisor" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorDashboard /></ProtectedRoute>} />
          <Route path="/supervisor/groups" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorMyGroupsAndReviews /></ProtectedRoute>} />
          <Route path="/supervisor/review/:id" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorSubmissionReview /></ProtectedRoute>} />
          <Route path="/supervisor/weekly-reports" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorWeeklyReports /></ProtectedRoute>} />
          <Route path="/supervisor/grading" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorGradingAssessment /></ProtectedRoute>} />
          <Route path="/supervisor/committee" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorGradesCommittee /></ProtectedRoute>} />
          <Route path="/supervisor/weekly-report/:id" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorMyGroupsAndReviews /></ProtectedRoute>} />
          <Route path="/supervisor/schedule" element={<ProtectedRoute allowedRoles={['supervisor']}><Calendar userRole="supervisor" /></ProtectedRoute>} />
          <Route path="/supervisor/announcements" element={<ProtectedRoute allowedRoles={['supervisor']}><Announcements userRole="supervisor" /></ProtectedRoute>} />
          <Route path="/supervisor/important-files" element={<ProtectedRoute allowedRoles={['supervisor']}><ImportantFiles userRole="supervisor" /></ProtectedRoute>} />
          <Route path="/supervisor/evaluation" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorEvaluation /></ProtectedRoute>} />
          <Route path="/supervisor/my-availability" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorMyAvailability /></ProtectedRoute>} />
          <Route path="/supervisor/grading-evaluation" element={<ProtectedRoute allowedRoles={['supervisor']}><SupervisorGradingEvaluation /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/milestones" element={<ProtectedRoute allowedRoles={['admin']}><AdminMilestonesConfig /></ProtectedRoute>} />
          <Route path="/admin/weekly-reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminWeeklyReports /></ProtectedRoute>} />
          <Route path="/admin/grades-deliverables" element={<ProtectedRoute allowedRoles={['admin']}><AdminGradesDeliverables /></ProtectedRoute>} />
          <Route path="/admin/presentation-committee" element={<ProtectedRoute allowedRoles={['admin']}><AdminPresentationCommittee /></ProtectedRoute>} />
          <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AnnouncementsManager /></ProtectedRoute>} />
          <Route path="/admin/exports" element={<ProtectedRoute allowedRoles={['admin']}><AdminExportsAudit /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AdminUserManagement /></ProtectedRoute>} />
          <Route path="/admin/calendar" element={<ProtectedRoute allowedRoles={['admin']}><Calendar userRole="admin" /></ProtectedRoute>} />
          <Route path="/admin/important-files" element={<ProtectedRoute allowedRoles={['admin']}><ImportantFilesManager /></ProtectedRoute>} />

          {/* Settings Routes by Role */}
          <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['student']}><Settings userRole="student" /></ProtectedRoute>} />
          <Route path="/supervisor/settings" element={<ProtectedRoute allowedRoles={['supervisor']}><Settings userRole="supervisor" /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><Settings userRole="admin" /></ProtectedRoute>} />
          <Route path="/settings" element={<Navigate to="/login" replace />} />

          {/* Catch-all route for unmatched paths */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>

        <Toaster position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}