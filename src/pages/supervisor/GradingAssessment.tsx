import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { getAllGroupGrades } from '../../services/grades';
import { GroupGrade } from '../../types';
import { Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

export function SupervisorGradingAssessment() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('grades');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [grades, setGrades] = useState<GroupGrade[]>([]);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getAllGroupGrades().then(setGrades).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Supervisor Assessment"><div className="p-6">Loading...</div></Layout>;

  const supervisorGroups = grades.filter(g => g.supervisorName === user.name);
  const selectedGrade = grades.find(g => g.groupId === selectedGroup);

  const handleEdit = (groupId: string) => {
    const grade = grades.find(g => g.groupId === groupId);
    if (grade) {
      setEditingGroup(groupId);
      const studentScores: any = {};
      const studentComments: any = {};
      
      grade.students.forEach(student => {
        const assessment = grade.supervisorAssessment[student.id];
        studentScores[student.id] = assessment?.score || '';
        studentComments[student.id] = assessment?.comment || '';
      });
      
      setEditFormData({ scores: studentScores, comments: studentComments });
    }
  };

  const handleSave = () => {
    if (!editingGroup) return;

    const updatedGrades = grades.map(g => {
      if (g.groupId === editingGroup) {
        const updatedAssessment: any = {};
        
        g.students.forEach(student => {
          const score = parseFloat(editFormData.scores[student.id]) || 0;
          updatedAssessment[student.id] = {
            score,
            maxScore: 20,
            comment: editFormData.comments[student.id],
            gradedBy: user.name,
            gradedAt: new Date().toISOString(),
          };
        });

        return {
          ...g,
          supervisorAssessment: updatedAssessment,
        };
      }
      return g;
    });

    setGrades(updatedGrades);
    setEditingGroup(null);
    setEditFormData(null);
    toast.success('Supervisor assessment saved successfully!');
  };

  const calculateGroupAverage = (group: GroupGrade) => {
    let total = 0;
    let count = 0;
    group.students.forEach(student => {
      const assessment = group.supervisorAssessment[student.id];
      if (assessment?.score !== undefined) {
        total += assessment.score;
        count++;
      }
    });
    return count > 0 ? (total / count).toFixed(1) : '-';
  };

  return (
    <Layout user={user} pageTitle="Supervisor Assessment">
      {isLocked && <LockedBanner />}
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Grade your groups' students individually (20% of total assessment per student)
        </p>
        
        <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">Select Group</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger id="group-select" className="max-w-md">
            <SelectValue placeholder="Choose a group to grade" />
          </SelectTrigger>
          <SelectContent>
            {supervisorGroups.map((group) => (
              <SelectItem key={group.groupId} value={group.groupId}>
                {group.groupName} ({group.groupId})
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
                  Group ID: {selectedGrade.groupId} | Course: {selectedGrade.course}
                </p>
                <p className="text-[var(--color-text-600)] mt-1">
                  Students: {selectedGrade.students.map(s => s.name).join(', ')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl text-[var(--color-text-900)] mb-1">
                  {calculateGroupAverage(selectedGrade)}/20
                </div>
                <div className="text-[var(--color-text-600)]">Group Average</div>
              </div>
            </div>
          </div>

          {/* Student Grading */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-[var(--color-text-900)]">Individual Student Assessment (20 marks each)</h3>
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
                  <Button variant="outline" onClick={() => { setEditingGroup(null); setEditFormData(null); }}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSave} className="bg-[#10B981] text-white hover:bg-[#0ea572]" disabled={isLocked}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Grades
                  </Button>
                </div>
              )}
            </div>

            <div className="p-6 space-y-8">
              {selectedGrade.students.map((student) => {
                const assessment = selectedGrade.supervisorAssessment[student.id];
                const isEditing = editingGroup === selectedGroup;

                return (
                  <div key={student.id} className="border border-[var(--color-border)] rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-[var(--color-text-900)]">{student.name}</h4>
                        <p className="text-[var(--color-text-600)]">ID: {student.id}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl text-[var(--color-text-900)]">
                          {assessment?.score !== undefined ? `${assessment.score}/20` : 'Not Graded'}
                        </div>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor={`score-${student.id}`}>Score (out of 20) *</Label>
                          <Input
                            id={`score-${student.id}`}
                            type="number"
                            min="0"
                            max="20"
                            step="0.5"
                            value={editFormData.scores[student.id]}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              scores: { ...editFormData.scores, [student.id]: e.target.value }
                            })}
                            placeholder="Enter score"
                            className="mt-2 max-w-xs"
                            required
                            disabled={isLocked}
                          />
                        </div>

                        <div>
                          <Label htmlFor={`comment-${student.id}`}>Comments for {student.name}</Label>
                          <Textarea
                            id={`comment-${student.id}`}
                            value={editFormData.comments[student.id]}
                            onChange={(e) => setEditFormData({
                              ...editFormData,
                              comments: { ...editFormData.comments, [student.id]: e.target.value }
                            })}
                            placeholder="Enter assessment comments..."
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

                        {!assessment?.score && (
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

          {/* Group Progress Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Group Progress Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-[var(--color-text-600)] mb-1">Deliverables</div>
                <div className="text-[var(--color-text-900)]">{selectedGrade.deliverablesTotal || 0}/15</div>
              </div>
              <div>
                <div className="text-[var(--color-text-600)] mb-1">Weekly Progress</div>
                <div className="text-[var(--color-text-900)]">{selectedGrade.weeklyProgress.score || 0}/20</div>
              </div>
              <div>
                <div className="text-[var(--color-text-600)] mb-1">Your Assessment (Avg)</div>
                <div className="text-[var(--color-text-900)]">{calculateGroupAverage(selectedGrade)}/20</div>
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
