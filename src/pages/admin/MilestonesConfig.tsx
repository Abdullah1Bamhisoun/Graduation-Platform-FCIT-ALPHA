import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getMilestoneConfigs } from '../../services/milestones';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Settings, Plus, Edit2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { MilestoneConfig } from '../../types';

export function AdminMilestonesConfig() {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<'CPIS-498' | 'CPIS-499'>('CPIS-498');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [configs, setConfigs] = useState<MilestoneConfig[]>([]);
  const [initialConfigs, setInitialConfigs] = useState<MilestoneConfig[]>([]);

  useEffect(() => {
    getMilestoneConfigs().then((data) => {
      setConfigs(data);
      setInitialConfigs(data);
    });
  }, []);

  if (!user) return null;

  const filteredConfigs = configs.filter(c => c.course === selectedCourse);

  const handleSave = () => {
    setEditingId(null);
    toast.success('Chapter configuration saved successfully');
  };

  const handleCancel = () => {
    setEditingId(null);
    setConfigs(initialConfigs);
  };

  const handleAddMilestone = () => {
    const newId = `cfg-new-${Date.now()}`;
    const newMilestone: MilestoneConfig = {
      id: newId,
      name: 'New Milestone',
      course: selectedCourse,
      openDate: new Date().toISOString().split('T')[0],
      closeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      visible: true,
      allowLateSubmission: false,
      requireJustification: false,
    };
    setConfigs([...configs, newMilestone]);
    setEditingId(newId);
    toast.success('New milestone created');
  };

  const updateConfig = (id: string, field: string, value: any) => {
    setConfigs(configs.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };

  return (
    <Layout user={user} pageTitle="Chapter Configuration">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          Configure milestone timelines and submission policies
        </p>
        <Button
          variant="primary"
          onClick={handleAddMilestone}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Milestone
        </Button>
      </div>

      {/* Course Selector */}
      <div className="mb-6 flex gap-4">
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
      </div>

      {/* Milestones List */}
      <div className="space-y-4">
        {filteredConfigs.map((config) => (
          <div
            key={config.id}
            className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm"
          >
            <div className="p-6">
              {editingId === config.id ? (
                // Edit Mode
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="name">Milestone Name</Label>
                    <Input
                      id="name"
                      value={config.name}
                      onChange={(e) => updateConfig(config.id, 'name', e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="openDate">Open Date</Label>
                      <Input
                        id="openDate"
                        type="date"
                        value={config.openDate}
                        onChange={(e) => updateConfig(config.id, 'openDate', e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="closeDate">Close Date</Label>
                      <Input
                        id="closeDate"
                        type="date"
                        value={config.closeDate}
                        onChange={(e) => updateConfig(config.id, 'closeDate', e.target.value)}
                        className="mt-2"
                      />
                    </div>
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
                        onCheckedChange={(checked) => updateConfig(config.id, 'visible', checked)}
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
                        onCheckedChange={(checked) => updateConfig(config.id, 'allowLateSubmission', checked)}
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
                          onCheckedChange={(checked) => updateConfig(config.id, 'requireJustification', checked)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSave}
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-[var(--color-text-900)] mb-2">{config.name}</h2>
                      <p className="text-[var(--color-text-600)]">
                        Opens: {new Date(config.openDate).toLocaleDateString()} • 
                        Closes: {new Date(config.closeDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(config.id)}
                      className="gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                  </div>

                  <div className="flex gap-4 mt-4">
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
              <li>Changes are logged in the audit trail</li>
              <li>Students are notified of deadline changes</li>
              <li>Late submissions require coordinator approval when justification is required</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}
