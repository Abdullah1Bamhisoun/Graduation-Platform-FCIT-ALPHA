import { useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Button } from '../components/ui/button';
import {
  LikertScaleRow,
  TotalsChip,
  RubricSummaryCard,
  ConfirmGradeModal,
  GradingToasts,
  showGradingToast
} from '../features/evaluations/components/grading';
import { useAuth } from '../lib/AuthContext';

export function ComponentShowcase() {
  const { user } = useAuth();
  const [chapter1Score, setChapter1Score] = useState<number | null>(4);
  const [chapter2Score, setChapter2Score] = useState<number | null>(null);
  const [chapter3Score, setChapter3Score] = useState<number | null>(3);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalVariant, setModalVariant] = useState<'default' | 'warning' | 'success' | 'info'>('default');

  if (!user) return null;

  const rubricBreakdown = [
    { name: 'Chapter 1', score: 4, max: 5, color: 'from-blue-600 to-blue-500' },
    { name: 'Chapter 2', score: 0, max: 3, color: 'from-green-600 to-green-500' },
    { name: 'Chapter 3', score: 3, max: 3, color: 'from-purple-600 to-purple-500' },
    { name: 'Chapter 4', score: 2.5, max: 3, color: 'from-orange-600 to-orange-500' },
    { name: 'Chapter 5', score: 3, max: 3, color: 'from-indigo-600 to-indigo-500' },
  ];

  const handleExport = (format: 'pdf' | 'csv') => {
    GradingToasts.exportStarted(format);
    setTimeout(() => {
      GradingToasts.exportCompleted(format);
    }, 1500);
  };

  return (
    <Layout user={user} pageTitle="Grading Components Showcase">
      <div className="space-y-12">
        {/* Section 1: Likert Scale Rows */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl text-[var(--color-text-900)] mb-2">Likert Scale Matrix Rows</h2>
            <p className="text-[var(--color-text-600)]">
              Radio button rows with different states: default, hover, selected, disabled
            </p>
          </div>

          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-surface-alt)]">
                  <tr>
                    <th className="p-4 text-left text-[var(--color-text-900)]">Chapter</th>
                    <th className="p-4 text-center text-[var(--color-text-600)] w-16">1</th>
                    <th className="p-4 text-center text-[var(--color-text-600)] w-16">2</th>
                    <th className="p-4 text-center text-[var(--color-text-600)] w-16">3</th>
                    <th className="p-4 text-center text-[var(--color-text-600)] w-16">4</th>
                    <th className="p-4 text-center text-[var(--color-text-600)] w-16">5</th>
                    <th className="p-4 text-center text-[var(--color-text-900)] w-32">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <LikertScaleRow
                    label="Chapter 1 - Selected State"
                    name="chapter1"
                    value={chapter1Score}
                    onChange={setChapter1Score}
                    maxScore={5}
                    scaledScore={chapter1Score ? (chapter1Score / 5) * 4 : 0}
                    variant="default"
                  />
                  <LikertScaleRow
                    label="Chapter 2 - Hover/Default State"
                    name="chapter2"
                    value={chapter2Score}
                    onChange={setChapter2Score}
                    maxScore={3}
                    scaledScore={chapter2Score ? (chapter2Score / 5) * 3 : 0}
                    variant="striped"
                  />
                  <LikertScaleRow
                    label="Chapter 3 - Selected with Striped"
                    name="chapter3"
                    value={chapter3Score}
                    onChange={setChapter3Score}
                    maxScore={3}
                    scaledScore={chapter3Score ? (chapter3Score / 5) * 3 : 0}
                    variant="striped"
                  />
                  <LikertScaleRow
                    label="Chapter 4 - Disabled State (Locked)"
                    name="chapter4"
                    value={5}
                    onChange={() => {}}
                    disabled={true}
                    maxScore={3}
                    scaledScore={3}
                    variant="default"
                  />
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-blue-900 mb-2">States Demonstrated:</h4>
            <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside">
              <li><strong>Default:</strong> Unselected radios, hover for scale effect</li>
              <li><strong>Hover:</strong> Scale animation on radio buttons</li>
              <li><strong>Selected:</strong> Blue accent color with green chip badge</li>
              <li><strong>Disabled:</strong> Gray opacity with "Locked" badge</li>
              <li><strong>Striped variant:</strong> Alternating background colors</li>
            </ul>
          </div>
        </section>

        {/* Section 2: Totals Chips */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl text-[var(--color-text-900)] mb-2">Totals Chips</h2>
            <p className="text-[var(--color-text-600)]">
              Small badge components for displaying grades with variants and sizes
            </p>
          </div>

          <div className="space-y-6">
            {/* Variants */}
            <div>
              <h3 className="text-lg text-[var(--color-text-900)] mb-3">Variants</h3>
              <div className="flex flex-wrap gap-3">
                <TotalsChip label="Default" current={15} max={20} variant="default" />
                <TotalsChip label="Primary" current={18} max={20} variant="primary" />
                <TotalsChip label="Success" current={19} max={20} variant="success" />
                <TotalsChip label="Warning" current={12} max={20} variant="warning" />
                <TotalsChip label="Danger" current={8} max={20} variant="danger" />
              </div>
            </div>

            {/* Sizes */}
            <div>
              <h3 className="text-lg text-[var(--color-text-900)] mb-3">Sizes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <TotalsChip label="Small" current={15} max={20} size="sm" variant="primary" />
                <TotalsChip label="Medium" current={15} max={20} size="md" variant="primary" />
                <TotalsChip label="Large" current={15} max={20} size="lg" variant="primary" />
              </div>
            </div>

            {/* With Percentage */}
            <div>
              <h3 className="text-lg text-[var(--color-text-900)] mb-3">With Percentage</h3>
              <div className="flex flex-wrap gap-3">
                <TotalsChip label="Chapter Total" current={17.5} max={20} variant="success" showPercentage />
                <TotalsChip label="Admin Marks" current={12} max={15} variant="primary" showPercentage />
                <TotalsChip label="Grand Total" current={87.5} max={100} variant="success" size="lg" showPercentage />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Rubric Summary Card */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl text-[var(--color-text-900)] mb-2">Rubric Summary Card</h2>
            <p className="text-[var(--color-text-600)]">
              Sticky sidebar card showing total score, percentage, and breakdown with progress bars
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gradient Variant */}
            <RubricSummaryCard
              title="Rubric Summary (Gradient)"
              total={12.5}
              maxTotal={17}
              breakdown={rubricBreakdown}
              onExport={handleExport}
              variant="gradient"
            />

            {/* Default Variant */}
            <RubricSummaryCard
              title="Rubric Summary (Default)"
              total={12.5}
              maxTotal={17}
              breakdown={rubricBreakdown}
              onExport={handleExport}
              variant="default"
              showExport={false}
            />
          </div>

          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h4 className="text-green-900 mb-2">Features:</h4>
            <ul className="text-green-800 text-sm space-y-1 list-disc list-inside">
              <li>Real-time total calculation with percentage</li>
              <li>Color-coded grade display (90%+ green, 80%+ blue, etc.)</li>
              <li>Animated progress bars for each item</li>
              <li>Export dropdown (PDF/CSV)</li>
              <li>Summary stats (Completed items, Average %)</li>
              <li>Hover effects on breakdown items</li>
            </ul>
          </div>
        </section>

        {/* Section 4: Confirm Modals */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl text-[var(--color-text-900)] mb-2">Confirm Grade Modals</h2>
            <p className="text-[var(--color-text-600)]">
              Confirmation dialogs with different variants for various actions
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setModalVariant('default');
                setShowConfirmModal(true);
              }}
            >
              Default Modal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setModalVariant('success');
                setShowConfirmModal(true);
              }}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              Success Modal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setModalVariant('warning');
                setShowConfirmModal(true);
              }}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Warning Modal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setModalVariant('info');
                setShowConfirmModal(true);
              }}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Info Modal
            </Button>
          </div>

          <ConfirmGradeModal
            open={showConfirmModal}
            onOpenChange={setShowConfirmModal}
            onConfirm={() => {
              GradingToasts.gradeSaved('Chapter 1');
            }}
            title={`${modalVariant.charAt(0).toUpperCase() + modalVariant.slice(1)} Confirmation`}
            description="This is a confirmation dialog to ensure you want to proceed with this action."
            variant={modalVariant}
            confirmText="Confirm Action"
            details={[
              'Save the current grades',
              'Notify relevant stakeholders',
              'Update the grading history',
            ]}
          />
        </section>

        {/* Section 5: Toast Notifications */}
        <section>
          <div className="mb-6">
            <h2 className="text-2xl text-[var(--color-text-900)] mb-2">Toast Notifications</h2>
            <p className="text-[var(--color-text-600)]">
              Feedback notifications for various grading actions
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Button
              variant="outline"
              onClick={() => GradingToasts.gradeSaved('Chapter 1')}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              Grade Saved
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.gradeUpdated('Chapter 2')}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Grade Updated
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.allGradesSaved()}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              All Saved
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.missingGrades()}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Missing Grades
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.invalidGrade(5)}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              Invalid Grade
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.gradingLocked()}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Locked
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.draftSaved()}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              Draft Saved
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.evaluationApproved()}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              Approved
            </Button>
            <Button
              variant="outline"
              onClick={() => GradingToasts.changesRequested()}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Changes Requested
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                showGradingToast({
                  type: 'info',
                  title: 'Custom Toast',
                  message: 'This is a custom toast notification with an action!',
                  duration: 5000,
                  action: {
                    label: 'Undo',
                    onClick: () => {
                      showGradingToast({
                        type: 'success',
                        message: 'Action undone!',
                      });
                    },
                  },
                });
              }}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              Custom with Action
            </Button>
          </div>

          <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <h4 className="text-purple-900 mb-2">Toast Types:</h4>
            <ul className="text-purple-800 text-sm space-y-1 list-disc list-inside">
              <li><strong>Success:</strong> Green with checkmark - confirmations</li>
              <li><strong>Error:</strong> Red with X - validation errors</li>
              <li><strong>Warning:</strong> Amber with alert - cautions</li>
              <li><strong>Info:</strong> Blue with info icon - general information</li>
              <li><strong>Custom actions:</strong> Optional undo/action buttons</li>
            </ul>
          </div>
        </section>

        {/* Integration Example */}
        <section className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-8">
          <h2 className="text-2xl text-[var(--color-text-900)] mb-4">Integration Example</h2>
          <p className="text-[var(--color-text-600)] mb-6">
            All components work together seamlessly in the grading workflow:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h3 className="text-[var(--color-text-900)] mb-2">1. Select Grades</h3>
              <p className="text-[var(--color-text-600)]">Use Likert Scale Rows to rate chapters 1-5</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h3 className="text-[var(--color-text-900)] mb-2">2. View Summary</h3>
              <p className="text-[var(--color-text-600)]">Rubric Summary Card shows real-time totals</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h3 className="text-[var(--color-text-900)] mb-2">3. Confirm Action</h3>
              <p className="text-[var(--color-text-600)]">Modal confirms before submitting grades</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h3 className="text-[var(--color-text-900)] mb-2">4. Show Feedback</h3>
              <p className="text-[var(--color-text-600)]">Toast notifications confirm success</p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
