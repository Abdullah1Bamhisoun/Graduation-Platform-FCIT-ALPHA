import { useState } from 'react';
import { Layout } from '../../components/Layout';
import { StatusBadge } from '../../components/StatusBadge';
import { Button } from '../../components/ui/button';
import { mockUsers, mockMilestones } from '../../lib/mock-data';
import { useNavigate } from 'react-router-dom';
import { Calendar, FileText, X } from 'lucide-react';
import { Milestone } from '../../lib/types';

export function StudentMilestones() {
  const navigate = useNavigate();
  const user = mockUsers.student;
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  // Filter out weekly reports - only show chapter submissions
  const chapterMilestones = mockMilestones.filter(m => m.type !== 'weekly-report');

  return (
    <Layout user={user} pageTitle="Chapter Submissions">
      <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--color-border)] text-[var(--color-text-600)]">
          <div className="col-span-4">Milestone</div>
          <div className="col-span-2">Course</div>
          <div className="col-span-2">Due Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Action</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-[var(--color-border)]">
          {chapterMilestones.map((milestone) => (
            <div
              key={milestone.id}
              className="grid grid-cols-12 gap-4 p-4 hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
              onClick={() => setSelectedMilestone(milestone)}
            >
              <div className="col-span-4">
                <h3 className="text-[var(--color-text-900)] mb-1">{milestone.name}</h3>
                {milestone.lastAction && (
                  <p className="text-[var(--color-text-600)]">{milestone.lastAction}</p>
                )}
              </div>
              <div className="col-span-2 flex items-center">
                <span className="text-[var(--color-text-900)]">{milestone.course}</span>
              </div>
              <div className="col-span-2 flex items-center">
                <div>
                  <p className="text-[var(--color-text-900)]">
                    {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[var(--color-text-600)]">
                    Opens: {new Date(milestone.openDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="col-span-2 flex items-center">
                <StatusBadge status={milestone.status} />
              </div>
              <div className="col-span-2 flex items-center">
                {milestone.status === 'draft' || milestone.status === 'changes-requested' ? (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/student/submissions/${milestone.id}`);
                    }}
                  >
                    Submit
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/student/submissions/${milestone.id}`);
                    }}
                  >
                    View
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer for Milestone Details */}
      {selectedMilestone && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedMilestone(null)}
          />
          <div className="fixed right-0 top-0 h-full w-[600px] bg-[var(--color-surface-white)] shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6 flex items-center justify-between">
              <h2 className="text-[var(--color-text-900)]">{selectedMilestone.name}</h2>
              <button
                onClick={() => setSelectedMilestone(null)}
                className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <label className="text-[var(--color-text-600)] mb-2 block">Status</label>
                <StatusBadge status={selectedMilestone.status} />
              </div>

              {/* Timeline */}
              <div>
                <label className="text-[var(--color-text-600)] mb-2 block">Timeline</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[var(--color-text-600)]" />
                    <div>
                      <p className="text-[var(--color-text-900)]">Opens: {new Date(selectedMilestone.openDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[var(--color-text-600)]" />
                    <div>
                      <p className="text-[var(--color-text-900)]">Due: {new Date(selectedMilestone.dueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedMilestone.description && (
                <div>
                  <label className="text-[var(--color-text-600)] mb-2 block">Description</label>
                  <p className="text-[var(--color-text-900)]">{selectedMilestone.description}</p>
                </div>
              )}

              {/* Rubric Preview */}
              {selectedMilestone.rubric && (
                <div>
                  <label className="text-[var(--color-text-600)] mb-2 block">Grading Rubric</label>
                  <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
                    {selectedMilestone.rubric.map((criterion) => (
                      <div key={criterion.id} className="p-4 flex justify-between items-center">
                        <span className="text-[var(--color-text-900)]">{criterion.name}</span>
                        <span className="text-[var(--color-text-600)]">{criterion.maxScore} points</span>
                      </div>
                    ))}
                    <div className="p-4 flex justify-between items-center bg-[var(--color-surface-alt)]">
                      <span className="text-[var(--color-text-900)]">Total</span>
                      <span className="text-[var(--color-text-900)]">
                        {selectedMilestone.rubric.reduce((sum, c) => sum + c.maxScore, 0)} points
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSelectedMilestone(null);
                    navigate(`/student/submissions/${selectedMilestone.id}`);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {selectedMilestone.status === 'draft' ? 'Start Submission' : 'View Submission'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
