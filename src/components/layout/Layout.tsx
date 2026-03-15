import { ReactNode, useState } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-surface-alt)]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar user={user} pageTitle={pageTitle} unreadCount={unreadCount} onMenuClick={() => setSidebarOpen(true)} />

      <div className="mt-16">
        <main className="lg:ml-[280px] py-6 px-4 sm:px-5 w-full lg:w-[calc(100%-280px)]">
          <div className="w-full max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
