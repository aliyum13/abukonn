'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/format';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalNews: number;
  activeToday: number;
}

interface RecentUser {
  id: number;
  matric_number: string;
  full_name: string;
  email: string;
  department: string;
  level: string;
  is_admin: boolean;
  created_at: string;
}

const STAT_CARDS = [
  {
    key: 'totalUsers' as const,
    label: 'Total Users',
    color: 'bg-brand-50 text-brand-700',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    key: 'totalPosts' as const,
    label: 'Total Posts',
    color: 'bg-blue-50 text-blue-700',
    icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
  },
  {
    key: 'totalNews' as const,
    label: 'News Articles',
    color: 'bg-purple-50 text-purple-700',
    icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  },
  {
    key: 'activeToday' as const,
    label: 'Active Today',
    color: 'bg-amber-50 text-amber-700',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
];

function StatSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [repairing, setRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState('');

  // Scoped roles don't see the full-admin dashboard — send them to their section.
  useEffect(() => {
    if (user?.role === 'class_coordinator') router.replace('/admin/academic-calendar');
    else if (user?.role === 'editor') router.replace('/admin/news');
  }, [user, router]);

  useEffect(() => {
    if (!token) return;
    // Only full admins load the dashboard stats. Scoped roles are being
    // redirected away anyway (above), so skip the fetch for them.
    if (user && (user.role === 'class_coordinator' || user.role === 'editor')) return;

    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/api/admin/stats`, { headers })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setError('Failed to load stats'))
      .finally(() => setStatsLoading(false));

    fetch(`${API_URL}/api/admin/users/recent`, { headers })
      .then((r) => r.json())
      .then((d) => setRecentUsers(d.users || []))
      .catch(() => {})
      .finally(() => setUsersLoading(false));
  }, [token, user]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display-sm text-ink">Dashboard</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">
          Welcome back — here&apos;s what&apos;s happening on ABUkonn.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">
          {error}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : STAT_CARDS.map(({ key, label, color, icon }) => (
              <Card key={key}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-ink">{stats?.[key] ?? '—'}</p>
                      <p className="text-body-sm text-ink-secondary">{label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/class-reps">
          <Card className="cursor-pointer transition hover:border-brand-200 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <span className="text-lg">🎓</span>
              </div>
              <div>
                <p className="font-semibold text-ink">Class Reps</p>
                <p className="text-caption text-ink-muted">Assign timetable managers</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/users">
          <Card className="cursor-pointer transition hover:border-brand-200 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-ink">Manage Users</p>
                <p className="text-caption text-ink-muted">View, delete, promote</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/news">
          <Card className="cursor-pointer transition hover:border-brand-200 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-ink">Create News</p>
                <p className="text-caption text-ink-muted">Publish announcements</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/whitelist">
          <Card className="cursor-pointer transition hover:border-brand-200 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-ink">Upload Whitelist</p>
                <p className="text-caption text-ink-muted">CSV matric numbers</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent registrations */}
      <Card>
        <CardHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Recent Registrations</CardTitle>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {usersLoading ? (
            <div className="space-y-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="h-9 w-9 shrink-0" rounded="full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="px-6 py-8 text-center text-body-sm text-ink-muted">No users yet</p>
          ) : (
            <div className="divide-y divide-border">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-6 py-4">
                  <Avatar name={u.full_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-body-sm font-medium text-ink">{u.full_name}</p>
                      {u.is_admin && <Badge variant="brand" className="shrink-0">Admin</Badge>}
                    </div>
                    <p className="truncate text-caption text-ink-muted">
                      {u.matric_number} · {u.department}
                    </p>
                  </div>
                  <span className="shrink-0 text-caption text-ink-muted">{formatDate(u.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader className="p-6 pb-4">
          <CardTitle>Maintenance</CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
            <div>
              <p className="font-semibold text-ink">Repair document links</p>
              <p className="mt-1 text-caption text-ink-muted">
                Fixes documents (Library materials and chat file attachments) uploaded before
                the file-extension fix — they show a raw download prompt instead of previewing.
                Safe to run repeatedly.
              </p>
              {repairResult && (
                <p className="mt-2 whitespace-pre-line text-caption text-brand-700">{repairResult}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              loading={repairing}
              onClick={async () => {
                setRepairing(true);
                setRepairResult(null);
                try {
                  const res = await fetch(`${API_URL}/api/admin/repair-file-extensions`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  const data = await res.json() as {
                    results?: {
                      library_materials: { checked: number; fixed: number; errors: unknown[] };
                      messages: { checked: number; fixed: number; errors: unknown[] };
                      group_messages: { checked: number; fixed: number; errors: unknown[] };
                    };
                    message?: string;
                  };
                  if (res.ok && data.results) {
                    const { library_materials, messages, group_messages } = data.results;
                    const totalFixed = library_materials.fixed + messages.fixed + group_messages.fixed;
                    const totalErrors = library_materials.errors.length + messages.errors.length + group_messages.errors.length;
                    setRepairResult(
                      `Done — ${totalFixed} file(s) fixed${totalErrors > 0 ? `, ${totalErrors} error(s)` : ''}.\n` +
                      `Library: ${library_materials.fixed}/${library_materials.checked} · ` +
                      `DMs: ${messages.fixed}/${messages.checked} · ` +
                      `Groups: ${group_messages.fixed}/${group_messages.checked}`
                    );
                  } else {
                    setRepairResult(`Failed: ${data.message || 'Unknown error'}`);
                  }
                } catch {
                  setRepairResult('Failed: network error');
                } finally {
                  setRepairing(false);
                }
              }}
            >
              Run repair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
