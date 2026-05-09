import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { getMilestoneConfigs, createMilestone, updateMilestone, deleteMilestone } from '../../services/milestones';
import { getRubricCriteria, type RubricCriterion } from '../../services/grading-rubric';
import { getCourseTypeFromUUID } from '../../services/courses';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { DatePicker } from '../../components/ui/DatePicker';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Settings, Plus, Edit2, Save, X, Trash2, Award, Users, FileType, Bell } from 'lucide-react';
import { TimePicker } from '../../components/ui/TimePicker';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { MilestoneConfig } from '../../types';

interface NewMilestoneForm {
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

function makeDefaultForm(): NewMilestoneForm {
  return {
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
}

function getDatePart(val: string): string {
  return val?.split('T')[0] ?? '';
}
function getTimePart(val: string): string {
  return val?.split('T')[1]?.slice(0, 5) ?? '00:00';
}
function combineDatetime(date: string, time: string): string {
  return date ? `${date}T${time}` : date;
}
function formatDatetime(val: string): string {
  if (!val) return '';
  const d = new Date(val.includes('T') ? val : `${val}T00:00`);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminMilestonesConfig() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('milestones');

  // For coordinators, their assigned course code (locked); for admins, freely selectable
  const [coordinatorCourseCode, setCoordinatorCourseCode] = useState<string | null>(null);
  const [coordinatorCourseId, setCoordinatorCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<'CPIS-498' | 'CPIS-499'>('CPIS-498');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<MilestoneConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add Assessment modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newForm, setNewForm] = useState<NewMilestoneForm>(makeDefaultForm());
  const setNewField = <K extends keyof NewMilestoneForm>(key: K, value: NewMilestoneForm[K]) =>
    setNewForm((prev) => ({ ...prev, [key]: value }));

  // Grade Scheme criteria for coordinator_deliverables component
  const [deliverableCriteria, setDeliverableCriteria] = useState<RubricCriterion[]>([]);

  const isCoordinator = user?.activeRole === 'coordinator';
  const isAdmin = user?.roles?.includes('admin') ?? false;

  // Resolve coordinator's assigned course code from their courseId UUID
  useEffect(() => {
    if (!user) return;
    if (isCoordinator && !isAdmin && user.coordinatorCourseId) {
      supabase
        .from('courses')
        .select('id, code')
        .eq('id', user.coordinatorCourseId)
        .single()
        .then(({ data }) => {
          if (data?.code) {
            const code = data.code.includes('499') ? 'CPIS-499' : 'CPIS-498';
            setCoordinatorCourseCode(code);
            setCoordinatorCourseId(data.id);
            setSelectedCourse(code as 'CPIS-498' | 'CPIS-499');
          }
        });
    }
  }, [user, isCoordinator, isAdmin]);

  // Load milestone configs whenever the resolved course is ready
  useEffect(() => {
    if (!user) return;
    if (isCoordinator && !isAdmin) {
      if (!coordinatorCourseId) return;
      getMilestoneConfigs(coordinatorCourseId).then(setConfigs);
    } else {
      getMilestoneConfigs().then(setConfigs);
    }
  }, [user, isCoordinator, isAdmin, coordinatorCourseId]);

  // Load coordinator_deliverables criteria from Grade Scheme Editor
  useEffect(() => {
    const loadCriteria = async () => {
      let courseType: '498' | '499' | null = null;
      if (isCoordinator && !isAdmin && coordinatorCourseId) {
        courseType = await getCourseTypeFromUUID(coordinatorCourseId);
      } else if (!isCoordinator || isAdmin) {
        courseType = selectedCourse.includes('499') ? '499' : '498';
      }
      if (!courseType) return;
      const criteria = await getRubricCriteria(courseType, 'coordinator_deliverables');
      setDeliverableCriteria(criteria);
    };
    loadCriteria();
  }, [isCoordinator, isAdmin, coordinatorCourseId, selectedCourse]);

  if (!user) return null;

  const filteredConfigs = configs.filter((c) => {
    if (isCoordinator && !isAdmin) return true; // already filtered server-side
    return c.course === selectedCourse;
  });

  const updateConfigField = (id: string, field: string, value: any) => {
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleAddMilestone = () => {
    setNewForm(makeDefaultForm());
    setShowAddModal(true);
  };

  const handleCreateNew = async () => {
    if (!newForm.name.trim()) {
      toast.error('Assessment name is required');
      return;
    }
    if (!newForm.openDate || !newForm.closeDate) {
      toast.error('Open date and close date are required');
      return;
    }

    setSaving(true);
    try {
      let courseId = isCoordinator && !isAdmin ? coordinatorCourseId : null;
      const courseForNew = isCoordinator && !isAdmin
        ? (coordinatorCourseCode as 'CPIS-498' | 'CPIS-499')
        : selectedCourse;

      if (!courseId) {
        const { data: courses } = await supabase
          .from('courses')
          .select('id')
          .eq('code', courseForNew)
          .limit(1);
        courseId = courses?.[0]?.id ?? null;
      }
      if (!courseId) throw new Error('Could not resolve course');

      await createMilestone({
        name: newForm.name.trim(),
        description: newForm.description,
        course: courseForNew ?? selectedCourse,
        courseId,
        openDate: `${newForm.openDate}T${newForm.openTime}`,
        closeDate: `${newForm.closeDate}T${newForm.closeTime}`,
        visible: newForm.visible,
        allowLateSubmission: newForm.allowLateSubmission,
        requireJustification: newForm.requireJustification,
        includeInCommitteeEval: newForm.includeInCommitteeEval,
        gradingCriterionId: newForm.gradingCriterionId,
        allowedFileType: newForm.allowedFileType,
      });

      toast.success('Assessment created and announcement sent to students');
      setShowAddModal(false);
      // Reload configs
      if (isCoordinator && !isAdmin) {
        if (coordinatorCourseId) getMilestoneConfigs(coordinatorCourseId).then(setConfigs);
      } else {
        getMilestoneConfigs().then(setConfigs);
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (config: MilestoneConfig, notify = false) => {
    setSaving(true);
    try {
      const { notified, notifyError } = await updateMilestone(config.id, config, notify);
      if (notify) {
        if (notified) {
          toast.success('Assessment updated — students notified via announcement, bell, and email');
        } else {
          toast.success('Assessment updated');
          toast.error(`Notification failed: ${notifyError ?? 'unknown error'}`);
        }
      } else {
        toast.success('Assessment updated successfully');
      }
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save milestone');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleDelete = async (config: MilestoneConfig) => {
    if (!window.confirm(`Delete assessment "${config.name}"? This will also remove the related announcement.`)) return;
    setDeleting(config.id);
    try {
      await deleteMilestone(config.id);
      setConfigs((prev) => prev.filter((c) => c.id !== config.id));
      toast.success('Assessment deleted');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete milestone');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Layout user={user} pageTitle="Assessment Configuration">
      {isLocked && <LockedBanner />}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-[var(--color-text-600)]">
          Configure assessment timelines and submission policies
        </p>
        <Button
          variant="primary"
          onClick={handleAddMilestone}
          className="w-full sm:w-auto gap-2"
          disabled={isLocked || (isCoordinator && !isAdmin && !coordinatorCourseId)}
        >
          <Plus className="w-4 h-4" />
          Add Assessment
        </Button>
      </div>

      {/* Course Selector — coordinators see their locked course; admins can switch freely */}
      <div className="mb-6 flex gap-4 items-center">
        {isCoordinator && !isAdmin ? (
          <div className="px-4 py-2 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] font-semibold border border-[var(--color-primary-300)]">
            {coordinatorCourseCode ?? 'Loading course…'}
            <span className="ml-2 text-xs font-normal text-[var(--color-primary-600)]">(your assigned course)</span>
          </div>
        ) : (
          <>
            <Button
              variant={selectedCourse === 'CPIS-498' ? 'default' : 'outline'}
              onClick={() => setSelectedCourse('CPIS-498')}
              className={selectedCourse === 'CPIS-498' ? '!bg-green-600 hover:!bg-green-700 text-white' : ''}
            >
              CPIS-498
            </Button>
            <Button
              variant={selectedCourse === 'CPIS-499' ? 'default' : 'outline'}
              onClick={() => setSelectedCourse('CPIS-499')}
              className={selectedCourse === 'CPIS-499' ? '!bg-green-600 hover:!bg-green-700 text-white' : ''}
            >
              CPIS-499
            </Button>
          </>
        )}
      </div>

      {/* Milestones List */}
      <div className="space-y-4">
        {filteredConfigs.length === 0 && (
          <p className="text-center text-[var(--color-text-600)] py-12">
            No assessments yet. Click &quot;Add Assessment&quot; to create the first one.
          </p>
        )}

        {filteredConfigs.map((config) => (
          <div
            key={config.id}
            className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm"
          >
            <div className="p-6">
              {editingId === config.id ? (
                /* Edit Mode */
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="name">Assessment Name</Label>
                    <Input
                      id="name"
                      value={config.name}
                      onChange={(e) => updateConfigField(config.id, 'name', e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={config.description ?? ''}
                      onChange={(e) => updateConfigField(config.id, 'description', e.target.value)}
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
                            value={getDatePart(config.openDate)}
                            onChange={(date) => {
                              updateConfigField(config.id, 'openDate', combineDatetime(date, getTimePart(config.openDate)));
                              if (getDatePart(config.closeDate) && date > getDatePart(config.closeDate)) {
                                updateConfigField(config.id, 'closeDate', '');
                              }
                            }}
                            placeholder="Select open date"
                          />
                        </div>
                        <TimePicker
                          value={getTimePart(config.openDate)}
                          onChange={(time) => updateConfigField(config.id, 'openDate', combineDatetime(getDatePart(config.openDate), time))}
                          placeholder="Time"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Close Date &amp; Time</Label>
                      <div className="mt-2 flex gap-2">
                        <div className="flex-1">
                          <DatePicker
                            value={getDatePart(config.closeDate)}
                            onChange={(date) => updateConfigField(config.id, 'closeDate', combineDatetime(date, getTimePart(config.closeDate)))}
                            minDate={getDatePart(config.openDate) || undefined}
                            placeholder="Select close date"
                          />
                        </div>
                        <TimePicker
                          value={getTimePart(config.closeDate)}
                          onChange={(time) => updateConfigField(config.id, 'closeDate', combineDatetime(getDatePart(config.closeDate), time))}
                          placeholder="Time"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Grade Scheme Criterion Selector */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-blue-600" />
                      <Label className="text-blue-900 font-semibold">Grade Scheme Mark</Label>
                    </div>
                    <p className="text-xs text-blue-700 mb-2">
                      Select the deliverable criterion from the Grade Scheme Editor that will be graded when reviewing submissions for this milestone.
                    </p>
                    <Select
                      value={config.gradingCriterionId ?? 'none'}
                      onValueChange={(val) =>
                        updateConfigField(config.id, 'gradingCriterionId', val === 'none' ? undefined : val)
                      }
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
                      value={config.allowedFileType ?? 'any'}
                      onValueChange={(val) =>
                        updateConfigField(config.id, 'allowedFileType', val === 'any' ? undefined : val)
                      }
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

                  <div className="space-y-4 p-4 bg-[var(--color-surface-alt)] rounded-lg">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Label htmlFor="visible" className="text-[var(--color-text-900)]">
                          Visible to Students
                        </Label>
                        <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                          Make this milestone visible in student dashboards
                        </p>
                      </div>
                      <Switch
                        id="visible"
                        checked={config.visible}
                        onCheckedChange={(checked) => updateConfigField(config.id, 'visible', checked)}
                        className="shrink-0"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Label htmlFor="allowLate" className="text-[var(--color-text-900)]">
                          Allow Late Submissions
                        </Label>
                        <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                          Permit submissions after the deadline
                        </p>
                      </div>
                      <Switch
                        id="allowLate"
                        checked={config.allowLateSubmission}
                        onCheckedChange={(checked) => updateConfigField(config.id, 'allowLateSubmission', checked)}
                        className="shrink-0"
                      />
                    </div>

                    {config.allowLateSubmission && (
                      <div className="flex items-center justify-between gap-4 pl-4 border-l-2 border-[var(--color-border)]">
                        <div className="min-w-0">
                          <Label htmlFor="requireJustification" className="text-[var(--color-text-900)]">
                            Require Justification
                          </Label>
                          <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                            Students must provide a reason for late submission
                          </p>
                        </div>
                        <Switch
                          id="requireJustification"
                          checked={config.requireJustification}
                          onCheckedChange={(checked) => updateConfigField(config.id, 'requireJustification', checked)}
                          className="shrink-0"
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <Label htmlFor="includeInCommitteeEval" className="text-[var(--color-text-900)]">
                          Include in Committee Evaluation
                        </Label>
                        <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                          Committee members will see this milestone's submission and can leave feedback
                        </p>
                      </div>
                      <Switch
                        id="includeInCommitteeEval"
                        checked={config.includeInCommitteeEval ?? false}
                        onCheckedChange={(checked) => updateConfigField(config.id, 'includeInCommitteeEval', checked)}
                        className="shrink-0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleCancel()}
                      className="justify-center gap-2"
                      disabled={saving}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleSave(config)}
                      className="justify-center gap-2"
                      disabled={isLocked || saving}
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSave(config, true)}
                      className="col-span-2 sm:col-span-1 justify-center gap-2 border-blue-400 text-blue-600 hover:bg-blue-50 hover:border-blue-500"
                      disabled={isLocked || saving}
                    >
                      <Bell className="w-4 h-4" />
                      {saving ? 'Saving…' : 'Save & Notify Students'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div>
                  {/* Desktop: title left + buttons right | Mobile: title top + 2×2 grid bottom */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-4">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-[var(--color-text-900)] line-clamp-2 mb-1">{config.name}</h2>
                      {config.description && (
                        <p className="text-[var(--color-text-600)] line-clamp-2 mb-2">{config.description}</p>
                      )}
                      <p className="text-[var(--color-text-600)]">
                        Opens: {formatDatetime(config.openDate)} •{' '}
                        Closes: {formatDatetime(config.closeDate)}
                      </p>
                    </div>

                    {/* Buttons: 2×2 on mobile, compact row on desktop */}
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:shrink-0 border-t border-gray-200 dark:border-gray-700 pt-3 sm:border-t-0 sm:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(config.id)}
                        className="justify-center gap-2"
                        disabled={isLocked}
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(config)}
                        className="justify-center gap-2 text-red-600 hover:text-red-700 hover:border-red-400"
                        disabled={isLocked || deleting === config.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deleting === config.id ? 'Deleting…' : 'Delete'}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <div className={`px-3 py-1 rounded-full text-sm ${
                      config.visible
                        ? 'bg-white text-green-700 border border-green-500'
                        : 'bg-white text-gray-600 border border-gray-300'
                    }`}>
                      {config.visible ? 'Visible' : 'Hidden'}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm ${
                      config.allowLateSubmission
                        ? 'bg-white text-amber-700 border border-amber-500'
                        : 'bg-white text-gray-600 border border-gray-300'
                    }`}>
                      {config.allowLateSubmission ? 'Late Submissions Allowed' : 'No Late Submissions'}
                    </div>
                    {config.requireJustification && (
                      <div className="px-3 py-1 rounded-full text-sm bg-white text-blue-700 border border-blue-500">
                        Justification Required
                      </div>
                    )}
                    {config.gradingCriterionName ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-white text-purple-700 border border-purple-400">
                        <Award className="w-3.5 h-3.5" />
                        {config.gradingCriterionName} (max {config.gradingCriterionMax})
                      </div>
                    ) : (
                      <div className="px-3 py-1 rounded-full text-sm bg-white text-gray-400 border border-gray-200">
                        No grade linked
                      </div>
                    )}
                    {config.includeInCommitteeEval ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-white text-teal-700 border border-teal-400">
                        <Users className="w-3.5 h-3.5" />
                        In Committee Eval
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-white text-orange-700 border border-orange-400">
                      <FileType className="w-3.5 h-3.5" />
                      {config.allowedFileType ? `.${config.allowedFileType} only` : 'Any format'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-8 p-6 bg-white border border-blue-500 rounded-xl">
        <div className="flex items-start gap-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-blue-900 mb-2">Configuration Tips</h3>
            <ul className="text-blue-800 space-y-1 list-disc list-inside">
              <li>Ensure close date/time is after open date/time</li>
              <li>Creating an assessment automatically notifies students via an announcement</li>
              <li>Deleting an assessment also removes the related student announcement</li>
              <li>Students will only see assessments for their enrolled course</li>
              <li>Late submissions require coordinator approval when justification is required</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Assessment Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="!left-4 !right-4 lg:!left-[280px] !top-[5vh] !bottom-[5vh] !translate-x-0 !translate-y-0 !w-auto !max-w-none !h-[90vh] !max-h-[90vh] !rounded-xl overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Assessment</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div>
              <Label htmlFor="new-name">Assessment Name</Label>
              <Input
                id="new-name"
                value={newForm.name}
                onChange={(e) => setNewField('name', e.target.value)}
                placeholder="e.g. Chapter 1 Submission"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="new-description">Description</Label>
              <Textarea
                id="new-description"
                value={newForm.description}
                onChange={(e) => setNewField('description', e.target.value)}
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
                      value={newForm.openDate}
                      onChange={(date) => {
                        setNewField('openDate', date);
                        if (newForm.closeDate && date > newForm.closeDate) setNewField('closeDate', '');
                      }}
                      placeholder="Select open date"
                    />
                  </div>
                  <TimePicker
                    value={newForm.openTime}
                    onChange={(time) => setNewField('openTime', time)}
                    placeholder="Time"
                  />
                </div>
              </div>
              <div>
                <Label>Close Date &amp; Time</Label>
                <div className="mt-2 flex gap-2">
                  <div className="flex-1">
                    <DatePicker
                      value={newForm.closeDate}
                      onChange={(date) => setNewField('closeDate', date)}
                      minDate={newForm.openDate || undefined}
                      placeholder="Select close date"
                    />
                  </div>
                  <TimePicker
                    value={newForm.closeTime}
                    onChange={(time) => setNewField('closeTime', time)}
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
                value={newForm.gradingCriterionId ?? 'none'}
                onValueChange={(val) => setNewField('gradingCriterionId', val === 'none' ? undefined : val)}
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
                value={newForm.allowedFileType ?? 'any'}
                onValueChange={(val) => setNewField('allowedFileType', val === 'any' ? undefined : val)}
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
                  checked={newForm.visible}
                  onCheckedChange={(checked) => setNewField('visible', checked)}
                  className="shrink-0"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-[var(--color-text-900)]">Allow Late Submissions</Label>
                  <p className="text-xs text-[var(--color-text-600)] mt-0.5">Permit submissions after the deadline</p>
                </div>
                <Switch
                  checked={newForm.allowLateSubmission}
                  onCheckedChange={(checked) => setNewField('allowLateSubmission', checked)}
                  className="shrink-0"
                />
              </div>

              {newForm.allowLateSubmission && (
                <div className="flex items-center justify-between gap-4 pl-4 border-l-2 border-[var(--color-border)]">
                  <div className="min-w-0">
                    <Label className="text-[var(--color-text-900)]">Require Justification</Label>
                    <p className="text-xs text-[var(--color-text-600)] mt-0.5">Students must provide a reason for late submission</p>
                  </div>
                  <Switch
                    checked={newForm.requireJustification}
                    onCheckedChange={(checked) => setNewField('requireJustification', checked)}
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
                  checked={newForm.includeInCommitteeEval}
                  onCheckedChange={(checked) => setNewField('includeInCommitteeEval', checked)}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateNew} disabled={isLocked || saving}>
              {saving ? 'Creating…' : 'Create Assessment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
