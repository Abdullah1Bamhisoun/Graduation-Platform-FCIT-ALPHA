import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';

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
      <Routes>
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Student Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/milestones" element={<StudentMilestones />} />
        <Route path="/student/weekly-reports" element={<StudentWeeklyReports />} />
        <Route path="/student/submissions/:id" element={<StudentSubmissionDetail />} />
        <Route path="/student/feedback" element={<StudentFeedback />} />
        <Route path="/student/grades" element={<StudentGradesOverview />} />
        <Route path="/student/peer-feedback" element={<StudentPeerFeedback />} />
        <Route path="/student/presentation-selection" element={<StudentPresentationSelection />} />
        <Route path="/student/my-presentation" element={<StudentMyPresentation />} />
        <Route path="/student/announcements" element={<Announcements userRole="student" />} />
        <Route path="/student/calendar" element={<Calendar userRole="student" />} />
        <Route path="/student/important-files" element={<ImportantFiles userRole="student" />} />

        {/* Supervisor Routes */}
        <Route path="/supervisor" element={<SupervisorDashboard />} />
        <Route path="/supervisor/groups" element={<SupervisorMyGroupsAndReviews />} />
        <Route path="/supervisor/review/:id" element={<SupervisorSubmissionReview />} />
        <Route path="/supervisor/weekly-reports" element={<SupervisorWeeklyReports />} />
        <Route path="/supervisor/grading" element={<SupervisorGradingAssessment />} />
        <Route path="/supervisor/committee" element={<SupervisorGradesCommittee />} />
        <Route path="/supervisor/weekly-report/:id" element={<SupervisorMyGroupsAndReviews />} />
        <Route path="/supervisor/schedule" element={<Calendar userRole="supervisor" />} />
        <Route path="/supervisor/announcements" element={<Announcements userRole="supervisor" />} />
        <Route path="/supervisor/important-files" element={<ImportantFiles userRole="supervisor" />} />
        <Route path="/supervisor/evaluation" element={<SupervisorEvaluation />} />
        <Route path="/supervisor/my-availability" element={<SupervisorMyAvailability />} />
        <Route path="/supervisor/grading-evaluation" element={<SupervisorGradingEvaluation />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/milestones" element={<AdminMilestonesConfig />} />
        <Route path="/admin/weekly-reports" element={<AdminWeeklyReports />} />
        <Route path="/admin/grades-deliverables" element={<AdminGradesDeliverables />} />
        <Route path="/admin/presentation-committee" element={<AdminPresentationCommittee />} />
        <Route path="/admin/announcements" element={<AnnouncementsManager />} />
        <Route path="/admin/exports" element={<AdminExportsAudit />} />
        <Route path="/admin/users" element={<AdminUserManagement />} />
        <Route path="/admin/calendar" element={<Calendar userRole="admin" />} />
        <Route path="/admin/important-files" element={<ImportantFilesManager />} />

        {/* Settings Routes by Role */}
        <Route path="/student/settings" element={<Settings userRole="student" />} />
        <Route path="/supervisor/settings" element={<Settings userRole="supervisor" />} />
        <Route path="/admin/settings" element={<Settings userRole="admin" />} />
        <Route path="/settings" element={<Navigate to="/login" replace />} />

        {/* Catch-all route for unmatched paths */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}