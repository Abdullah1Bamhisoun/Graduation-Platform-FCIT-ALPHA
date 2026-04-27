import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { supabase } from '../../lib/supabase';
import { createMilestone } from '../../services/milestones';
import { getRubricCriteria, type RubricCriterion } from '../../services/grading-rubric';
import { getCourseTypeFromUUID } from '../../services/courses';
import { BookOpen, RefreshCw, Eye, EyeOff, Users, Plus, Award, FileType } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { toast } from 'sonner';

interface Milestone {
  id: string;
  name: string;
  type: string;
  openDate: string;
  dueDate: string;
  visible: boolean;
  allowLateSubmission: boolean;
  includeInCommitteeEval: boolean;
}

interface NewAssessmentForm {
  name: string;
  description: string;
  openDate: string;
  openTime: string;
  closeDate: string;
  closeTime: string;
  visible: boolean;
  allowLateSubmission: boolean;
  requireJustification: boolean;
  includeInCommitteeEval: boolean;
  gradingCriterionId: string | undefined;
  allowedFileType: string | undefined;
}

const DEFAULT_FORM: NewAssessmentForm = {
  name: '',
  description: '',
  openDate: new Date().toISOString().split('T')[0],
  openTime: '09:00',
  closeDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  closeTime: '23:59',
  visible: true,
  allowLateSubmission: false,
  requireJustification: false,
  includeInCommitteeEval: false,
  gradingCriterionId: undefined,
  allowedFileType: undefined,
};

export function CoordinatorMilestonesConfig() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('milestones');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<NewAssessmentForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deliverableCriteria, setDeliverableCriteria] = useState<RubricCriterion[]>([]);

  const load = useCallback(async () => {
    if (!user?.coordinatorCourseId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('id, name, type, open_date, due_date, visible, allow_late_submission, include_in_committee_eval')
        .eq('course_id', user.coordinatorCourseId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setMilestones(
        (data || []).map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          openDate: m.open_date,
          dueDate: m.due_date,
          visible: m.visible,
          allowLateSubmission: m.allow_late_submission,
          includeInCommitteeEval: m.include_in_committee_eval ?? false,
        }))
      );
    } catch (err) {
      console.error('Error loading milestones:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.coordinatorCourseId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user?.coordinatorCourseId) return;
    getCourseTypeFromUUID(user.coordinatorCourseId).then((courseType) => {
      if (!courseType) return;
      getRubricCriteria(courseType, 'coordinator_deliverables').then(setDeliverableCriteria);
    });
  }, [user?.coordinatorCourseId]);

  const toggleVisibility = async (id: string, current: boolean) => {
    setToggling(id);
    try {
      const { error } = await supabase
        .from('milestones')
        .update({ visible: !current })
        .eq('id', id);
      if (error) throw error;
      setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, visible: !current } : m));
      toast.success(`Milestone ${!current ? 'made visible' : 'hidden'}`);
    } catch {
      toast.error('Failed to update milestone');
    } finally {
      setToggling(null);
    }
  };

  const openAddModal = () => {
    setForm(DEFAULT_FORM);
    setShowAddModal(true);
  };

  const setField = <K extends keyof NewAssessmentForm>(key: K, value: NewAssessmentForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Assessment name is required');
      return;
    }
    if (!form.openDate || !form.closeDate) {
      toast.error('Open date and close date are required');
      return;
    }
    if (!user?.coordinatorCourseId) return;

    setSaving(true);
    try {
      await createMilestone({
        name: form.name.trim(),
        description: form.description,
        course: 'CPIS-498',
        courseId: user.coordinatorCourseId,
        openDate: `${form.openDate}T${form.openTime}`,
        closeDate: `${form.closeDate}T${form.closeTime}`,
        visible: form.visible,
        allowLateSubmission: form.allowLateSubmission,
        requireJustification: form.requireJustification,
        includeInCommitteeEval: form.includeInCommitteeEval,
        gradingCriterionId: form.gradingCriterionId,
        allowedFileType: form.allowedFileType,
      });
      toast.success('Assessment created and announcement sent to students');
      setShowAddModal(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout user={user!} pageTitle="Milestone Configuration">
      {isLocked && <LockedBanner />}
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            disabled={isLocked || !user?.coordinatorCourseId}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Assessment
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">Loading milestones…</div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">No milestones configured for this course.</div>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={`bg-[var(--color-surface-white)] border rounded-xl p-4 flex items-center justify-between gap-4 ${
                  m.visible ? 'border-[var(--color-border)]' : 'border-dashed border-[var(--color-border)] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--color-text-900)]">{m.name}</div>
                    <div className="text-xs text-[var(--color-text-600)] mt-0.5 space-x-3">
                      <span>Opens: {new Date(m.openDate).toLocaleDateString()}</span>
                      <span>Due: {new Date(m.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full capitalize text-[var(--color-text-600)]">
                        {m.type.replace('_', ' ')}
                      </span>
                      {m.allowLateSubmission && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Late OK</span>
                      )}
                      {m.includeInCommitteeEval && (
                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Users className="w-3 h-3" />Committee Eval
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleVisibility(m.id, m.visible)}
                  disabled={isLocked || toggling === m.id}
                  title={m.visible ? 'Hide from students' : 'Show to students'}
                >
                  {m.visible ? (
                    <><Eye className="w-4 h-4 mr-1.5 text-green-600" /> Visible</>
                  ) : (
                    <><EyeOff className="w-4 h-4 mr-1.5 text-gray-400" /> Hidden</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Assessment Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Assessment</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <Label htmlFor="add-name">Assessment Name</Label>
              <Input
                id="add-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Chapter 1 Submission"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="add-description">Description</Label>
              <Textarea
                id="add-description"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Describe the submission requirements…"
                className="mt-2"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Open Date &amp; Time</Label>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <DatePicker
                      value={form.openDate}
                      onChange={(date) => {
                        setField('openDate', date);
                        if (form.closeDate && date > form.closeDate) setField('closeDate', '');
                      }}
                      placeholder="Select open date"
                    />
                  </div>
                  <TimePicker
                    value={form.openTime}
                    onChange={(time) => setField('openTime', time)}
                    placeholder="Time"
                  />
                </div>
              </div>
              <div>
                <Label>Close Date &amp; Time</Label>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <DatePicker
                      value={form.closeDate}
                      onChange={(date) => setField('closeDate', date)}
                      minDate={form.openDate || undefined}
                      placeholder="Select close date"
                    />
                  </div>
                  <TimePicker
                    value={form.closeTime}
                    onChange={(time) => setField('closeTime', time)}
                    placeholder="Time"
                  />
                </div>
              </div>
            </div>

            {/* Grade Scheme Criterion */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-blue-600" />
                <Label className="text-blue-900 font-semibold">Grade Scheme Mark</Label>
              </div>
              <p className="text-xs text-blue-700 mb-2">
                Select the deliverable criterion from the Grade Scheme Editor that will be graded when reviewing submissions for this milestone.
              </p>
              <Select
                value={form.gradingCriterionId ?? 'none'}
                onValueChange={(val) => setField('gradingCriterionId', val === 'none' ? undefined : val)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="No grade linked" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grade linked</SelectItem>
                  {deliverableCriteria.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.criterionName} (max {c.maxRawScore})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {deliverableCriteria.length === 0 && (
                <p className="text-xs text-blue-600 italic">
                  No criteria defined yet. Add them in Grade Scheme Editor → Coordinator Deliverables.
                </p>
              )}
            </div>

            {/* File Type Restriction */}
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <FileType className="w-4 h-4 text-orange-600" />
                <Label className="text-orange-900 font-semibold">Allowed File Format</Label>
              </div>
              <p className="text-xs text-orange-700 mb-2">
                Restrict what file type students can upload. Choose a specific format or allow any.
              </p>
              <Select
                value={form.allowedFileType ?? 'any'}
                onValueChange={(val) => setField('allowedFileType', val === 'any' ? undefined : val)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Any format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any format</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                  <SelectItem value="docx">Word (.docx)</SelectItem>
                  <SelectItem value="pptx">PowerPoint (.pptx)</SelectItem>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="zip">ZIP (.zip)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggles */}
            <div className="space-y-4 p-4 bg-[var(--color-surface-alt)] rounded-lg">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-[var(--color-text-900)]">Visible to Students</Label>
                  <p className="text-xs text-[var(--color-text-600)] mt-0.5">Make this milestone visible in student dashboards</p>
                </div>
                <Switch
                  checked={form.visible}
                  onCheckedChange={(checked) => setField('visible', checked)}
                  className="shrink-0"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-[var(--color-text-900)]">Allow Late Submissions</Label>
                  <p className="text-xs text-[var(--color-text-600)] mt-0.5">Permit submissions after the deadline</p>
                </div>
                <Switch
                  checked={form.allowLateSubmission}
                  onCheckedChange={(checked) => setField('allowLateSubmission', checked)}
                  className="shrink-0"
                />
              </div>

              {form.allowLateSubmission && (
                <div className="flex items-center justify-between gap-4 pl-4 border-l-2 border-[var(--color-border)]">
                  <div className="min-w-0">
                    <Label className="text-[var(--color-text-900)]">Require Justification</Label>
                    <p className="text-xs text-[var(--color-text-600)] mt-0.5">Students must provide a reason for late submission</p>
                  </div>
                  <Switch
                    checked={form.requireJustification}
                    onCheckedChange={(checked) => setField('requireJustification', checked)}
                    className="shrink-0"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-[var(--color-text-900)]">Include in Committee Evaluation</Label>
                  <p className="text-xs text-[var(--color-text-600)] mt-0.5">Committee members will see this milestone's submission and can leave feedback</p>
                </div>
                <Switch
                  checked={form.includeInCommitteeEval}
                  onCheckedChange={(checked) => setField('includeInCommitteeEval', checked)}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isLocked || saving}>
              {saving ? 'Creating…' : 'Create Assessment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
