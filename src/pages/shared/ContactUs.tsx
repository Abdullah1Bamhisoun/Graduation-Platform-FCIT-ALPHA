import { useState, useEffect } from 'react';
import { Mail, Phone, User, BookOpen, Edit, Trash2, Plus, HeadphonesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  getCoordinatorContacts,
  upsertCoordinatorContact,
  deleteCoordinatorContact,
  getSupportInfo,
  upsertSupportInfo,
  CoordinatorContact,
  SupportInfo,
} from '../../services/contact';

// ─── Coordinator Card Edit Dialog ─────────────────────────────────────────────

interface CoordEditForm {
  phone: string;
  customName: string;
}

interface CoordDialogProps {
  contact: CoordinatorContact;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Pick<CoordinatorContact, 'courseId' | 'phone' | 'customName'>) => void;
}

function CoordEditDialog({ contact, open, onClose, onSaved }: CoordDialogProps) {
  const [form, setForm] = useState<CoordEditForm>({
    phone: contact.phone ?? '',
    customName: contact.customName ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ phone: contact.phone ?? '', customName: contact.customName ?? '' });
  }, [contact]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertCoordinatorContact(
        contact.courseId,
        {
          phone: form.phone.trim() || null,
          customName: form.customName.trim() || null,
        }
      );
      onSaved({
        courseId: contact.courseId,
        phone: form.phone.trim() || null,
        customName: form.customName.trim() || null,
      });
      toast.success('Contact info updated');
      onClose();
    } catch {
      toast.error('Failed to save contact info');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Coordinator Contact</DialogTitle>
          <DialogDescription>
            {contact.courseCode} — {contact.courseName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Email (auto-fetched, read-only)</Label>
            <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-600)] text-sm">
              <Mail className="w-4 h-4 shrink-0" />
              <span>{contact.coordinatorEmail ?? '—'}</span>
            </div>
          </div>

          <div>
            <Label htmlFor="coord-name">Display Name <span className="text-[var(--color-text-400)] font-normal">(optional)</span></Label>
            <Input
              id="coord-name"
              className="mt-1.5"
              placeholder="e.g. Dr. Ahmed Al-Ghamdi"
              value={form.customName}
              onChange={(e) => setForm((f) => ({ ...f, customName: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="coord-phone">Phone <span className="text-[var(--color-text-400)] font-normal">(optional)</span></Label>
            <Input
              id="coord-phone"
              className="mt-1.5"
              placeholder="e.g. +966 12 695 2000"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Support Info Edit Dialog ─────────────────────────────────────────────────

interface SupportDialogProps {
  current: SupportInfo | null;
  open: boolean;
  onClose: () => void;
  onSaved: (info: SupportInfo) => void;
}

interface SupportForm {
  supportEmail: string;
  phone: string;
  description: string;
}

function SupportEditDialog({ current, open, onClose, onSaved }: SupportDialogProps) {
  const [form, setForm] = useState<SupportForm>({
    supportEmail: current?.supportEmail ?? '',
    phone: current?.phone ?? '',
    description: current?.description ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      supportEmail: current?.supportEmail ?? '',
      phone: current?.phone ?? '',
      description: current?.description ?? '',
    });
  }, [current]);

  const handleSave = async () => {
    if (!form.supportEmail.trim()) {
      toast.error('Support email is required');
      return;
    }
    setSaving(true);
    try {
      await upsertSupportInfo(
        {
          supportEmail: form.supportEmail.trim(),
          phone: form.phone.trim() || null,
          description: form.description.trim() || null,
        }
      );
      onSaved({
        id: current?.id ?? null,
        supportEmail: form.supportEmail.trim(),
        phone: form.phone.trim() || null,
        description: form.description.trim() || null,
      });
      toast.success('Support info updated');
      onClose();
    } catch {
      toast.error('Failed to save support info');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{current ? 'Edit Support Info' : 'Add Support Info'}</DialogTitle>
          <DialogDescription>
            This information is displayed to all platform users.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="support-email">Support Email *</Label>
            <Input
              id="support-email"
              className="mt-1.5"
              placeholder="support@university.edu.sa"
              value={form.supportEmail}
              onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="support-phone">Phone <span className="text-[var(--color-text-400)] font-normal">(optional)</span></Label>
            <Input
              id="support-phone"
              className="mt-1.5"
              placeholder="e.g. +966 12 695 2000"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="support-description">Notes <span className="text-[var(--color-text-400)] font-normal">(optional)</span></Label>
            <Textarea
              id="support-description"
              className="mt-1.5"
              rows={3}
              placeholder="Office hours, response time, etc."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Coordinator Contact Card ─────────────────────────────────────────────────

interface CoordCardProps {
  contact: CoordinatorContact;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function CoordCard({ contact, canEdit, canDelete, onEdit, onDelete }: CoordCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        {/* Icon */}
        <div className="p-2.5 sm:p-3 bg-[var(--color-primary-100)] rounded-lg flex-shrink-0">
          <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-primary-700)]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs font-medium text-[var(--color-primary-700)] uppercase tracking-wide mb-0.5">
                Course Coordinator
              </p>
              <h3 className="text-[var(--color-text-900)] text-base font-semibold leading-snug">
                {contact.courseCode} — {contact.courseName}
              </h3>
            </div>
            {(canEdit || canDelete) && (
              <div className="flex gap-1.5 flex-shrink-0">
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onEdit}
                    className="text-yellow-600 border-yellow-400 hover:bg-yellow-50 rounded-full h-7 px-2 text-xs"
                  >
                    <Edit className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                    className="text-white bg-red-600 hover:bg-red-700 rounded-full h-7 px-2 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-sm text-[var(--color-text-700)]">
            {contact.customName && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 shrink-0 text-[var(--color-text-500)]" />
                <span>{contact.customName}</span>
              </div>
            )}
            {contact.coordinatorEmail ? (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 text-[var(--color-text-500)]" />
                <a
                  href={`mailto:${contact.coordinatorEmail}`}
                  className="hover:text-[var(--color-primary-600)] hover:underline truncate"
                >
                  {contact.coordinatorEmail}
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[var(--color-text-400)]">
                <Mail className="w-4 h-4 shrink-0" />
                <span className="italic">No email on record</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-[var(--color-text-500)]" />
                <a
                  href={`tel:${contact.phone}`}
                  className="hover:text-[var(--color-primary-600)] hover:underline"
                >
                  {contact.phone}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Support Info Card ────────────────────────────────────────────────────────

interface SupportCardProps {
  info: SupportInfo | null;
  isAdmin: boolean;
  onEdit: () => void;
}

function SupportCard({ info, isAdmin, onEdit }: SupportCardProps) {
  if (!info) {
    return (
      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="p-2.5 sm:p-3 bg-[var(--color-primary-100)] rounded-lg flex-shrink-0">
            <HeadphonesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-primary-700)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[var(--color-text-900)] text-base font-semibold">Support Team</h3>
              {isAdmin && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onEdit}
                  className="rounded-full h-7 px-3 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add
                </Button>
              )}
            </div>
            <p className="text-sm text-[var(--color-text-500)] mt-1 italic">
              No support contact info has been configured yet.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="p-2.5 sm:p-3 bg-[var(--color-primary-100)] rounded-lg flex-shrink-0">
          <HeadphonesIcon className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-primary-700)]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs font-medium text-[var(--color-primary-700)] uppercase tracking-wide mb-0.5">
                Technical Support
              </p>
              <h3 className="text-[var(--color-text-900)] text-base font-semibold">Support Team</h3>
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="text-yellow-600 border-yellow-400 hover:bg-yellow-50 rounded-full h-7 px-2 text-xs"
              >
                <Edit className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
          </div>

          <div className="space-y-1.5 text-sm text-[var(--color-text-700)]">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 shrink-0 text-[var(--color-text-500)]" />
              <a
                href={`mailto:${info.supportEmail}`}
                className="hover:text-[var(--color-primary-600)] hover:underline truncate"
              >
                {info.supportEmail}
              </a>
            </div>
            {info.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0 text-[var(--color-text-500)]" />
                <a
                  href={`tel:${info.phone}`}
                  className="hover:text-[var(--color-primary-600)] hover:underline"
                >
                  {info.phone}
                </a>
              </div>
            )}
            {info.description && (
              <p className="text-[var(--color-text-600)] text-xs mt-2 leading-relaxed">
                {info.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ContactUs() {
  const { user } = useAuth();
  const [contacts, setContacts]           = useState<CoordinatorContact[]>([]);
  const [supportInfo, setSupportInfo]     = useState<SupportInfo | null>(null);
  const [loading, setLoading]             = useState(true);

  // Dialog state
  const [editingCoord, setEditingCoord]         = useState<CoordinatorContact | null>(null);
  const [editingSupportOpen, setEditingSupportOpen] = useState(false);

  const isAdmin       = user?.activeRole === 'admin';
  const isCoordinator = user?.activeRole === 'coordinator';

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getCoordinatorContacts(),
      getSupportInfo(),
    ]).then(([coords, support]) => {
      setContacts(coords);
      setSupportInfo(support);
    }).finally(() => setLoading(false));
  }, [user?.activeRole]);

  if (!user) return null;

  const handleCoordSaved = (updated: Pick<CoordinatorContact, 'courseId' | 'phone' | 'customName'>) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.courseId === updated.courseId
          ? { ...c, phone: updated.phone, customName: updated.customName }
          : c
      )
    );
  };

  const handleDeleteCoord = async (contact: CoordinatorContact) => {
    if (!confirm(`Clear the optional contact info for ${contact.courseCode}? The coordinator's email will still be shown.`)) return;
    try {
      await deleteCoordinatorContact(contact.courseId);
      setContacts((prev) =>
        prev.map((c) =>
          c.courseId === contact.courseId ? { ...c, phone: null, customName: null } : c
        )
      );
      toast.success('Contact info cleared');
    } catch {
      toast.error('Failed to clear contact info');
    }
  };

  // Determine edit/delete rights per card
  const canEditCoord = (c: CoordinatorContact) => {
    if (isAdmin) return true;
    if (isCoordinator && user.coordinatorCourseId === c.courseId) return true;
    return false;
  };

  const canDeleteCoord = (c: CoordinatorContact) => {
    if (!isAdmin) return false;
    return !!(c.phone || c.customName); // only show delete when there's extra info to clear
  };

  return (
    <Layout user={user} pageTitle="Contact Us">
      {/* Page header */}
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Get in touch with your course coordinator or the platform support team.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <div className="animate-pulse flex gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--color-surface-alt)]" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-[var(--color-surface-alt)] rounded w-1/4" />
                  <div className="h-4 bg-[var(--color-surface-alt)] rounded w-1/2" />
                  <div className="h-3 bg-[var(--color-surface-alt)] rounded w-2/3" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── Section 1: Course Coordinators ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[var(--color-text-900)] font-semibold text-lg">
                Course Coordinators
              </h2>
            </div>

            {contacts.length > 0 ? (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <CoordCard
                    key={contact.courseId}
                    contact={contact}
                    canEdit={canEditCoord(contact)}
                    canDelete={canDeleteCoord(contact)}
                    onEdit={() => setEditingCoord(contact)}
                    onDelete={() => handleDeleteCoord(contact)}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8">
                <div className="text-center">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-300)]" />
                  <p className="text-[var(--color-text-600)]">
                    No coordinator contacts available yet.
                  </p>
                  {isAdmin && (
                    <p className="text-[var(--color-text-500)] text-sm mt-1">
                      Assign coordinators to courses via User Management.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </section>

          {/* ── Section 2: Support Team ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[var(--color-text-900)] font-semibold text-lg">
                Support Team
              </h2>
            </div>
            <SupportCard
              info={supportInfo}
              isAdmin={isAdmin}
              onEdit={() => setEditingSupportOpen(true)}
            />
          </section>
        </div>
      )}

      {/* ── Coordinator Edit Dialog ── */}
      {editingCoord && (
        <CoordEditDialog
          contact={editingCoord}
          open={!!editingCoord}
          onClose={() => setEditingCoord(null)}
          onSaved={handleCoordSaved}
        />
      )}

      {/* ── Support Edit Dialog ── */}
      <SupportEditDialog
        current={supportInfo}
        open={editingSupportOpen}
        onClose={() => setEditingSupportOpen(false)}
        onSaved={setSupportInfo}
      />
    </Layout>
  );
}
