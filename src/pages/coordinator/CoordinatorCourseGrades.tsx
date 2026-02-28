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
      <div className="max-w-6xl mx-auto pt-8 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Course Grades</h1>
          <p className="text-gray-600 mt-2">
            Manage group grading and evaluations for {assignedCourseType === '498' ? 'CPIS-498 — Senior Project I' : 'CPIS-499 — Senior Project II'}
          </p>
        </div>

        <Tabs defaultValue="chapter-submissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-11 border border-gray-300 rounded-lg bg-gray-100 p-1">
            <TabsTrigger
              value="chapter-submissions"
              className="rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:shadow-sm"
            >
              Chapter Submissions
            </TabsTrigger>
            <TabsTrigger
              value="groups-evaluation"
              className="rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:shadow-sm"
            >
              Groups Grades & Evaluation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chapter-submissions">
            <CoordinatorChapterSubmissionsTab courseType={assignedCourseType} />
          </TabsContent>

          <TabsContent value="groups-evaluation">
            <CoordinatorGroupsEvaluationTab courseType={assignedCourseType} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
