'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton, RoleBadge } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const PAGE_LIMIT = 20;

interface AdminUser {
  id: number;
  full_name: string;
  email: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  is_admin: boolean;
  role?: string;
  post_count: string;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'verified', label: '✓ Verified' },
  { value: 'bod', label: '★ BOD' },
  { value: 'influencer', label: '⭐ Influencer' },
  { value: 'admin', label: '🛡 Admin' },
];

function RowSkeleton() {
  return (
    <tr className="border-b border-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

export default function AdminUsersPage() {
  const { token, user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [toastIsError, setToastIsError] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_LIMIT),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await fetch(`${API_URL}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const showToast = (msg: string, isError = false) => {
    setToast(msg);
    setToastIsError(isError);
    setTimeout(() => setToast(''), 3500);
  };

  const handleDelete = async (userId: number, name: string) => {
    if (!token || !confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showToast(data.message || 'User deleted');
      fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (userId: number) => {
    if (!token) return;
    setActionLoading(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/toggle-admin`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showToast(data.message);
      fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetRole = async (userId: number, newRole: string, previousRole: string) => {
    if (!token) return;
    // Optimistic update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole, is_admin: newRole === 'admin' } : u));
    setActionLoading(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Revert optimistic update
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: previousRole, is_admin: previousRole === 'admin' } : u));
        showToast(data.message || 'Failed to update role', true);
        return;
      }
      showToast(`✓ Role updated to "${newRole}"`);
    } catch {
      // Revert on network error
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: previousRole, is_admin: previousRole === 'admin' } : u));
      showToast('Network error — role not saved', true);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-ink">Users</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">
            {total} registered student{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          'rounded-xl border px-4 py-3 text-body-sm transition',
          toastIsError
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
            : 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-400'
        )}>
          {toast}
        </div>
      )}

      <Card>
        <CardHeader className="p-5 pb-0">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="max-w-xs"
            />
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-3 font-semibold text-ink">User</th>
                  <th className="hidden px-4 py-3 font-semibold text-ink md:table-cell">Department</th>
                  <th className="hidden px-4 py-3 font-semibold text-ink lg:table-cell">Posts</th>
                  <th className="hidden px-4 py-3 font-semibold text-ink sm:table-cell">Role</th>
                  <th className="px-4 py-3 font-semibold text-ink">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
                  : users.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="py-16">
                        <EmptyState
                          title="No users found"
                          description={debouncedSearch ? 'Try a different search term.' : 'No students have registered yet.'}
                          icon={
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                            </svg>
                          }
                        />
                      </td>
                    </tr>
                  )
                  : users.map((u) => (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={u.profile_photo_url} name={u.full_name} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-ink truncate">{u.full_name}</span>
                              <RoleBadge role={u.role || (u.is_admin ? 'admin' : 'user')} />
                              {me?.id === u.id && <Badge variant="outline">You</Badge>}
                            </div>
                            <p className="text-caption text-ink-muted truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-ink-secondary md:table-cell">{u.department}</td>
                      <td className="hidden px-4 py-3 text-ink-secondary lg:table-cell">{u.post_count}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <select
                          value={u.role || (u.is_admin ? 'admin' : 'user')}
                          disabled={me?.id === u.id || actionLoading === u.id}
                          onChange={e => handleSetRole(u.id, e.target.value, u.role || (u.is_admin ? 'admin' : 'user'))}
                          className="rounded-lg border border-border bg-white dark:bg-[#111] dark:border-[#333] px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                        >
                          {ROLE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={me?.id === u.id || actionLoading === u.id}
                          onClick={() => handleDelete(u.id, u.full_name)}
                          className="border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-4">
              <p className="text-caption text-ink-muted">
                Page {page} of {totalPages} · {total} users
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
