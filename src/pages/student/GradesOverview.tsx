import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getStudentGrade, getGroupGrade } from '../../services/grades';
import { getGroupForStudent } from '../../services/groups';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { StudentGrade, GroupGrade } from '../../types';

export function StudentGradesOverview() {
  const { user } = useAuth();
  const [studentGrade, setStudentGrade] = useState<StudentGrade | null>(null);
  const [groupGrade, setGroupGrade] = useState<GroupGrade | null>(null);
  const [courseCode, setCourseCode] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const group = await getGroupForStudent(user.id);
        // Derive course code from the group's actual courseCode, falling back to a sensible default
        const resolvedCourseCode = group?.courseCode || 'CPIS-498';
        setCourseCode(resolvedCourseCode);
        const courseCode = resolvedCourseCode;
        const [sg, gg] = await Promise.all([
          getStudentGrade(user.id, courseCode),
          group ? getGroupGrade(group.id, courseCode) : null,
        ]);
        setStudentGrade(sg);
        setGroupGrade(gg);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="My Grades"><div className="p-6">Loading...</div></Layout>;

  if (!studentGrade || !groupGrade) {
    return (
      <Layout user={user} pageTitle="My Grades">
        <div className="text-center py-12">
          <p className="text-[var(--color-text-600)]">No grade data available</p>
        </div>
      </Layout>
    );
  }

  const getDeliverableIcon = (status: string) => {
    switch (status) {
      case 'graded':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'submitted':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'not-submitted':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-50 text-green-600 border border-green-200">Graded</span>;
      case 'submitted':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">Pending</span>;
      case 'not-submitted':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-50 text-gray-600 border border-gray-200">Not Submitted</span>;
      default:
        return null;
    }
  };

  const getGradeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  // Get supervisor assessment from group grade
  const supervisorScore = groupGrade.supervisorAssessment[studentGrade.studentId]?.score || 0;
  
  // Calculate total score from all components
  const totalScore = 
    (groupGrade.deliverablesTotal || 0) + 
    (groupGrade.weeklyProgress.score || 0) + 
    supervisorScore + 
    (studentGrade.committeeEvaluation.score || 0) + 
    (studentGrade.peerFeedback.score || 0);

  return (
    <Layout user={user} pageTitle={`My Grades${courseCode ? ` — ${courseCode}` : ''}`}>
      <div className="mb-6">
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[var(--color-text-900)] mb-1">{studentGrade.studentName}</h2>
              <p className="text-[var(--color-text-600)]">
                Student ID: {studentGrade.studentId} | Group: {studentGrade.groupId}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-5xl mb-2 ${getGradeColor(totalScore)}`}>
                {totalScore.toFixed(1)}%
              </div>
              <div className="text-[var(--color-text-600)]">Current Grade</div>
            </div>
          </div>
        </div>
      </div>

      {/* Assessment Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        {/* Deliverables */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[var(--color-text-900)]">Course Deliverables</h3>
            <span className="text-[var(--color-text-600)]">15%</span>
          </div>
          <div className="text-3xl text-[var(--color-text-900)] mb-2">
            {groupGrade.deliverablesTotal}/15
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(groupGrade.deliverablesTotal / 15) * 100}%` }}
            />
          </div>
          <p className="text-[var(--color-text-600)]">Group grade</p>
        </div>

        {/* Weekly Progress */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[var(--color-text-900)]">Weekly Progress</h3>
            <span className="text-[var(--color-text-600)]">20%</span>
          </div>
          <div className="text-3xl text-[var(--color-text-900)] mb-2">
            {groupGrade.weeklyProgress.score || 0}/20
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${((groupGrade.weeklyProgress.score || 0) / 20) * 100}%` }}
            />
          </div>
          <p className="text-[var(--color-text-600)]">
            {groupGrade.weeklyProgress.reportsSubmitted}/{groupGrade.weeklyProgress.totalReports} reports submitted (Group)
          </p>
        </div>

        {/* Supervisor Assessment */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[var(--color-text-900)]">Supervisor Assessment</h3>
            <span className="text-[var(--color-text-600)]">20%</span>
          </div>
          <div className="text-3xl text-[var(--color-text-900)] mb-2">
            {supervisorScore}/20
          </div>
          {supervisorScore > 0 ? (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all"
                style={{ width: `${(supervisorScore / 20) * 100}%` }}
              />
            </div>
          ) : (
            <p className="text-[var(--color-text-600)]">Not graded yet</p>
          )}
        </div>

        {/* Committee Evaluation */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[var(--color-text-900)]">Committee Evaluation</h3>
            <span className="text-[var(--color-text-600)]">40%</span>
          </div>
          <div className="text-3xl text-[var(--color-text-900)] mb-2">
            {studentGrade.committeeEvaluation.score !== undefined ? studentGrade.committeeEvaluation.score : '-'}/40
          </div>
          {studentGrade.committeeEvaluation.score !== undefined ? (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-orange-600 h-2 rounded-full transition-all"
                style={{ width: `${(studentGrade.committeeEvaluation.score / 40) * 100}%` }}
              />
            </div>
          ) : (
            <p className="text-[var(--color-text-600)]">Not evaluated yet</p>
          )}
        </div>

        {/* Peer Feedback */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[var(--color-text-900)]">Peer Feedback</h3>
            <span className="text-[var(--color-text-600)]">5%</span>
          </div>
          <div className="text-3xl text-[var(--color-text-900)] mb-2">
            {studentGrade.peerFeedback.score !== undefined ? studentGrade.peerFeedback.score : '-'}/5
          </div>
          {studentGrade.peerFeedback.score !== undefined ? (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-pink-600 h-2 rounded-full transition-all"
                style={{ width: `${(studentGrade.peerFeedback.score / 5) * 100}%` }}
              />
            </div>
          ) : (
            <p className="text-[var(--color-text-600)]">Not submitted yet</p>
          )}
        </div>

        {/* Total */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[var(--color-text-900)]">Total Score</h3>
            <span className="text-[var(--color-text-600)]">100%</span>
          </div>
          <div className={`text-4xl mb-2 ${getGradeColor(totalScore)}`}>
            {totalScore.toFixed(1)}/100
          </div>
          <div className="text-[var(--color-text-900)]">
            Final Grade: {studentGrade.finalGrade}
          </div>
        </div>
      </div>

      {/* Deliverables Detail */}
      <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm mb-6">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h3 className="text-[var(--color-text-900)]">Course Deliverables Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-alt)]">
              <tr>
                <th className="p-4 text-left text-[var(--color-text-900)]">Deliverable</th>
                <th className="p-4 text-center text-[var(--color-text-900)]">Status</th>
                <th className="p-4 text-center text-[var(--color-text-900)]">Score</th>
                <th className="p-4 text-center text-[var(--color-text-900)]">Max</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              <tr>
                <td className="p-4 flex items-center gap-3">
                  {getDeliverableIcon(groupGrade.deliverables.chapter1.status)}
                  <span className="text-[var(--color-text-900)]">Chapter 1 (Project Outlines)</span>
                </td>
                <td className="p-4 text-center">{getStatusBadge(groupGrade.deliverables.chapter1.status)}</td>
                <td className="p-4 text-center text-[var(--color-text-900)]">
                  {groupGrade.deliverables.chapter1.score !== undefined ? groupGrade.deliverables.chapter1.score : '-'}
                </td>
                <td className="p-4 text-center text-[var(--color-text-600)]">{groupGrade.deliverables.chapter1.maxScore}</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-3">
                  {getDeliverableIcon(groupGrade.deliverables.chapter2.status)}
                  <span className="text-[var(--color-text-900)]">Chapter 2 (Literature review)</span>
                </td>
                <td className="p-4 text-center">{getStatusBadge(groupGrade.deliverables.chapter2.status)}</td>
                <td className="p-4 text-center text-[var(--color-text-900)]">
                  {groupGrade.deliverables.chapter2.score !== undefined ? groupGrade.deliverables.chapter2.score : '-'}
                </td>
                <td className="p-4 text-center text-[var(--color-text-600)]">{groupGrade.deliverables.chapter2.maxScore}</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-3">
                  {getDeliverableIcon(groupGrade.deliverables.chapter3.status)}
                  <span className="text-[var(--color-text-900)]">Chapter 3 (Analysis)</span>
                </td>
                <td className="p-4 text-center">{getStatusBadge(groupGrade.deliverables.chapter3.status)}</td>
                <td className="p-4 text-center text-[var(--color-text-900)]">
                  {groupGrade.deliverables.chapter3.score !== undefined ? groupGrade.deliverables.chapter3.score : '-'}
                </td>
                <td className="p-4 text-center text-[var(--color-text-600)]">{groupGrade.deliverables.chapter3.maxScore}</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-3">
                  {getDeliverableIcon(groupGrade.deliverables.chapter4.status)}
                  <span className="text-[var(--color-text-900)]">Chapter 4 (System design)</span>
                </td>
                <td className="p-4 text-center">{getStatusBadge(groupGrade.deliverables.chapter4.status)}</td>
                <td className="p-4 text-center text-[var(--color-text-900)]">
                  {groupGrade.deliverables.chapter4.score !== undefined ? groupGrade.deliverables.chapter4.score : '-'}
                </td>
                <td className="p-4 text-center text-[var(--color-text-600)]">{groupGrade.deliverables.chapter4.maxScore}</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-3">
                  {getDeliverableIcon(groupGrade.deliverables.finalReport.status)}
                  <span className="text-[var(--color-text-900)]">Final report</span>
                </td>
                <td className="p-4 text-center">{getStatusBadge(groupGrade.deliverables.finalReport.status)}</td>
                <td className="p-4 text-center text-[var(--color-text-900)]">
                  {groupGrade.deliverables.finalReport.score !== undefined ? groupGrade.deliverables.finalReport.score : '-'}
                </td>
                <td className="p-4 text-center text-[var(--color-text-600)]">{groupGrade.deliverables.finalReport.maxScore}</td>
              </tr>
              <tr>
                <td className="p-4 flex items-center gap-3">
                  {getDeliverableIcon(groupGrade.deliverables.revisedFinalReport.status)}
                  <span className="text-[var(--color-text-900)]">Revised_final_report</span>
                </td>
                <td className="p-4 text-center">{getStatusBadge(groupGrade.deliverables.revisedFinalReport.status)}</td>
                <td className="p-4 text-center text-[var(--color-text-900)]">
                  {groupGrade.deliverables.revisedFinalReport.score !== undefined ? groupGrade.deliverables.revisedFinalReport.score : '-'}
                </td>
                <td className="p-4 text-center text-[var(--color-text-600)]">{groupGrade.deliverables.revisedFinalReport.maxScore}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
