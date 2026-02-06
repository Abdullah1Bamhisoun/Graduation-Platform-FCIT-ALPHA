import { SubmissionStatus } from '../../../types';

interface StatusConfig {
  label: string;
  className: string;
}

const statusConfig: Record<SubmissionStatus, StatusConfig> = {
  'draft': {
    label: 'Draft',
    className: '!bg-white text-gray-700 border-[1.5px] border-gray-400',
  },
  'submitted': {
    label: 'Submitted',
    className: '!bg-white text-blue-600 border-[1.5px] border-blue-500',
  },
  'under-review': {
    label: 'Under Review',
    className: '!bg-white text-purple-600 border-[1.5px] border-purple-500',
  },
  'changes-requested': {
    label: 'Changes Requested',
    className: '!bg-white text-amber-600 border-[1.5px] border-amber-500',
  },
  'approved': {
    label: 'Approved',
    className: '!bg-white text-green-600 border-[1.5px] border-green-500',
  },
};

interface StatusBadgeProps {
  status: SubmissionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}
