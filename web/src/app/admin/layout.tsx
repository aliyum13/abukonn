'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { Avatar } from '@/components/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, token, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!token || !user) {
        router.replace('/login');
      } else if (!user.is_admin) {
        router.replace('/feed');
      }
    }
  }, [loading, token, user, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    );
  }

  if (!user.is_admin) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted dark:bg-[#0a0a0a]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-30 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar />
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white dark:bg-[#111] dark:border-[#222] px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-ink-secondary hover:bg-surface-subtle lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden text-body-sm font-medium text-ink-secondary lg:block">
            Admin Panel
          </div>

          <div className="flex items-center gap-3">
            <Avatar src={user.profile_photo_url} name={user.full_name} size="sm" />
            <div className="hidden sm:block">
              <p className="text-body-sm font-semibold text-ink">{user.full_name}</p>
              <p className="text-caption text-brand-600">Administrator</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
