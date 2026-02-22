import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { getAllGroupGrades, updateSupervisorAssessment } from '../../services/grades';
import { getGradingSchemas, findSchemaWeight } from '../../services/grading-schemas';
import type { GroupGrade, GradingSchema } from '../../types';
import { Save, X } from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function courseTypeFromCode(code: string): '498' | '499' {
  return code.includes('499') ? '499' : '498';
}

const SEMESTER = 'DEFAULT';

// ─── Component ───────────────────────────────────────────────────────────────

export function SupervisorGradingAssessment() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('grades');

  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [grades, setGrades]               = useState<GroupGrade[]>([]);
  const [schemas, setSchemas]             = useState<GradingSchema[]>([]);
  const [editingGroup, setEditingGroup]   = useState<string | null>(null);
  const [editFormData, setEditFormData]   = useState<{
    scores:   Record<string, string>;
    comments: Record<string, string>;
  } | null>(null);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    if (!user) return;
    getAllGroupGrades().then(setGrades).finally(() => setLoading(false));
  }, [user]);

  // Load schemas when selected group changes
  useEffect(() => {
    if (!selectedGroup) return;
    const group = grades.find(g => g.groupId === selectedGroup);
    if (!group) return;
    const ct = courseTypeFromCode(group.course);
    getGradingSchemas(ct, SEMESTER).then(setSchemas);
  }, [selectedGroup, grades]);

  if (!user) return null;
  if (loading) {
    return (
      <Layout user={user} pageTitle="Supervisor Assessment">
        <div className="p-6">Loading…</div>
      </Layout>
    );
  }

  // Supervisor sees only groups they supervise
  const supervisorGroups = grades.filter(g => g.supervisorName === user.name);
  const selectedGrade    = grades.find(g => g.groupId === selectedGroup);

  // Supervisor max score from schema (role='supervisor')
  const supervisorMaxScore = findSchemaWeight(schemas, 'supervisor') ||
    (selectedGrade ? (courseTypeFromCode(selectedGrade.course) === '499' ? 23 : 20) : 20);

  const handleEdit = (groupId: string) => {
    const grade = grades.find(g => g.groupId === groupId);
    if (!grade) return;
    const scores:   Record<string, string> = {};
    const comments: Record<string, string> = {};
    grade.students.forEach(student => {
      const assessment = grade.supervisorAssessment[student.id];
      scores[student.id]   = assessment?.score !== undefined ? String(assessment.score) : '';
      comments[student.id] = assessment?.comment || '';
    });
    setEditingGroup(groupId);
    setEditFormData({ scores, comments });
  };

  const handleSave = async () => {
    if (!editingGroup || !editFormData || !user) return;
    const grade = grades.find(g => g.groupId === editingGroup);
    if (!grade) return;

    // Validate scores
    for (const student of grade.students) {
      const raw = parseFloat(editFormData.scores[student.id] || '0');
      if (raw < 0 || raw > supervisorMaxScore) {
        toast.error(`Score for ${student.name} must be between 0 and ${supervisorMaxScore}.`);
        return;
      }
    }

    setSaving(true);
    try {
      await Promise.all(
        grade.students.map(student => {
          const score   = parseFloat(editFormData.scores[student.id] || '0');
          const comment = editFormData.comments[student.id] || '';
          return updateSupervisorAssessment(
            student.id,
            editingGroup,
            grade.course,
            score,
            comment,
            user.id,
          );
        })
      );

      // Refresh grades list
      const updated = await getAllGroupGrades();
      setGrades(updated);
      setEditingGroup(null);
      setEditFormData(null);
      toast.success('Supervisor assessment saved successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save assessment.');
    } finally {
      setSaving(false);
    }
  };

  const calculateGroupAverage = (group: GroupGrade) => {
    const vals = Object.values(group.supervisorAssessment)
      .map(a => a.score)
      .filter((s): s is number => s !== undefined);
    return vals.length > 0
      ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
      : '—';
  };

  return (
    <Layout user={user} pageTitle="Supervisor Assessment">
      {isLocked && <LockedBanner />}

      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Grade each student in your supervised group individually.
          Maximum score per student is determined by the course schema.
        </p>

        <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">Select Group</Label>
        <Select value={selectedGroup} onValueChange={v => {
          setSelectedGroup(v);
          setEditingGroup(null);
          setEditFormData(null);
        }}>
          <SelectTrigger id="group-select" className="max-w-md">
            <SelectValue placeholder="Choose a group to grade" />
          </SelectTrigger>
          <SelectContent>
            {supervisorGroups.map(group => (
              <SelectItem key={group.groupId} value={group.groupId}>
                {group.groupName} — {group.course}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedGrade ? (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[var(--color-text-900)] mb-1">{selectedGrade.groupName}</h2>
                <p className="text-[var(--color-text-600)]">
                  Course: {selectedGrade.course}
                </p>
                <p className="text-[var(--color-text-600)] mt-1">
                  Students: {selectedGrade.students.map(s => s.name).join(', ')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl text-[var(--color-text-900)] mb-1 tabular-nums font-semibold">
                  {calculateGroupAverage(selectedGrade)}/{supervisorMaxScore}
                </div>
                <div className="text-[var(--color-text-600)] text-sm">Group Average</div>
              </div>
            </div>
          </div>

          {/* Student Grading */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h3 className="text-[var(--color-text-900)]">
                  {courseTypeFromCode(selectedGrade.course) === '499'
                    ? 'Supervisor Group Evaluation'
                    : 'Supervisor Assessment'}
                </h3>
                <p className="text-[var(--color-text-600)] text-sm mt-0.5">
                  {supervisorMaxScore} marks per student · {selectedGrade.course}
                </p>
              </div>

              {editingGroup !== selectedGroup ? (
                <Button
                  onClick={() => handleEdit(selectedGroup)}
                  className="bg-[#10B981] text-white hover:bg-[#0ea572]"
                  disabled={isLocked}
                >
                  Edit Grades
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => { setEditingGroup(null); setEditFormData(null); }}
                  >
                    <X className="w-4 h-4 mr-2" />Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isLocked || saving}
                    className="bg-[#10B981] text-white hover:bg-[#0ea572]"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving…' : 'Save Grades'}
                  </Button>
                </div>
              )}
            </div>

            <div className="p-6 space-y-8">
              {selectedGrade.students.map(student => {
                const assessment = selectedGrade.supervisorAssessment[student.id];
                const isEditing  = editingGroup === selectedGroup;

                return (
                  <div key={student.id} className="border border-[var(--color-border)] rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-[var(--color-text-900)]">{student.name}</h4>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl text-[var(--color-text-900)] tabular-nums font-semibold">
                          {assessment?.score !== undefined
                            ? `${assessment.score}/${supervisorMaxScore}`
                            : 'Not Graded'}
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`score-${student.id}`}>
                            Score (0 – {supervisorMaxScore}) *
                          </Label>
                          <Input
                            id={`score-${student.id}`}
                            type="number"
                            min={0}
                            max={supervisorMaxScore}
                            step={0.5}
                            value={editFormData?.scores[student.id] ?? ''}
                            onChange={e => setEditFormData(prev => prev && ({
                              ...prev,
                              scores: { ...prev.scores, [student.id]: e.target.value },
                            }))}
                            placeholder={`Enter score (max ${supervisorMaxScore})`}
                            className="mt-2 max-w-xs"
                            required
                            disabled={isLocked}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`comment-${student.id}`}>Comments for {student.name}</Label>
                          <Textarea
                            id={`comment-${student.id}`}
                            value={editFormData?.comments[student.id] ?? ''}
                            onChange={e => setEditFormData(prev => prev && ({
                              ...prev,
                              comments: { ...prev.comments, [student.id]: e.target.value },
                            }))}
                            placeholder="Enter assessment comments…"
                            className="mt-2 min-h-[100px]"
                            disabled={isLocked}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {assessment?.comment && (
                          <div>
                            <Label className="text-[var(--color-text-600)] mb-2 block">Comments</Label>
                            <div className="bg-[var(--color-surface-alt)] p-4 rounded-lg text-[var(--color-text-900)]">
                              {assessment.comment}
                            </div>
                          </div>
                        )}
                        {assessment?.gradedAt && (
                          <div className="mt-3">
                            <Label className="text-[var(--color-text-600)] mb-1 block">Graded</Label>
                            <div className="text-[var(--color-text-900)]">
                              {new Date(assessment.gradedAt).toLocaleString()}
                            </div>
                          </div>
                        )}
                        {assessment?.score === undefined && (
                          <div className="text-center py-4 text-[var(--color-text-600)]">
                            <p>No assessment submitted yet</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Group Progress Summary (read-only overview) */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Group Progress Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-[var(--color-text-600)] mb-1 text-sm">Weekly Progress</div>
                <div className="text-[var(--color-text-900)] font-semibold tabular-nums">
                  {selectedGrade.weeklyProgress.score ?? 0}/{selectedGrade.weeklyProgress.maxScore}
                </div>
              </div>
              {courseTypeFromCode(selectedGrade.course) === '498' && (
                <div>
                  <div className="text-[var(--color-text-600)] mb-1 text-sm">Course Deliverables</div>
                  <div className="text-[var(--color-text-900)] font-semibold tabular-nums">
                    {selectedGrade.deliverablesTotal ?? 0}/15
                  </div>
                </div>
              )}
              <div>
                <div className="text-[var(--color-text-600)] mb-1 text-sm">Your Assessment (Avg)</div>
                <div className="text-[var(--color-text-900)] font-semibold tabular-nums">
                  {calculateGroupAverage(selectedGrade)}/{supervisorMaxScore}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <p className="text-[var(--color-text-600)]">
            Please select a group to view and edit student assessments
          </p>
        </div>
      )}
    </Layout>
  );
}
