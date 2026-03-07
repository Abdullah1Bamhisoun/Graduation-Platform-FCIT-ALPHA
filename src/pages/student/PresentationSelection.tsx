import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/AuthContext';
import { getStudentPresentationView } from '../../services/presentations';
import type { StudentPresentationView } from '../../services/presentations';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';

export function StudentPresentationSelection() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('presentations');
  const [data, setData] = useState<StudentPresentationView>({ group: null, schedule: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentPresentationView()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;
  if (loading)
    return (
      <Layout user={user} pageTitle="Presentation Time">
        <div className="p-6">Loading...</div>
      </Layout>
    );

  const { group, schedule } = data;

  return (
    <Layout user={user} pageTitle="Presentation Time">
      {isLocked && <LockedBanner />}
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Your assigned presentation time slot for the final evaluation.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-[var(--color-text-900)]">
            <strong>Note:</strong> Presentation times are assigned by the Admin or Course
            Coordinator. Please contact your coordinator if you have concerns about your
            assigned slot.
          </p>
        </div>
      </div>

      {group ? (
        <div className="space-y-6">
          {/* Group Information — read-only */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Your Group Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[var(--color-text-600)]">Group</Label>
                <div className="text-[var(--color-text-900)]">{group.groupCode}</div>
              </div>
              <div>
                <Label className="text-[var(--color-text-600)]">Group Number</Label>
                <div className="text-[var(--color-text-900)]">
                  {group.groupNumber ?? '—'}
                </div>
              </div>
              <div>
                <Label className="text-[var(--color-text-600)]">Project Name</Label>
                <div className="text-[var(--color-text-900)]">{group.projectName}</div>
              </div>
            </div>
          </div>

          {/* Assigned Presentation Time — read-only */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Assigned Presentation Time</h3>

            {schedule ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[var(--color-text-600)]" />
                    <div>
                      <Label className="text-[var(--color-text-600)]">Date</Label>
                      <div className="text-[var(--color-text-900)]">
                        {schedule.scheduledAt
                          ? new Date(schedule.scheduledAt).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : schedule.day}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[var(--color-text-600)]" />
                    <div>
                      <Label className="text-[var(--color-text-600)]">Time</Label>
                      <div className="text-[var(--color-text-900)]">{schedule.timeSlot}</div>
                    </div>
                  </div>
                  {schedule.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-[var(--color-text-600)]" />
                      <div>
                        <Label className="text-[var(--color-text-600)]">Location</Label>
                        <div className="text-[var(--color-text-900)]">{schedule.location}</div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
                  ✓ Your presentation time has been confirmed
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--color-text-600)]">
                <p>No presentation time assigned yet</p>
                <p className="mt-2">
                  Your coordinator will assign a time slot when the schedule is ready
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <p className="text-[var(--color-text-600)]">
            You are not currently assigned to a group
          </p>
        </div>
      )}
    </Layout>
  );
}
