import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { getChapterSubmissionsForCoordinator } from '../../services/submissions';
import { getCoordinatorGroupsWithGrades } from '../../services/groups';
import type { ChapterSubmission, CoordinatorChapterSubmissionsResult } from '../../services/submissions';
import type { CoordinatorGroupWithGrades } from '../../services/groups';

interface CoordinatorChapterSubmissionsTabProps {
  courseType: '498' | '499';
}

export function CoordinatorChapterSubmissionsTab({ courseType }: CoordinatorChapterSubmissionsTabProps) {
  const [submissions, setSubmissions] = useState<ChapterSubmission[]>([]);
  const [stats, setStats] = useState<CoordinatorChapterSubmissionsResult['stats']>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [groups, setGroups] = useState<CoordinatorGroupWithGrades[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Load chapter submissions and groups on mount
  useEffect(() => {
    loadData();
  }, [courseType]);

  async function loadData() {
    setIsLoading(true);
    try {
      // Load both submissions and groups in parallel
      const [submissionsData, groupsData] = await Promise.all([
        getChapterSubmissionsForCoordinator(courseType, selectedGroupFilter === 'all' ? undefined : selectedGroupFilter),
        getCoordinatorGroupsWithGrades(courseType),
      ]);

      setSubmissions(submissionsData.submissions);
      setStats(submissionsData.stats);
      setGroups(groupsData);
    } catch (error) {
      console.error('Error loading chapter submissions:', error);
      toast.error('Failed to load chapter submissions');
    } finally {
      setIsLoading(false);
    }
  }

  // Reload when filter changes
  useEffect(() => {
    if (!isLoading) {
      loadData();
    }
  }, [selectedGroupFilter, courseType]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'changes-requested':
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
      case 'under-review':
      case 'submitted':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'changes-requested':
        return 'Changes Requested';
      case 'rejected':
        return 'Rejected';
      case 'pending':
      case 'under-review':
        return 'Under Review';
      case 'submitted':
        return 'Submitted';
      default:
        return status;
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'changes-requested':
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
      case 'under-review':
      case 'submitted':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Description Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Chapter Submissions:</strong> View all chapter submissions from groups in your assigned course.
          This is a read-only view for monitoring student progress.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wide">Total Submissions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-yellow-600 uppercase tracking-wide">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 uppercase tracking-wide">Approved</p>
              <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 uppercase tracking-wide">Changes Requested</p>
              <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
        </Card>
      </div>

      {/* Group Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filter by Group:</label>
        <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a group..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                Group {group.number} — {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submissions Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Group</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Student</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Chapter</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Version</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading submissions...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No submissions found for the selected filter.
                  </td>
                </tr>
              ) : (
                submissions.map((submission, idx) => (
                  <tr key={submission.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {submission.groupNumber ? `Group ${submission.groupNumber}` : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {submission.studentName || 'Unknown Student'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {submission.milestoneName || 'Unknown Milestone'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      v{submission.currentVersion}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(submission.submittedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(submission.status)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(submission.status)}`}>
                          {getStatusLabel(submission.status)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info Footer */}
      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
        <p>
          📌 <strong>Note:</strong> As a coordinator, you view submissions for informational purposes.
          Chapter approval is managed by supervisors. Use this tab to track student progress and ensure timely submissions.
        </p>
      </div>
    </div>
  );
}
