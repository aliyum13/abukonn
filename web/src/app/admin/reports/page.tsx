'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Report {
  id: number;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reporter_name: string;
  reporter_username: string;
  reported_user_name: string | null;
  reported_user_username: string | null;
  reported_user_id: number | null;
  reported_post_content: string | null;
  reported_post_id: number | null;
  reviewed_by_name: string | null;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  hate_speech: 'Hate speech',
  misinformation: 'False information',
  inappropriate_content: 'Inappropriate content',
  impersonation: 'Impersonation',
  other: 'Other',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  dismissed: 'bg-surface-muted text-ink-muted',
};

export default function AdminReportsPage() {
  const { token } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/moderation/admin/reports?status=${status}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { reports: Report[] };
        setReports(data.reports);
      }
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: number, action: 'resolved' | 'dismissed') => {
    if (!token) return;
    setResolving(id);
    try {
      const res = await fetch(`${API_URL}/api/moderation/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id));
        showToast(action === 'resolved' ? 'Report marked as resolved.' : 'Report dismissed.');
      }
    } finally {
      setResolving(null);
    }
  };

  const tabs: { value: typeof status; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <CardHeader className="px-0 pb-4">
        <CardTitle>Reports</CardTitle>
        <p className="text-body-sm text-ink-muted mt-1">Review reports submitted by students.</p>
      </CardHeader>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-surface-muted p-1 mb-6 w-fit dark:bg-[#1a1a1a]">
        {tabs.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setStatus(t.value)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-body-sm font-medium transition',
              status === t.value
                ? 'bg-white shadow text-ink dark:bg-[#2a2a2a]'
                : 'text-ink-muted hover:text-ink'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState title={`No ${status === 'all' ? '' : status} reports`} description="Nothing here right now." />
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    {/* Reason + status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink">{REASON_LABELS[r.reason] || r.reason}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_BADGE[r.status] || STATUS_BADGE.dismissed)}>
                        {r.status}
                      </span>
                      {r.reported_post_id ? (
                        <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 text-[11px] font-medium">Post</span>
                      ) : (
                        <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 text-[11px] font-medium">User</span>
                      )}
                    </div>

                    {/* Target */}
                    <p className="mt-1 text-body-sm text-ink-muted">
                      <span className="font-medium text-ink">Reported: </span>
                      {r.reported_post_id
                        ? <span className="line-clamp-1">{r.reported_post_content || '(post deleted)'}</span>
                        : <span>{r.reported_user_name} (@{r.reported_user_username})</span>
                      }
                    </p>

                    {/* Reporter */}
                    <p className="text-caption text-ink-muted">
                      By {r.reporter_name} (@{r.reporter_username}) · {timeAgo(r.created_at)}
                    </p>

                    {/* Details */}
                    {r.details && (
                      <p className="mt-1.5 rounded-lg bg-surface-muted px-3 py-2 text-body-sm text-ink dark:bg-[#1a1a1a]">
                        {r.details}
                      </p>
                    )}

                    {/* Reviewed by */}
                    {r.reviewed_by_name && (
                      <p className="mt-1 text-caption text-ink-muted">
                        Reviewed by {r.reviewed_by_name} · {r.reviewed_at ? timeAgo(r.reviewed_at) : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {r.status === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={resolving === r.id}
                        onClick={() => resolve(r.id, 'dismissed')}
                        className="text-ink-secondary"
                      >
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        loading={resolving === r.id}
                        onClick={() => resolve(r.id, 'resolved')}
                      >
                        Resolve
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-caption font-medium text-white shadow-lg z-50 dark:bg-[#222]">
          {toast}
        </div>
      )}
    </div>
  );
}
