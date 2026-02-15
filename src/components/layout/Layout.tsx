import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
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
      <Sidebar role={user.role} />
      <Topbar user={user} pageTitle={pageTitle} unreadCount={unreadCount} />

      <main className="ml-[280px] mt-16 p-8">
        <div className="max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
