import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Download,
  MessageSquare,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

interface PresentationSlot {
  projectName: string;
  course: '498' | '499';
  date: string;
  time: string;
  room: string;
  duration: string;
}

export function StudentMyPresentation() {
  const { user } = useAuth();
  
  // Toggle this to simulate before/after publish
  const [isPublished, setIsPublished] = useState(true);
  
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  
  // Mock presentation data
  const presentation: PresentationSlot = {
    projectName: 'Graduation Project Platform',
    course: '498',
    date: 'Monday, December 2, 2024',
    time: '09:00 AM - 09:30 AM',
    room: 'Room A-101',
    duration: '30 minutes',
  };

  const handleAddToCalendar = () => {
    toast.success('Adding to calendar...');
    // In real app, generate .ics file
  };

  const handleRequestChange = () => {
    if (!changeReason.trim()) {
      toast.error('Please provide a reason for the change request');
      return;
    }
    toast.success('Change request sent to admin');
    setShowChangeRequestDialog(false);
    setChangeReason('');
  };

  const handleDownloadSchedule = () => {
    toast.success('Downloading schedule PDF...');
  };

  if (!user) return null;

  return (
    <Layout user={user} pageTitle="My Presentation">
      <div className="max-w-4xl mx-auto">
        {!isPublished ? (
          // Before Publish - Empty State
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-2xl text-[var(--color-text-900)] mb-3">
              Presentation Not Scheduled Yet
            </h2>
            <p className="text-[var(--color-text-600)] mb-6 max-w-md mx-auto">
              Your presentation slot hasn't been assigned yet. You'll receive a notification once the schedule is published by the admin.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-600)]">
              <AlertCircle className="w-4 h-4" />
              <span>Check back soon or wait for an email notification</span>
            </div>
          </div>
        ) : (
          // After Publish - Show Details
          <>
            {/* Main Card */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-8 mb-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      presentation.course === '498'
                        ? 'bg-blue-600 text-white'
                        : 'bg-purple-600 text-white'
                    }`}>
                      CPIS-{presentation.course}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-700 border border-green-200">
                      Confirmed
                    </span>
                  </div>
                  <h1 className="text-2xl text-[var(--color-text-900)] mb-2">
                    {presentation.projectName}
                  </h1>
                  <p className="text-[var(--color-text-600)]">
                    Your final presentation is scheduled
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-5 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-text-600)] mb-1">Date</p>
                      <p className="text-[var(--color-text-900)]">{presentation.date}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-5 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-text-600)] mb-1">Time</p>
                      <p className="text-[var(--color-text-900)]">{presentation.time}</p>
                      <p className="text-xs text-[var(--color-text-600)] mt-1">({presentation.duration})</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-5 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-text-600)] mb-1">Location</p>
                      <p className="text-[var(--color-text-900)]">{presentation.room}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-5 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-[var(--color-text-600)] mb-1">Group</p>
                      <p className="text-[var(--color-text-900)]">Group 13</p>
                      <p className="text-xs text-[var(--color-text-600)] mt-1">All members must attend</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 mb-6">
              <Button
                onClick={handleAddToCalendar}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Add to Calendar
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadSchedule}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Schedule
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowChangeRequestDialog(true)}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Request Change
              </Button>
            </div>

            {/* Important Information */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
              <h3 className="text-[var(--color-text-900)] mb-4">Important Information</h3>
              <div className="space-y-3 text-sm text-[var(--color-text-600)]">
                <div className="flex gap-3">
                  <span className="text-blue-600">•</span>
                  <p>Please arrive <strong className="text-[var(--color-text-900)]">10 minutes early</strong> to set up your presentation</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600">•</span>
                  <p>All group members must be present</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600">•</span>
                  <p>Prepare backup copies of your presentation on USB drive</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600">•</span>
                  <p>The presentation will be followed by a Q&A session with the committee</p>
                </div>
                <div className="flex gap-3">
                  <span className="text-blue-600">•</span>
                  <p>Professional attire is required</p>
                </div>
              </div>
            </div>

            {/* Preparation Checklist */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
              <h3 className="text-[var(--color-text-900)] mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Preparation Checklist
              </h3>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-sm text-[var(--color-text-600)]">
                    Presentation slides completed and reviewed
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-sm text-[var(--color-text-600)]">
                    Demo/prototype ready and tested
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-sm text-[var(--color-text-600)]">
                    Final report submitted
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-sm text-[var(--color-text-600)]">
                    Backup materials prepared (USB, printed handouts)
                  </span>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input type="checkbox" className="mt-1" />
                  <span className="text-sm text-[var(--color-text-600)]">
                    Rehearsed with group members
                  </span>
                </label>
              </div>
            </div>

            {/* Debug Toggle */}
            <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPublished(!isPublished)}
                className="text-xs"
              >
                Toggle Published State (Dev Only)
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Change Request Dialog */}
      <Dialog open={showChangeRequestDialog} onOpenChange={setShowChangeRequestDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Schedule Change</DialogTitle>
            <DialogDescription>
              Explain why you need to change your presentation time. The admin will review your request.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="mb-2">Change requests are not guaranteed and must be approved by the admin.</p>
                <p>Valid reasons include:</p>
                <ul className="list-disc list-inside mt-1 text-xs">
                  <li>Medical emergency</li>
                  <li>Exam conflict</li>
                  <li>Critical family matter</li>
                </ul>
              </div>
            </div>

            <Label htmlFor="reason" className="mb-2 block">Reason for Change Request</Label>
            <Textarea
              id="reason"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Please provide a detailed reason..."
              className="min-h-[120px]"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeRequestDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestChange} className="bg-amber-600 hover:bg-amber-700 text-white">
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
