'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { timeAgo } from '@/lib/format';
import { Avatar, Button, Skeleton, RoleBadge } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ConnectRequest {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_username: string;
  sender_department: string;
  sender_level: string;
  sender_photo: string | null;
  sender_role: string;
  mutual_count: number;
  created_at: string;
}

export default function ConnectRequestsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [requests, setRequests] = useState<ConnectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<number, 'accept' | 'decline' | null>>({});

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/connect/requests/incoming`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setRequests(d.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  async function accept(req: ConnectRequest) {
    if (!token) return;
    setProcessing(p => ({ ...p, [req.id]: 'accept' }));
    try {
      const res = await fetch(`${API_URL}/api/connect/${req.id}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRequests(prev => prev.filter(r => r.id !== req.id));
    } finally {
      setProcessing(p => ({ ...p, [req.id]: null }));
    }
  }

  async function decline(req: ConnectRequest) {
    if (!token) return;
    setProcessing(p => ({ ...p, [req.id]: 'decline' }));
    try {
      const res = await fetch(`${API_URL}/api/connect/${req.id}/decline`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setRequests(prev => prev.filter(r => r.id !== req.id));
    } finally {
      setProcessing(p => ({ ...p, [req.id]: null }));
    }
  }

  return (
    <div className="mx-auto max-w-2xl min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-14 z-10 flex h-12 items-center gap-3 border-b border-border bg-white/95 dark:bg-[#0a0a0a]/95 dark:border-[#222] px-4 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-muted hover:text-ink"
          aria-label="Go back"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="font-semibold text-[15px] text-ink">Connection Requests</h1>
        </div>
        {!loading && requests.length > 0 && (
          <span className="ml-auto rounded-full bg-brand-600 px-2.5 py-0.5 text-[12px] font-semibold text-white">
            {requests.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="divide-y divide-border dark:divide-[#222]">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4">
              <Skeleton className="h-14 w-14 shrink-0" rounded="full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20 rounded-full" />
                <Skeleton className="h-9 w-20 rounded-full" />
              </div>
            </div>
          ))
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1a1a1a]">
              <svg className="h-8 w-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="font-semibold text-[16px] text-ink">No pending requests</p>
            <p className="mt-1.5 text-[14px] text-ink-muted max-w-xs">
              When someone sends you a connect request, it will appear here.
            </p>
            <Link href="/search" className="mt-5">
              <Button variant="primary" size="sm" className="rounded-full px-6">
                Find People
              </Button>
            </Link>
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} className="flex items-start gap-3 px-4 py-4 transition hover:bg-gray-50/40 dark:hover:bg-white/[0.02]">
              {/* Avatar */}
              <Link href={`/profile/${req.sender_id}`} className="shrink-0">
                <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-brand-500 to-emerald-400 p-[2px]">
                  <div className="h-full w-full rounded-full bg-white dark:bg-[#0a0a0a] p-[1.5px]">
                    <Avatar src={req.sender_photo} name={req.sender_name} size="lg" className="h-full w-full" />
                  </div>
                </div>
              </Link>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/profile/${req.sender_id}`} className="font-semibold text-[15px] text-ink hover:underline">
                    {req.sender_name}
                  </Link>
                  <RoleBadge role={req.sender_role} />
                </div>
                <p className="text-[13px] text-ink-muted">@{req.sender_username}</p>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {req.sender_department} · {req.sender_level}
                </p>
                {req.mutual_count > 0 && (
                  <p className="mt-0.5 text-[12px] text-brand-600 dark:text-brand-400">
                    {req.mutual_count} mutual connection{req.mutual_count > 1 ? 's' : ''}
                  </p>
                )}
                <p className="mt-0.5 text-[12px] text-ink-muted">{timeAgo(req.created_at)}</p>

                {/* Action buttons */}
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => accept(req)}
                    loading={processing[req.id] === 'accept'}
                    disabled={!!processing[req.id]}
                    className="rounded-full px-5 bg-brand-600 hover:bg-brand-700 text-white"
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => decline(req)}
                    loading={processing[req.id] === 'decline'}
                    disabled={!!processing[req.id]}
                    className="rounded-full px-5"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
