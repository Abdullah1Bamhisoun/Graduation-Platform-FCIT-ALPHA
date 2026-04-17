/**
 * Grade Scheme Editor — Coordinator Only
 *
 * Allows the course coordinator to:
 * - View all grading components and their total marks per course
 * - Edit component names and weights (total must = 100)
 * - View and edit individual rubric criteria for each component
 * - Edit criterion names, max scores, and scale descriptions
 */

import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '../../components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '../../components/ui/alert-dialog';
import { useAuth } from '../../lib/AuthContext';
import {
  getGradingComponents,
  updateGradingComponent,
  getAllRubricCriteria,
  updateRubricCriterion,
  createRubricCriterion,
  deleteRubricCriterion,
  getStudentOutcomes,
  createStudentOutcome,
  updateStudentOutcome,
  deleteStudentOutcome,
  setCriterionOutcomes,
  type GradingComponent,
  type RubricCriterion,
  type StudentOutcome,
} from '../../services/grading-rubric';
import { getCourseTypeFromUUID } from '../../services/courses';
import {
  Save, Edit2, Info, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
  BookOpen, BarChart3, Award, FileText, Users, Plus, Trash2, Loader2,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPONENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  supervisor_eval:          BookOpen,
  progress_reports:         BarChart3,
  committee_eval:           Award,
  coordinator_deliverables: FileText,
  peer_review:              Users,
};

const COMPONENT_COLORS: Record<string, string> = {
  supervisor_eval:          'border-green-200 bg-green-50',
  progress_reports:         'border-indigo-200 bg-indigo-50',
  committee_eval:           'border-orange-200 bg-orange-50',
  coordinator_deliverables: 'border-blue-200 bg-blue-50',
  peer_review:              'border-purple-200 bg-purple-50',
};

const COMPONENT_LABELS_498: Record<string, string> = {
  supervisor_eval:          'Supervisor Evaluation — 4 criteria (1–5 scale) → normalized to N marks',
  progress_reports:         'Dynamic weekly normalization: (submissions / open weeks) × 11 + (responses / open weeks) × 11',
  committee_eval:           '8 criteria (0–5 each) = total marks. Average if multiple evaluators.',
  coordinator_deliverables: 'Manual entry per deliverable. Max per item enforced. Auto-sum.',
  peer_review:              'Student-submitted peer evaluations. Auto-averaged. Max 5.',
};

const COMPONENT_LABELS_499: Record<string, string> = {
  supervisor_eval:          'Supervisor Group Evaluation — 10 criteria (1–5 scale) → normalized to N marks',
  progress_reports:         'Dynamic weekly normalization: (submissions / open weeks) × 11 + (responses / open weeks) × 11',
  committee_eval:           '8 criteria (0–5 each) = total marks. Average if multiple evaluators.',
  coordinator_deliverables: 'Manual entry per deliverable. Max per item enforced. Auto-sum.',
  peer_review:              'Student-submitted peer evaluations. Auto-averaged. Max 5.',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface CriterionRowProps {
  criterion: RubricCriterion;
  isDeliverable: boolean;
  onEdit: (c: RubricCriterion) => void;
  onDelete: (c: RubricCriterion) => void;
  isDeleting?: boolean;
  isOverBudget?: boolean;
}

function CriterionRow({ criterion, onEdit, onDelete, isDeleting, isOverBudget }: CriterionRowProps) {
  return (
    <tr className={`border-b border-[var(--color-border)] text-sm ${isOverBudget ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
      <td className="py-3 px-4 text-[var(--color-text-900)] font-medium">
        {criterion.criterionName}
        {criterion.studentOutcomes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {criterion.studentOutcomes.map(so => (
              <span key={so.id} className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                {so.code}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className={`py-3 px-4 text-center font-semibold tabular-nums ${isOverBudget ? 'text-red-700' : 'text-[var(--color-text-900)]'}`}>
        {criterion.maxRawScore}
        {isOverBudget && <AlertCircle className="w-3 h-3 inline ml-1 text-red-500" />}
      </td>
      <td className="py-3 px-4 text-[var(--color-text-600)] text-xs max-w-[300px]">
        <div className="space-y-0.5">
          {[1,2,3,4,5].map(n => {
            const desc = (criterion as any)[`description${n}`];
            return desc ? <div key={n}><span className="font-semibold text-[var(--color-text-800)]">{n}:</span> {desc}</div> : null;
          })}
        </div>
      </td>
      <td className="py-3 px-4 text-right flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onEdit(criterion)}
          className="h-7 text-xs"
        >
          <Edit2 className="w-3 h-3 mr-1" />Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(criterion)}
          disabled={isDeleting}
          className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
        >
          {isDeleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
          Delete
        </Button>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CoordinatorGradeSchemeEditor() {
  const { user } = useAuth();

  const [activeCourse, setActiveCourse] = useState<'498' | '499' | 'student-outcomes'>('498');

  // Coordinator access control
  const [assignedCourseType, setAssignedCourseType] = useState<'498' | '499' | null>(null);
  const [courseTypeLoading, setCourseTypeLoading] = useState(true);
  const isCoordinator = user?.activeRole === 'coordinator';

  // Components state
  const [components498, setComponents498] = useState<GradingComponent[]>([]);
  const [components499, setComponents499] = useState<GradingComponent[]>([]);
  const [criteria498, setCriteria498]     = useState<RubricCriterion[]>([]);
  const [criteria499, setCriteria499]     = useState<RubricCriterion[]>([]);

  const [loading, setLoading]             = useState(true);
  const [savingComponents, setSavingComponents] = useState(false);

  // Component editing drafts
  const [compDraft498, setCompDraft498] = useState<Record<string, { name: string; marks: string }>>({});
  const [compDraft499, setCompDraft499] = useState<Record<string, { name: string; marks: string }>>({});

  // Expanded component keys
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['supervisor_eval']));

  // Criterion edit dialog
  const [editCriterion, setEditCriterion] = useState<RubricCriterion | null>(null);
  const [criterionDraft, setCriterionDraft] = useState<Partial<RubricCriterion>>({});
  const [savingCriterion, setSavingCriterion] = useState(false);

  // Criterion create dialog
  const [createCriterionOpen, setCreateCriterionOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<{
    criterionName: string;
    maxRawScore: number;
    displayOrder: number;
    descriptions: Record<number, string>;
  }>({
    criterionName: '',
    maxRawScore: 5,
    displayOrder: 0,
    descriptions: {},
  });
  const [creatingCriterion, setCreatingCriterion] = useState(false);

  // Criterion delete dialog
  const [deleteCriterionTarget, setDeleteCriterionTarget] = useState<RubricCriterion | null>(null);
  const [deletingCriterion, setDeletingCriterion] = useState(false);

  // Active component for create/edit dialogs (tracks which component's "Add Criterion" was clicked)
  const [activeComponentKey, setActiveComponentKey] = useState<string>('supervisor_eval');
  const [activeComponentName, setActiveComponentName] = useState<string>('Supervisor Evaluation');
  const [activeComponentCourseType, setActiveComponentCourseType] = useState<'498' | '499'>('498');

  // Student Outcomes state
  const [outcomes498, setOutcomes498] = useState<StudentOutcome[]>([]);
  const [outcomes499, setOutcomes499] = useState<StudentOutcome[]>([]);
  const [soDialogOpen, setSoDialogOpen] = useState(false);
  const [editingSO, setEditingSO] = useState<StudentOutcome | null>(null);
  const [soDraft, setSoDraft] = useState<{ code: string; title: string; description: string; displayOrder: string }>({ code: '', title: '', description: '', displayOrder: '0' });
  const [savingSO, setSavingSO] = useState(false);
  const [deletingSO, setDeletingSO] = useState<StudentOutcome | null>(null);
  const [deletingSOId, setDeletingSOId] = useState(false);
  const [criterionSODraft, setCriterionSODraft] = useState<string[]>([]);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c498, c499, cr498, cr499, so498, so499] = await Promise.all([
        getGradingComponents('498'),
        getGradingComponents('499'),
        getAllRubricCriteria('498'),
        getAllRubricCriteria('499'),
        getStudentOutcomes('498'),
        getStudentOutcomes('499'),
      ]);
      setComponents498(c498);
      setComponents499(c499);
      setCriteria498(cr498);
      setCriteria499(cr499);
      setOutcomes498(so498);
      setOutcomes499(so499);

      // Init drafts
      const d498: Record<string, { name: string; marks: string }> = {};
      for (const c of c498) d498[c.componentKey] = { name: c.componentName, marks: String(c.totalMarks) };
      setCompDraft498(d498);

      const d499: Record<string, { name: string; marks: string }> = {};
      for (const c of c499) d499[c.componentKey] = { name: c.componentName, marks: String(c.totalMarks) };
      setCompDraft499(d499);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Detect coordinator's assigned course ──────────────────────────────────────

  useEffect(() => {
    const detectCoordinatorCourse = async () => {
      setCourseTypeLoading(true);
      try {
        if (isCoordinator && user?.coordinatorCourseId) {
          const courseType = await getCourseTypeFromUUID(user.coordinatorCourseId);
          setAssignedCourseType(courseType);
          // Auto-set active course to coordinator's assigned course
          if (courseType) {
            setActiveCourse(courseType);
          }
        }
      } catch (err) {
        console.error('Failed to detect coordinator course:', err);
      } finally {
        setCourseTypeLoading(false);
      }
    };
    detectCoordinatorCourse();
  }, [isCoordinator, user?.coordinatorCourseId]);

  // ── Component validation ───────────────────────────────────────────────────

  const getTotalMarks = (draft: Record<string, { name: string; marks: string }>) =>
    Object.values(draft).reduce((sum, v) => sum + (parseInt(v.marks) || 0), 0);

  // ── Save components ────────────────────────────────────────────────────────

  const saveComponents = async (courseType: '498' | '499') => {
    const components = courseType === '498' ? components498 : components499;
    const draft      = courseType === '498' ? compDraft498  : compDraft499;
    const total      = getTotalMarks(draft);

    if (total !== 100) {
      toast.error(`Total marks must equal 100. Currently: ${total}`);
      return;
    }

    setSavingComponents(true);
    try {
      await Promise.all(
        components.map(c =>
          updateGradingComponent(c.id, {
            componentName: draft[c.componentKey]?.name ?? c.componentName,
            totalMarks:    parseInt(draft[c.componentKey]?.marks ?? String(c.totalMarks)),
          })
        )
      );
      await loadAll();
      toast.success(`CPIS-${courseType} grade components saved successfully.`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save components.');
    } finally {
      setSavingComponents(false);
    }
  };

  // ── Open criterion editor ──────────────────────────────────────────────────

  const openCriterionEditor = (criterion: RubricCriterion) => {
    setEditCriterion(criterion);
    setCriterionDraft({
      criterionName: criterion.criterionName,
      maxRawScore:   criterion.maxRawScore,
      description1:  criterion.description1,
      description2:  criterion.description2,
      description3:  criterion.description3,
      description4:  criterion.description4,
      description5:  criterion.description5,
    });
    setCriterionSODraft(criterion.studentOutcomes.map(so => so.id));
  };

  // ── Save criterion ─────────────────────────────────────────────────────────

  const saveCriterion = async () => {
    if (!editCriterion) return;
    setSavingCriterion(true);
    try {
      await updateRubricCriterion(editCriterion.id, criterionDraft);
      await setCriterionOutcomes(editCriterion.id, criterionSODraft);
      await loadAll();
      setEditCriterion(null);
      toast.success('Criterion updated successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update criterion.');
    } finally {
      setSavingCriterion(false);
    }
  };

  // ── Student Outcome handlers ───────────────────────────────────────────────

  const openSODialog = (so?: StudentOutcome) => {
    setEditingSO(so ?? null);
    setSoDraft({
      code:         so?.code ?? '',
      title:        so?.title ?? '',
      description:  so?.description ?? '',
      displayOrder: String(so?.displayOrder ?? 0),
    });
    setSoDialogOpen(true);
  };

  const handleSaveSO = async (courseType: '498' | '499') => {
    if (!soDraft.code.trim() || !soDraft.title.trim()) {
      toast.error('Code and title are required'); return;
    }
    setSavingSO(true);
    try {
      if (editingSO) {
        await updateStudentOutcome(editingSO.id, {
          code: soDraft.code, title: soDraft.title,
          description: soDraft.description, displayOrder: parseInt(soDraft.displayOrder) || 0,
        });
      } else {
        await createStudentOutcome({
          courseType, code: soDraft.code, title: soDraft.title,
          description: soDraft.description, displayOrder: parseInt(soDraft.displayOrder) || 0,
        });
      }
      await loadAll();
      setSoDialogOpen(false);
      toast.success(editingSO ? 'Student outcome updated.' : 'Student outcome created.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save student outcome.');
    } finally {
      setSavingSO(false);
    }
  };

  const handleDeleteSO = async () => {
    if (!deletingSO) return;
    setDeletingSOId(true);
    try {
      await deleteStudentOutcome(deletingSO.id);
      await loadAll();
      setDeletingSO(null);
      toast.success('Student outcome removed.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove student outcome.');
    } finally {
      setDeletingSOId(false);
    }
  };

  // ── Create/Delete Criterion handlers ────────────────────────────────────────

  const handleCreateCriterion = async () => {
    if (!createDraft.criterionName.trim()) {
      toast.error('Criterion name is required');
      return;
    }
    if (createDraft.maxRawScore < 1 || createDraft.maxRawScore > 100) {
      toast.error('Max raw score must be between 1 and 100');
      return;
    }

    const criterionKey = `${activeComponentKey}_${createDraft.criterionName
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')}`;

    setCreatingCriterion(true);
    try {
      const newCrit = await createRubricCriterion({
        courseType: activeComponentCourseType,
        componentKey: activeComponentKey,
        criterionKey,
        criterionName: createDraft.criterionName.trim(),
        maxRawScore: createDraft.maxRawScore,
        description1: createDraft.descriptions[1] || undefined,
        description2: createDraft.descriptions[2] || undefined,
        description3: createDraft.descriptions[3] || undefined,
        description4: createDraft.descriptions[4] || undefined,
        description5: createDraft.descriptions[5] || undefined,
        displayOrder: createDraft.displayOrder,
      });

      if (criterionSODraft.length > 0) {
        await setCriterionOutcomes(newCrit.id, criterionSODraft);
      }

      setCreateCriterionOpen(false);
      setCreateDraft({ criterionName: '', maxRawScore: 5, displayOrder: 0, descriptions: {} });
      setCriterionSODraft([]);
      await loadAll();

      toast.success('Rubric criterion created successfully');
    } catch (err: any) {
      if (err.message?.includes('unique')) {
        toast.error('A criterion with this name already exists for this component');
      } else {
        toast.error(err?.message || 'Failed to create criterion');
      }
    } finally {
      setCreatingCriterion(false);
    }
  };

  const handleDeleteCriterion = async () => {
    if (!deleteCriterionTarget) return;
    setDeletingCriterion(true);
    try {
      await deleteRubricCriterion(deleteCriterionTarget.id);

      // Optimistic update: remove from local state
      if (activeComponentCourseType === '498') {
        setCriteria498(prev => prev.filter(c => c.id !== deleteCriterionTarget.id));
      } else {
        setCriteria499(prev => prev.filter(c => c.id !== deleteCriterionTarget.id));
      }

      toast.success('Criterion deleted successfully');
      setDeleteCriterionTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete criterion');
    } finally {
      setDeletingCriterion(false);
    }
  };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const toggleExpand = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (!user) return null;

  // ── Course panel ───────────────────────────────────────────────────────────

  const CoursePanel = ({ courseType }: { courseType: '498' | '499' }) => {
    const components  = courseType === '498' ? components498 : components499;
    const criteria    = courseType === '498' ? criteria498   : criteria499;
    const draft       = courseType === '498' ? compDraft498  : compDraft499;
    const setDraft    = courseType === '498' ? setCompDraft498 : setCompDraft499;
    const compLabels  = courseType === '498' ? COMPONENT_LABELS_498 : COMPONENT_LABELS_499;

    const total = getTotalMarks(draft);
    const totalOk = total === 100;

    // Check if any deliverable component has criteria sum exceeding its total marks
    const overBudgetComponents = components
      .filter(comp => comp.componentKey === 'coordinator_deliverables')
      .map(comp => {
        const compCriteria = criteria.filter(c => c.componentKey === comp.componentKey);
        const criteriaSum = compCriteria.reduce((s, c) => s + c.maxRawScore, 0);
        const compTotal = parseInt(draft[comp.componentKey]?.marks ?? String(comp.totalMarks)) || 0;
        return { name: draft[comp.componentKey]?.name ?? comp.componentName, criteriaSum, compTotal, over: criteriaSum > compTotal };
      })
      .filter(x => x.over);

    const criteriaOk = overBudgetComponents.length === 0;
    const canSave = totalOk && criteriaOk;

    return (
      <div className="space-y-6">
        {/* Total mark indicator */}
        <div className={`flex flex-wrap items-center gap-3 p-4 rounded-xl border ${
          canSave
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
        }`}>
          {canSave
            ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            : <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${canSave ? 'text-green-800' : 'text-red-700'}`}>
              {!totalOk
                ? total > 100
                  ? `Total = ${total} marks — ${total - 100} marks over the 100-mark limit`
                  : `Total = ${total} marks — ${100 - total} marks remaining to allocate`
                : !criteriaOk
                ? `Criteria error in: ${overBudgetComponents.map(x => `${x.name} (${x.criteriaSum} / ${x.compTotal})`).join(', ')}`
                : 'Total = 100 marks ✓ Valid scheme'}
            </p>
            <p className="text-xs text-[var(--color-text-600)] mt-0.5">
              {canSave
                ? 'All component weights are balanced correctly.'
                : !totalOk
                ? 'Adjust component weights below so they sum to exactly 100.'
                : 'Criteria sum exceeds component total — edit the highlighted criteria before saving.'}
            </p>
          </div>
          <Button
            onClick={() => saveComponents(courseType)}
            disabled={savingComponents || !canSave}
            className="bg-[#10B981] text-white hover:bg-[#0ea572] w-full sm:w-auto"
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            {savingComponents ? 'Saving…' : 'Save Components'}
          </Button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Changes to component weights and rubric criteria will take effect immediately for all future grading.
            Weekly progress is always auto-calculated — its weight controls the denominator only.
          </span>
        </div>

        {/* Components list */}
        {components.map(comp => {
          const Icon = COMPONENT_ICONS[comp.componentKey] ?? FileText;
          const colorClass = COMPONENT_COLORS[comp.componentKey] ?? 'border-gray-200 bg-gray-50';
          const compCriteria = criteria.filter(c => c.componentKey === comp.componentKey);
          const isExpanded = expanded.has(`${courseType}-${comp.componentKey}`);
          const isDeliverable = comp.componentKey === 'coordinator_deliverables';
          const isAutoCalc = comp.componentKey === 'progress_reports' || comp.componentKey === 'peer_review';
          const label = compLabels[comp.componentKey] ?? '';

          return (
            <div key={comp.componentKey} className={`rounded-xl border ${colorClass} overflow-hidden`}>
              {/* Component header */}
              <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <Icon className="w-5 h-5 text-[var(--color-text-700)] shrink-0 mt-1 sm:mt-0" />
                <div className="flex-1 w-full min-w-0">
                  <Input
                    value={draft[comp.componentKey]?.name ?? comp.componentName}
                    onChange={e => setDraft(prev => ({
                      ...prev,
                      [comp.componentKey]: { ...prev[comp.componentKey], name: e.target.value }
                    }))}
                    className="h-8 text-sm font-medium bg-white border-[var(--color-border)] w-full sm:max-w-xs"
                    disabled={isAutoCalc}
                  />
                  {label && (
                    <p className="text-xs text-[var(--color-text-600)] mt-1">{label}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <div>
                    <Label className="text-xs text-[var(--color-text-600)]">Total Marks</Label>
                    {(() => {
                      const thisVal = parseInt(draft[comp.componentKey]?.marks ?? String(comp.totalMarks)) || 0;
                      const otherTotal = total - thisVal;
                      const maxAllowed = 100 - otherTotal;
                      const isOver = thisVal > maxAllowed;
                      return (
                        <div>
                          <Input
                            type="number"
                            min={0}
                            max={maxAllowed}
                            value={draft[comp.componentKey]?.marks ?? comp.totalMarks}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              const newOtherTotal = total - thisVal;
                              if (val > 100 - newOtherTotal) return;
                              setDraft(prev => ({
                                ...prev,
                                [comp.componentKey]: { ...prev[comp.componentKey], marks: e.target.value }
                              }));
                            }}
                            className={`w-20 text-center h-8 text-sm font-bold bg-white ${
                              isOver
                                ? 'border-red-400 ring-1 ring-red-400 text-red-700'
                                : 'border-[var(--color-border)]'
                            }`}
                          />
                          <p className={`text-xs mt-0.5 text-center tabular-nums ${
                            isOver ? 'text-red-600 font-semibold' : 'text-[var(--color-text-400)]'
                          }`}>
                            {isOver ? `max ${maxAllowed}` : `/ ${maxAllowed} avail.`}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {!isAutoCalc && (
                    <button
                      onClick={() => toggleExpand(`${courseType}-${comp.componentKey}`)}
                      className="p-1.5 rounded-lg hover:bg-white/60 transition-colors mt-4"
                      title={isExpanded ? 'Collapse criteria' : 'Expand criteria'}
                    >
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-[var(--color-text-600)]" />
                        : <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Criteria table (expanded) */}
              {isExpanded && !isAutoCalc && (() => {
                const criteriaSum = compCriteria.reduce((s, c) => s + c.maxRawScore, 0);
                const compTotalMarks = parseInt(draft[comp.componentKey]?.marks ?? String(comp.totalMarks)) || 0;
                const criteriaOver = isDeliverable && criteriaSum > compTotalMarks;
                const criteriaRemaining = isDeliverable ? compTotalMarks - criteriaSum : null;

                return (
                  <div className="border-t border-[var(--color-border)] bg-white">
                    <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--color-border)]">
                      <div>
                        <p className={`text-xs font-semibold uppercase tracking-wide ${criteriaOver ? 'text-red-700' : 'text-[var(--color-text-700)]'}`}>
                          Rubric Criteria ({compCriteria.length} items)
                          {` · Sum = ${criteriaSum}`}
                          {isDeliverable && ` / ${compTotalMarks}`}
                        </p>
                        {isDeliverable ? (
                          criteriaOver ? (
                            <p className="text-xs text-red-600 font-semibold mt-0.5 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              Criteria sum ({criteriaSum}) exceeds component total ({compTotalMarks}) — reduce criterion scores by {criteriaSum - compTotalMarks}
                            </p>
                          ) : (
                            <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                              {criteriaRemaining === 0
                                ? '✓ Criteria sum matches component total'
                                : `${criteriaRemaining} marks remaining to allocate across criteria`}
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                            Normalized to {compTotalMarks} marks
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveComponentKey(comp.componentKey);
                          setActiveComponentName(draft[comp.componentKey]?.name ?? comp.componentName);
                          setActiveComponentCourseType(courseType);
                          setCreateCriterionOpen(true);
                        }}
                        disabled={isDeliverable && criteriaRemaining !== null && criteriaRemaining <= 0}
                        className="bg-purple-600 text-white hover:bg-purple-700 gap-1.5 h-7 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isDeliverable && criteriaRemaining !== null && criteriaRemaining <= 0 ? 'No marks remaining — increase component total or reduce existing criteria' : undefined}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Criterion
                        {isDeliverable && criteriaRemaining !== null && criteriaRemaining > 0 && (
                          <span className="ml-1 text-purple-200">({criteriaRemaining} left)</span>
                        )}
                      </Button>
                    </div>

                    {/* Over-budget warning banner */}
                    {criteriaOver && (
                      <div className="mx-4 mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          The sum of criteria max scores ({criteriaSum}) exceeds the component's total marks ({compTotalMarks}).
                          Edit the highlighted criteria to bring the sum down to {compTotalMarks} or increase the component's Total Marks above.
                        </span>
                      </div>
                    )}

                    {compCriteria.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[var(--color-text-600)]">
                        No criteria defined yet.
                      </div>
                    ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
                          <tr>
                            <th className="py-2 px-4 text-left text-xs text-[var(--color-text-700)]">Criterion</th>
                            <th className="py-2 px-4 text-center text-xs text-[var(--color-text-700)] w-24">
                              Max Score
                            </th>
                            <th className="py-2 px-4 text-left text-xs text-[var(--color-text-700)]">Scale Descriptions</th>
                            <th className="py-2 px-4 text-right text-xs text-[var(--color-text-700)] w-20">Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compCriteria.map(c => (
                            <CriterionRow
                              key={c.id}
                              criterion={c}
                              isDeliverable={isDeliverable}
                              onEdit={openCriterionEditor}
                              onDelete={crit => {
                                setActiveComponentCourseType(courseType);
                                setDeleteCriterionTarget(crit);
                              }}
                              isDeleting={deletingCriterion && deleteCriterionTarget?.id === c.id}
                              isOverBudget={criteriaOver}
                            />
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={`border-t-2 ${criteriaOver ? 'bg-red-50 border-red-300' : 'bg-[var(--color-primary-50)] border-[var(--color-border)]'}`}>
                            <td className={`py-2 px-4 text-xs font-bold ${criteriaOver ? 'text-red-800' : 'text-[var(--color-text-800)]'}`}>
                              Total
                            </td>
                            <td className={`py-2 px-4 text-center text-xs font-bold tabular-nums ${criteriaOver ? 'text-red-700' : ''}`}>
                              {criteriaSum}
                              {isDeliverable && (
                                <span className={`ml-1 font-normal ${criteriaOver ? 'text-red-500' : 'text-[var(--color-text-400)]'}`}>
                                  / {compTotalMarks}
                                </span>
                              )}
                            </td>
                            <td />
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
        })}

        {/* Summary table */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-4">
          <h4 className="text-sm font-semibold text-[var(--color-text-800)] mb-3">
            CPIS-{courseType} Grade Scheme Summary
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="pb-2 text-left text-[var(--color-text-700)]">Component</th>
                <th className="pb-2 text-center text-[var(--color-text-700)]">Evaluator</th>
                <th className="pb-2 text-center text-[var(--color-text-700)] w-24">Marks</th>
              </tr>
            </thead>
            <tbody>
              {components.map(c => (
                <tr key={c.componentKey} className="border-b border-[var(--color-border)]">
                  <td className="py-2 text-[var(--color-text-900)]">
                    {draft[c.componentKey]?.name ?? c.componentName}
                  </td>
                  <td className="py-2 text-center text-[var(--color-text-600)] capitalize">{c.evaluatorRole}</td>
                  <td className="py-2 text-center font-semibold tabular-nums">
                    {draft[c.componentKey]?.marks ?? c.totalMarks}
                  </td>
                </tr>
              ))}
              <tr className="bg-[var(--color-primary-50)]">
                <td className="py-2 font-bold text-[var(--color-text-900)]" colSpan={2}>Grand Total</td>
                <td className={`py-2 text-center font-bold tabular-nums text-lg ${totalOk ? 'text-green-700' : 'text-red-600'}`}>
                  {total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Student Outcomes Panel ────────────────────────────────────────────────

  const StudentOutcomesPanel = () => {
    const soCoursePairs: { label: string; courseType: '498' | '499'; outcomes: StudentOutcome[] }[] = isCoordinator && assignedCourseType
      ? [{ label: `CPIS-${assignedCourseType}`, courseType: assignedCourseType, outcomes: assignedCourseType === '498' ? outcomes498 : outcomes499 }]
      : [
          { label: 'CPIS-498', courseType: '498', outcomes: outcomes498 },
          { label: 'CPIS-499', courseType: '499', outcomes: outcomes499 },
        ];

    return (
      <div className="space-y-8">
        <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-800">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Define Student Outcomes (SO1, SO2…) here, then link them to rubric criteria when editing a criterion.
            Linked SOs appear on each criterion row and in CSV exports.
          </span>
        </div>

        {soCoursePairs.map(({ label, courseType, outcomes }) => (
          <div key={courseType} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--color-border)] bg-indigo-50">
              <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                {label} — Student Outcomes ({outcomes.length})
              </h3>
              <Button
                size="sm"
                onClick={() => { setActiveComponentCourseType(courseType); openSODialog(); }}
                className="bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5 h-8"
              >
                <Plus className="w-3.5 h-3.5" />Add Outcome
              </Button>
            </div>

            {outcomes.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-[var(--color-text-500)]">
                No student outcomes defined yet. Click <strong>Add Outcome</strong> to create SO1, SO2, etc.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="py-2 px-4 text-left text-xs text-[var(--color-text-700)] w-24">Code</th>
                    <th className="py-2 px-4 text-left text-xs text-[var(--color-text-700)]">Title</th>
                    <th className="py-2 px-4 text-left text-xs text-[var(--color-text-700)]">Description</th>
                    <th className="py-2 px-4 text-right text-xs text-[var(--color-text-700)] w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomes.map(so => (
                    <tr key={so.id} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-xs bg-indigo-100 text-indigo-700 border border-indigo-200">
                          {so.code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--color-text-900)]">{so.title}</td>
                      <td className="py-3 px-4 text-[var(--color-text-600)] text-xs max-w-xs">{so.description || '—'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => { setActiveComponentCourseType(courseType); openSODialog(so); }}>
                            <Edit2 className="w-3 h-3" />Edit
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => setDeletingSO(so)}>
                            <Trash2 className="w-3 h-3" />Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        {/* Criteria × SO mapping overview */}
        {soCoursePairs.map(({ label, courseType, outcomes }) => {
          if (outcomes.length === 0) return null;
          const critList = courseType === '498' ? criteria498 : criteria499;
          const withSOs = critList.filter(c => c.studentOutcomes.length > 0);
          if (withSOs.length === 0) return null;
          return (
            <div key={`map-${courseType}`} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
              <h4 className="font-semibold text-[var(--color-text-800)] mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                {label} — Criteria to SO Mapping
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
                    <tr>
                      <th className="py-2 px-3 text-left text-xs text-[var(--color-text-700)]">Criterion</th>
                      <th className="py-2 px-3 text-left text-xs text-[var(--color-text-700)]">Component</th>
                      {outcomes.map(so => (
                        <th key={so.id} className="py-2 px-2 text-center text-xs text-[var(--color-text-700)] w-14">
                          <span className="inline-block px-1.5 rounded bg-indigo-100 text-indigo-700 font-bold">{so.code}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {withSOs.map(c => (
                      <tr key={c.id} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-[var(--color-text-900)]">{c.criterionName}</td>
                        <td className="py-2 px-3 text-[var(--color-text-600)] text-xs capitalize">{c.componentKey.replace(/_/g, ' ')}</td>
                        {outcomes.map(so => (
                          <td key={so.id} className="py-2 px-2 text-center">
                            {c.studentOutcomes.some(s => s.id === so.id)
                              ? <CheckCircle className="w-4 h-4 text-indigo-600 mx-auto" />
                              : <span className="text-gray-200">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout user={user} pageTitle="Grade Scheme Editor">
        <div className="p-6 text-[var(--color-text-600)]">Loading grade scheme…</div>
      </Layout>
    );
  }

  return (
    <Layout user={user} pageTitle="Grade Scheme Editor">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Configure the official grading scheme for both courses. All criteria below are the defaults
          set per the official policy. Adjust marks and descriptions as needed.
        </p>
      </div>

      <Tabs value={activeCourse} onValueChange={v => setActiveCourse(v as any)}>
        <TabsList className="mb-6 flex flex-wrap gap-3 bg-transparent p-1 h-auto">
          {isCoordinator ? (
            /* Coordinator: single course tab + Student Outcomes */
            <>
              {courseTypeLoading ? (
                <div className="text-sm text-[var(--color-text-500)] px-4 py-2">Loading...</div>
              ) : assignedCourseType ? (
                <TabsTrigger
                  value={assignedCourseType}
                  className="px-4 py-2.5 border-2 border-[var(--color-border)] rounded-lg font-medium transition-all duration-200 data-[state=active]:border-green-600 data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:hover:border-[var(--color-primary-400)] data-[state=inactive]:hover:bg-[var(--color-surface-alt)]"
                >
                  CPIS-{assignedCourseType} — {assignedCourseType === '498' ? 'Senior Project I' : 'Senior Project II'}
                </TabsTrigger>
              ) : null}
            </>
          ) : (
            /* Admin: both course tabs */
            <>
              <TabsTrigger value="498" className="px-4 py-2.5 border-2 border-[var(--color-border)] rounded-lg font-medium transition-all duration-200 data-[state=active]:border-green-600 data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:hover:border-[var(--color-primary-400)] data-[state=inactive]:hover:bg-[var(--color-surface-alt)]">
                <span className="sm:hidden">CPIS-498</span>
                <span className="hidden sm:inline">CPIS-498 — Senior Project I</span>
              </TabsTrigger>
              <TabsTrigger value="499" className="px-4 py-2.5 border-2 border-[var(--color-border)] rounded-lg font-medium transition-all duration-200 data-[state=active]:border-green-600 data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=inactive]:hover:border-[var(--color-primary-400)] data-[state=inactive]:hover:bg-[var(--color-surface-alt)]">
                <span className="sm:hidden">CPIS-499</span>
                <span className="hidden sm:inline">CPIS-499 — Senior Project II</span>
              </TabsTrigger>
            </>
          )}
          {/* Student Outcomes tab — always shown */}
          <TabsTrigger
            value="student-outcomes"
            className="px-4 py-2.5 border-2 border-[var(--color-border)] rounded-lg font-medium transition-all duration-200 data-[state=active]:border-indigo-600 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=inactive]:hover:border-indigo-400 data-[state=inactive]:hover:bg-indigo-50 flex items-center gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            Student Outcomes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="498"><CoursePanel courseType="498" /></TabsContent>
        <TabsContent value="499"><CoursePanel courseType="499" /></TabsContent>

        {/* ── Student Outcomes Tab ─────────────────────────────────────────── */}
        <TabsContent value="student-outcomes">
          <StudentOutcomesPanel />
        </TabsContent>
      </Tabs>

      {/* ── Criterion Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editCriterion} onOpenChange={open => { if (!open) setEditCriterion(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Criterion — {editCriterion?.criterionName}</DialogTitle>
          </DialogHeader>

          {editCriterion && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1 block">Criterion Name</Label>
                <Input
                  value={criterionDraft.criterionName ?? ''}
                  onChange={e => setCriterionDraft(p => ({ ...p, criterionName: e.target.value }))}
                />
              </div>

              <div>
                <Label className="mb-1 block">
                  Max Score{' '}
                  <span className="text-xs text-[var(--color-text-600)]">
                    (max points for this criterion)
                  </span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={criterionDraft.maxRawScore ?? editCriterion.maxRawScore}
                  onChange={e => setCriterionDraft(p => ({ ...p, maxRawScore: parseInt(e.target.value) || 1 }))}
                  className="w-28"
                />
              </div>

              <div className="space-y-3">
                <Label className="block">Scale Descriptions (1–5) <span className="text-xs text-[var(--color-text-600)] font-normal">— optional rubric criteria</span></Label>
                {[1,2,3,4,5].map(n => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="mt-2 w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-bold text-[var(--color-primary-700)]">
                      {n}
                    </span>
                    <Textarea
                      value={(criterionDraft as any)[`description${n}`] ?? (editCriterion as any)[`description${n}`] ?? ''}
                      onChange={e => setCriterionDraft(p => ({ ...p, [`description${n}`]: e.target.value }))}
                      className="flex-1 min-h-[60px] text-sm"
                      placeholder={`Description for score ${n}…`}
                    />
                  </div>
                ))}
              </div>

              {/* Student Outcomes picker */}
              {(() => {
                const soList = editCriterion?.courseType === '499' ? outcomes499 : outcomes498;
                if (soList.length === 0) return (
                  <div className="text-xs text-[var(--color-text-500)] border border-dashed border-[var(--color-border)] rounded-lg px-3 py-2">
                    No student outcomes defined yet — add them in the <strong>Student Outcomes</strong> tab.
                  </div>
                );
                return (
                  <div>
                    <Label className="mb-2 block flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      Student Outcomes (SO) <span className="text-xs font-normal text-[var(--color-text-500)]">— select all that apply</span>
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {soList.map(so => {
                        const checked = criterionSODraft.includes(so.id);
                        return (
                          <button
                            key={so.id}
                            type="button"
                            onClick={() => setCriterionSODraft(prev =>
                              checked ? prev.filter(id => id !== so.id) : [...prev, so.id]
                            )}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                              checked
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                            }`}
                          >
                            {checked && <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />}
                            <span className="font-bold">{so.code}</span>
                            <span className="text-xs opacity-75">— {so.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCriterion(null)}>Cancel</Button>
            <Button
              onClick={saveCriterion}
              disabled={savingCriterion}
              className="bg-[#10B981] text-black hover:bg-[#0ea572]"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingCriterion ? 'Saving…' : 'Save Criterion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Rubric Criterion Dialog ───────────────────────────────────── */}
      <Dialog open={createCriterionOpen} onOpenChange={setCreateCriterionOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Rubric Criterion</DialogTitle>
            <DialogDescription>
              Add a new criterion to the {activeComponentName} evaluation component.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Criterion Name */}
            <div>
              <Label className="mb-1 block">Criterion Name *</Label>
              <Input
                placeholder="e.g., Literature Review, System Analysis"
                value={createDraft.criterionName}
                onChange={e => setCreateDraft(p => ({ ...p, criterionName: e.target.value }))}
              />
            </div>

            {/* Max Raw Score */}
            <div>
              <Label className="mb-1 block">Max Score</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={createDraft.maxRawScore}
                  onChange={e => setCreateDraft(p => ({ ...p, maxRawScore: Number(e.target.value) }))}
                  className="w-24"
                />
                <span className="text-xs text-[var(--color-text-500)]">
                  (1–5 for Likert scale, up to 100 for deliverables)
                </span>
              </div>
            </div>

            {/* Scale Descriptions — shown for all components */}
            <div className="border-t border-[var(--color-border)] pt-3 mt-3">
              <p className="text-xs font-medium text-[var(--color-text-600)] mb-2">
                Scale Descriptions (Optional) — rubric criteria for each score level
              </p>
              {[1, 2, 3, 4, 5].map(level => (
                <div key={level} className="mb-2">
                  <Label className="text-xs mb-0.5 block">
                    Level {level} Description
                  </Label>
                  <Textarea
                    placeholder={`e.g., "Excellent work showing mastery"`}
                    value={createDraft.descriptions[level] || ''}
                    onChange={e =>
                      setCreateDraft(p => ({
                        ...p,
                        descriptions: { ...p.descriptions, [level]: e.target.value },
                      }))
                    }
                    className="min-h-[50px] text-xs"
                  />
                </div>
              ))}
            </div>

            {/* Display Order */}
            <div>
              <Label className="mb-1 block">Display Order (Optional)</Label>
              <Input
                type="number"
                min="0"
                value={createDraft.displayOrder}
                onChange={e => setCreateDraft(p => ({ ...p, displayOrder: Number(e.target.value) }))}
                className="w-24"
              />
              <p className="text-xs text-[var(--color-text-400)] mt-1">
                Lower numbers appear first in the table
              </p>
            </div>

            {/* Student Outcomes picker for create dialog */}
            {(() => {
              const soList = activeComponentCourseType === '499' ? outcomes499 : outcomes498;
              if (soList.length === 0) return (
                <div className="text-xs text-[var(--color-text-500)] border border-dashed border-[var(--color-border)] rounded-lg px-3 py-2">
                  No student outcomes defined — add them in the <strong>Student Outcomes</strong> tab first.
                </div>
              );
              return (
                <div>
                  <Label className="mb-2 block flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    Student Outcomes (SO)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {soList.map(so => {
                      const checked = criterionSODraft.includes(so.id);
                      return (
                        <button
                          key={so.id}
                          type="button"
                          onClick={() => setCriterionSODraft(prev =>
                            checked ? prev.filter(id => id !== so.id) : [...prev, so.id]
                          )}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                            checked
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300'
                          }`}
                        >
                          {checked && <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />}
                          <span className="font-bold">{so.code}</span>
                          <span className="text-xs opacity-75">— {so.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateCriterionOpen(false);
                setCriterionSODraft([]);
                setCreateDraft({
                  criterionName: '',
                  maxRawScore: 5,
                  displayOrder: 0,
                  descriptions: {},
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCriterion}
              disabled={creatingCriterion}
              className="bg-purple-600 text-white hover:bg-purple-700"
            >
              {creatingCriterion ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Criterion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Criterion Confirmation Dialog ──────────────────────────────── */}
      <AlertDialog open={!!deleteCriterionTarget} onOpenChange={open => !open && setDeleteCriterionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rubric Criterion?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteCriterionTarget?.criterionName}</strong> will be marked as inactive.
              {'\n\n'}
              Existing evaluations using this criterion will remain in the historical record, but supervisors
              won't be able to use this criterion for new evaluations. This action is permanent and cannot be
              undone through the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCriterion}
              disabled={deletingCriterion}
              className="bg-red-600 hover:bg-red-700 text-black"
            >
              {deletingCriterion ? 'Deleting…' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Student Outcome Create / Edit Dialog ─────────────────────────────── */}
      <Dialog open={soDialogOpen} onOpenChange={open => { if (!open) setSoDialogOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              {editingSO ? 'Edit Student Outcome' : 'Add Student Outcome'}
            </DialogTitle>
            <DialogDescription>
              {editingSO
                ? `Update the details for ${editingSO.code}.`
                : `Define a new Student Outcome (SO) for CPIS-${activeComponentCourseType}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Code <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. SO1"
                  value={soDraft.code}
                  onChange={e => setSoDraft(p => ({ ...p, code: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1 block">Display Order</Label>
                <Input
                  type="number"
                  min="0"
                  value={soDraft.displayOrder}
                  onChange={e => setSoDraft(p => ({ ...p, displayOrder: e.target.value }))}
                  className="w-full"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Title <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g. Apply computing knowledge to solve real-world problems"
                value={soDraft.title}
                onChange={e => setSoDraft(p => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1 block">Description <span className="text-xs font-normal text-[var(--color-text-500)]">— optional</span></Label>
              <Textarea
                placeholder="Detailed description of this student outcome…"
                value={soDraft.description}
                onChange={e => setSoDraft(p => ({ ...p, description: e.target.value }))}
                className="min-h-[80px] text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSoDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => handleSaveSO(activeComponentCourseType)}
              disabled={savingSO}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {savingSO ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />{editingSO ? 'Update Outcome' : 'Create Outcome'}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Student Outcome Delete Confirmation ──────────────────────────────── */}
      <AlertDialog open={!!deletingSO} onOpenChange={open => { if (!open) setDeletingSO(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student Outcome?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deletingSO?.code} — {deletingSO?.title}</strong> will be permanently removed.
              {'\n\n'}
              All criteria currently linked to this outcome will lose that link.
              This cannot be undone through the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSO}
              disabled={deletingSOId}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingSOId ? 'Deleting…' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
