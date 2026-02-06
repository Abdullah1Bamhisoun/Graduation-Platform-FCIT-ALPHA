import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { mockUsers, mockStudentPresentationSelections } from '../../lib/mock-data';
import { StudentPresentationSelection } from '../../types';
import { Calendar, Clock, CheckCircle, XCircle } from 'lucide-react';

export function AdminPresentationScheduling() {
  const user = mockUsers.admin;
  const [selections] = useState<StudentPresentationSelection[]>(mockStudentPresentationSelections);

  const pendingSelections = selections.filter(s => s.selectedDay);
  const notSelectedYet = selections.filter(s => !s.selectedDay);

  return (
    <Layout user={user} pageTitle="Presentation Scheduling Management">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          View and manage all student presentation time slot selections
        </p>
      </div>

      <div className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <div className="text-2xl text-[var(--color-text-900)]">{pendingSelections.length}</div>
                <div className="text-[var(--color-text-600)]">Selected</div>
              </div>
            </div>
          </div>
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-orange-600" />
              <div>
                <div className="text-2xl text-[var(--color-text-900)]">{notSelectedYet.length}</div>
                <div className="text-[var(--color-text-600)]">Pending Selection</div>
              </div>
            </div>
          </div>
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-600" />
              <div>
                <div className="text-2xl text-[var(--color-text-900)]">{selections.length}</div>
                <div className="text-[var(--color-text-600)]">Total Groups</div>
              </div>
            </div>
          </div>
        </div>

        {/* All Presentations Table */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[var(--color-border)]">
            <h3 className="text-[var(--color-text-900)]">All Presentation Time Selections</h3>
            <p className="text-[var(--color-text-600)] mt-1">
              Student-selected presentation schedules
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--color-surface-alt)]">
                <tr>
                  <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Group Name</th>
                  <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Student Name(s)</th>
                  <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">University ID(s)</th>
                  <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">Day</th>
                  <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">Time Slot</th>
                  <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Project Name</th>
                  <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Project Description</th>
                  <th className="p-4 text-center text-[var(--color-text-900)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {selections.map((selection) => (
                  selection.students.map((student, idx) => (
                    <tr
                      key={`${selection.groupId}-${student.id}`}
                      className={selection.selectedDay ? 'bg-green-50' : 'bg-orange-50'}
                    >
                      {idx === 0 ? (
                        <>
                          <td className="p-4 border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                            <span className="text-[var(--color-text-900)]">{selection.groupName}</span>
                          </td>
                          <td className="p-4 border-r border-[var(--color-border)]">
                            <span className="text-[var(--color-text-900)]">{student.name}</span>
                          </td>
                          <td className="p-4 text-center border-r border-[var(--color-border)]">
                            <span className="text-[var(--color-text-600)]">{student.id}</span>
                          </td>
                          <td className="p-4 text-center border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                            <span className="text-[var(--color-text-900)]">
                              {selection.selectedDay || (
                                <span className="text-orange-600">Not Selected</span>
                              )}
                            </span>
                          </td>
                          <td className="p-4 text-center border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                            <span className="text-[var(--color-text-900)]">
                              {selection.selectedTimeSlot || (
                                <span className="text-orange-600">Not Selected</span>
                              )}
                            </span>
                          </td>
                          <td className="p-4 border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                            <span className="text-[var(--color-text-900)]">{selection.projectName}</span>
                          </td>
                          <td className="p-4 border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                            <span className="text-[var(--color-text-600)]">{selection.projectDescription}</span>
                          </td>
                          <td className="p-4 text-center" rowSpan={selection.students.length}>
                            {selection.selectedDay ? (
                              <div className="flex flex-col items-center gap-1">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-green-600">Selected</span>
                                {selection.selectedAt && (
                                  <span className="text-[var(--color-text-600)]">
                                    {new Date(selection.selectedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <XCircle className="w-5 h-5 text-orange-600" />
                                <span className="text-orange-600">Pending</span>
                              </div>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="p-4 border-r border-[var(--color-border)]">
                            <span className="text-[var(--color-text-900)]">{student.name}</span>
                          </td>
                          <td className="p-4 text-center border-r border-[var(--color-border)]">
                            <span className="text-[var(--color-text-600)]">{student.id}</span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
