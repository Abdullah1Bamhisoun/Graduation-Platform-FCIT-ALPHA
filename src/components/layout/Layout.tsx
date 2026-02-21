import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { StudentGroupBanner } from './StudentGroupBanner';
import { User } from '../../types';

interface LayoutProps {
  user: User;
  pageTitle: string;
  children: ReactNode;
  unreadCount?: number;
}

export function Layout({ user, pageTitle, children, unreadCount }: LayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--color-surface-alt)]">
      <Sidebar role={user.activeRole} />
      <Topbar user={user} pageTitle={pageTitle} unreadCount={unreadCount} />

      <div className="mt-16">
        {user.activeRole === 'student' && <StudentGroupBanner user={user} />}
        <main className="ml-[280px] py-8 px-5 w-[calc(100%-280px)]">
          <div className="w-full max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
