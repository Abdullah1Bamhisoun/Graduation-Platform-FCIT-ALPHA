import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { CoordinatorChapterSubmissionsTab } from '../../components/coordinator/CoordinatorChapterSubmissionsTab';
import { CoordinatorGroupsEvaluationTab } from '../../components/coordinator/CoordinatorGroupsEvaluationTab';
import { useAuth } from '../../lib/AuthContext';
import { getCourseTypeFromUUID } from '../../services/courses';

export function CoordinatorCourseGrades() {
  const { user } = useAuth();
  const [assignedCourseType, setAssignedCourseType] = useState<'498' | '499' | null>(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupsRefreshKey, setGroupsRefreshKey] = useState(0);
  const [chapterRefreshKey, setChapterRefreshKey] = useState(0);

  useEffect(() => {
    if (!user?.coordinatorCourseId) {
      setCourseLoading(false);
      setError('No course assigned to your coordinator account.');
      return;
    }

    getCourseTypeFromUUID(user.coordinatorCourseId)
      .then((courseType) => {
        if (!courseType) {
          setError('Unable to determine your assigned course type.');
        } else {
          setAssignedCourseType(courseType);
        }
      })
      .catch(() => setError('Failed to load course information.'))
      .finally(() => setCourseLoading(false));
  }, [user?.coordinatorCourseId]);

  if (!user) return null;

  if (courseLoading) {
    return (
      <Layout user={user} pageTitle="Course Grades">
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-gray-500">Loading course information...</p>
        </div>
      </Layout>
    );
  }

  if (error || !assignedCourseType) {
    return (
      <Layout user={user} pageTitle="Course Grades">
        <div className="max-w-4xl mx-auto pt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-900">{error || 'Unable to determine your assigned course. Please contact an administrator.'}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} pageTitle="Course Grades">
      <div className="pb-12">
        <div className="mb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Course Grades</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Manage group grading and evaluations for {assignedCourseType === '498' ? 'CPIS-498 — Senior Project I' : 'CPIS-499 — Senior Project II'}
          </p>
        </div>

        <Tabs defaultValue="chapter-submissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-auto min-h-[2.75rem] border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-alt)] p-1">
            <TabsTrigger
              value="chapter-submissions"
              className="rounded-md font-semibold text-xs sm:text-sm py-2 leading-tight data-[state=active]:bg-[var(--color-surface-white)] data-[state=active]:border data-[state=active]:border-[var(--color-border)] data-[state=active]:shadow-sm"
            >
              Chapter Submissions
            </TabsTrigger>
            <TabsTrigger
              value="groups-evaluation"
              className="rounded-md font-semibold text-xs sm:text-sm py-2 leading-tight data-[state=active]:bg-[var(--color-surface-white)] data-[state=active]:border data-[state=active]:border-[var(--color-border)] data-[state=active]:shadow-sm"
            >
              <span className="sm:hidden">Grades & Eval</span>
              <span className="hidden sm:inline">Groups Grades & Evaluation</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chapter-submissions">
            <CoordinatorChapterSubmissionsTab
              courseType={assignedCourseType}
              courseId={user?.coordinatorCourseId ?? ''}
              onGradeSaved={() => setGroupsRefreshKey((k) => k + 1)}
              refreshKey={chapterRefreshKey}
            />
          </TabsContent>

          <TabsContent value="groups-evaluation">
            <CoordinatorGroupsEvaluationTab
              courseType={assignedCourseType}
              refreshKey={groupsRefreshKey}
              onEvaluationSaved={() => setChapterRefreshKey((k) => k + 1)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
