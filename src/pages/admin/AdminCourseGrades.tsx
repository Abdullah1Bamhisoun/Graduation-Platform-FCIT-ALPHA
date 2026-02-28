import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { CoordinatorChapterSubmissionsTab } from '../../components/coordinator/CoordinatorChapterSubmissionsTab';
import { CoordinatorGroupsEvaluationTab } from '../../components/coordinator/CoordinatorGroupsEvaluationTab';
import { useAuth } from '../../lib/AuthContext';

export function AdminCourseGrades() {
  const { user } = useAuth();
  const [selectedCourseType, setSelectedCourseType] = useState<'498' | '499'>('498');

  if (!user) return null;

  return (
    <Layout user={user} pageTitle="Course Grades">
      <div className="max-w-6xl mx-auto pt-8 pb-12">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Course Grades</h1>
            <p className="text-gray-600 mt-2">
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
          <TabsList className="grid w-full grid-cols-2 mb-6 h-11 border border-gray-300 rounded-lg bg-gray-100 p-1">
            <TabsTrigger
              value="chapter-submissions"
              className="rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:shadow-sm"
            >
              Chapter Submission
            </TabsTrigger>
            <TabsTrigger
              value="groups-evaluation"
              className="rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:shadow-sm"
            >
              Groups Grades & Evaluation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chapter-submissions">
            <CoordinatorChapterSubmissionsTab courseType={selectedCourseType} />
          </TabsContent>

          <TabsContent value="groups-evaluation">
            <CoordinatorGroupsEvaluationTab courseType={selectedCourseType} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
