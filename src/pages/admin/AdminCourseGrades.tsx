import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { CoordinatorChapterSubmissionsTab } from '../../components/coordinator/CoordinatorChapterSubmissionsTab';
import { CoordinatorGroupsEvaluationTab } from '../../components/coordinator/CoordinatorGroupsEvaluationTab';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';

export function AdminCourseGrades() {
  const { user } = useAuth();
  const [selectedCourseType, setSelectedCourseType] = useState<'498' | '499'>('498');
  const [resolvedCourseId, setResolvedCourseId] = useState('');

  useEffect(() => {
    supabase
      .from('courses')
      .select('id')
      .ilike('code', `%${selectedCourseType}%`)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setResolvedCourseId(data?.id ?? ''));
  }, [selectedCourseType]);

  if (!user) return null;

  return (
    <Layout user={user} pageTitle="Course Grades">
      <div className="w-full pb-12">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Course Grades</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Manage group grading and evaluations across all courses
            </p>
          </div>

          {/* Course Type Selector */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium text-gray-700">Course:</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setSelectedCourseType('498')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCourseType === '498'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                CPIS-498
              </button>
              <button
                onClick={() => setSelectedCourseType('499')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                  selectedCourseType === '499'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                CPIS-499
              </button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="chapter-submissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-auto min-h-[2.75rem] border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-alt)] p-1">
            <TabsTrigger
              value="chapter-submissions"
              className="rounded-md font-semibold text-xs sm:text-sm py-2 leading-tight data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-green-600 data-[state=active]:shadow-sm"
            >
              Chapter Submissions
            </TabsTrigger>
            <TabsTrigger
              value="groups-evaluation"
              className="rounded-md font-semibold text-xs sm:text-sm py-2 leading-tight data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:border data-[state=active]:border-green-600 data-[state=active]:shadow-sm"
            >
              <span className="sm:hidden">Grades & Eval</span>
              <span className="hidden sm:inline">Groups Grades & Evaluation</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chapter-submissions">
            <CoordinatorChapterSubmissionsTab courseType={selectedCourseType} courseId={resolvedCourseId} role="admin" />
          </TabsContent>

          <TabsContent value="groups-evaluation">
            <CoordinatorGroupsEvaluationTab courseType={selectedCourseType} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
