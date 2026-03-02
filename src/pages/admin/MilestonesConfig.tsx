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
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Settings, Plus, Edit2, Save, X, Trash2, Award } from 'lucide-react';
import { toast } from 'sonner';
import { MilestoneConfig } from '../../types';

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
    const courseIdForNew = isCoordinator && !isAdmin ? coordinatorCourseId : null;
    const courseForNew = isCoordinator && !isAdmin
      ? (coordinatorCourseCode as 'CPIS-498' | 'CPIS-499')
      : selectedCourse;

    const newId = `new-${Date.now()}`;
    const newMilestone: MilestoneConfig = {
      id: newId,
      name: 'New Milestone',
      course: courseForNew ?? selectedCourse,
      courseId: courseIdForNew ?? undefined,
      openDate: new Date().toISOString().split('T')[0],
      closeDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      visible: true,
      allowLateSubmission: false,
      requireJustification: false,
      description: '',
      gradingCriterionId: undefined,
    };
    setConfigs((prev) => [...prev, newMilestone]);
    setEditingId(newId);
  };

  const handleSave = async (config: MilestoneConfig) => {
    setSaving(true);
    try {
      const isNew = config.id.startsWith('new-');

      if (isNew) {
        let courseId = config.courseId;
        if (!courseId) {
          const { data: courses } = await supabase
            .from('courses')
            .select('id')
            .eq('code', config.course)
            .limit(1);
          courseId = courses?.[0]?.id;
        }
        if (!courseId) throw new Error('Could not resolve course');

        const savedId = await createMilestone({ ...config, courseId });
        setConfigs((prev) =>
          prev.map((c) => (c.id === config.id ? { ...c, id: savedId, courseId } : c))
        );
        toast.success('Milestone created and announcement sent to students');
      } else {
        await updateMilestone(config.id, config);
        toast.success('Milestone updated successfully');
      }

      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save milestone');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (configId: string) => {
    if (configId.startsWith('new-')) {
      setConfigs((prev) => prev.filter((c) => c.id !== configId));
    }
    setEditingId(null);
  };

  const handleDelete = async (config: MilestoneConfig) => {
    if (!window.confirm(`Delete milestone "${config.name}"? This will also remove the related announcement.`)) return;
    setDeleting(config.id);
    try {
      await deleteMilestone(config.id);
      setConfigs((prev) => prev.filter((c) => c.id !== config.id));
      toast.success('Milestone deleted');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete milestone');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Layout user={user} pageTitle="Chapter Configuration">
      {isLocked && <LockedBanner />}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          Configure milestone timelines and submission policies
        </p>
        <Button
          variant="primary"
          onClick={handleAddMilestone}
          className="gap-2"
          disabled={isLocked || (isCoordinator && !isAdmin && !coordinatorCourseId)}
        >
          <Plus className="w-4 h-4" />
          Add Milestone
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
            >
              CPIS-498
            </Button>
            <Button
              variant={selectedCourse === 'CPIS-499' ? 'default' : 'outline'}
              onClick={() => setSelectedCourse('CPIS-499')}
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
            No milestones yet. Click &quot;Add Milestone&quot; to create the first one.
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
                    <Label htmlFor="name">Milestone Name</Label>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="openDate">Open Date</Label>
                      <Input
                        id="openDate"
                        type="date"
                        value={config.openDate}
                        onChange={(e) => updateConfigField(config.id, 'openDate', e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="closeDate">Close Date</Label>
                      <Input
                        id="closeDate"
                        type="date"
                        value={config.closeDate}
                        onChange={(e) => updateConfigField(config.id, 'closeDate', e.target.value)}
                        className="mt-2"
                      />
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

                  <div className="space-y-4 p-4 bg-[var(--color-surface-alt)] rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="visible" className="text-[var(--color-text-900)]">
                          Visible to Students
                        </Label>
                        <p className="text-[var(--color-text-600)] mt-1">
                          Make this milestone visible in student dashboards
                        </p>
                      </div>
                      <Switch
                        id="visible"
                        checked={config.visible}
                        onCheckedChange={(checked) => updateConfigField(config.id, 'visible', checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="allowLate" className="text-[var(--color-text-900)]">
                          Allow Late Submissions
                        </Label>
                        <p className="text-[var(--color-text-600)] mt-1">
                          Permit submissions after the deadline
                        </p>
                      </div>
                      <Switch
                        id="allowLate"
                        checked={config.allowLateSubmission}
                        onCheckedChange={(checked) => updateConfigField(config.id, 'allowLateSubmission', checked)}
                      />
                    </div>

                    {config.allowLateSubmission && (
                      <div className="flex items-center justify-between pl-6 border-l-2 border-[var(--color-border)]">
                        <div>
                          <Label htmlFor="requireJustification" className="text-[var(--color-text-900)]">
                            Require Justification
                          </Label>
                          <p className="text-[var(--color-text-600)] mt-1">
                            Students must provide a reason for late submission
                          </p>
                        </div>
                        <Switch
                          id="requireJustification"
                          checked={config.requireJustification}
                          onCheckedChange={(checked) => updateConfigField(config.id, 'requireJustification', checked)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => handleCancel(config.id)}
                      className="gap-2"
                      disabled={saving}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => handleSave(config)}
                      className="gap-2"
                      disabled={isLocked || saving}
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-[var(--color-text-900)] mb-1">{config.name}</h2>
                      {config.description && (
                        <p className="text-[var(--color-text-600)] mb-2">{config.description}</p>
                      )}
                      <p className="text-[var(--color-text-600)]">
                        Opens: {new Date(config.openDate).toLocaleDateString()} •{' '}
                        Closes: {new Date(config.closeDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(config.id)}
                        className="gap-2"
                        disabled={isLocked}
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </Button>
                      {!config.id.startsWith('new-') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(config)}
                          className="gap-2 text-red-600 hover:text-red-700 hover:border-red-400"
                          disabled={isLocked || deleting === config.id}
                        >
                          <Trash2 className="w-4 h-4" />
                          {deleting === config.id ? 'Deleting…' : 'Delete'}
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mt-4">
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
              <li>Ensure close date is after open date</li>
              <li>Creating a milestone automatically notifies students via an announcement</li>
              <li>Deleting a milestone also removes the related student announcement</li>
              <li>Students will only see milestones for their enrolled course</li>
              <li>Late submissions require coordinator approval when justification is required</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
