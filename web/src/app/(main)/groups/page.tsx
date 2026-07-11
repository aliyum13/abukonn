'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type MyStatus = 'none' | 'pending' | 'active';

interface PublicGroup {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  require_approval: boolean;
  member_count: number;
  my_status: MyStatus;
}

export default function GroupsPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const load = useCallback((q: string) => {
    if (!token) return;
    const url = `${API_URL}/api/groups/discover${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setGroups(d.groups || []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(''); }, [load]);

  const onSearch = (v: string) => {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => load(v), 350);
  };

  const join = async (g: PublicGroup) => {
    if (!token || busyId) return;
    setBusyId(g.id);
    try {
      const res = await fetch(`${API_URL}/api/groups/${g.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Could not join'); return; }

      // Open groups -> straight into the chat. Approval groups -> mark pending.
      if (data.status === 'active') {
        router.push('/messages');
      } else {
        setGroups(prev => prev.map(x => x.id === g.id ? { ...x, my_status: 'pending' } : x));
        showToast(data.message || 'Request sent');
      }
    } catch {
      showToast('Network error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white dark:bg-[#0a0a0a]">
      <div className="sticky top-0 z-10 border-b border-border bg-white/90 backdrop-blur dark:border-[#222] dark:bg-[#0a0a0a]/90">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-ink-muted" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-bold text-ink">Groups</h1>
            <p className="text-[12px] text-ink-muted">Find and join groups across campus</p>
          </div>
          <Link href="/messages" className="shrink-0 text-[13px] font-semibold text-brand-600">My groups</Link>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-muted/50 px-3 py-2 dark:border-[#222] dark:bg-[#1a1a1a]">
            <svg className="h-4 w-4 shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={query}
              onChange={e => onSearch(e.target.value)}
              placeholder="Search groups"
              className="w-full bg-transparent text-[14px] text-ink outline-none"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {loading ? (
          <p className="py-12 text-center text-[13px] text-ink-muted">Loading groups…</p>
        ) : groups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-semibold text-[15px] text-ink">
              {query ? 'No groups found' : 'No public groups yet'}
            </p>
            <p className="mt-1 text-[14px] text-ink-muted">
              {query ? 'Try a different search.' : 'Public groups will appear here once people create them.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map(g => (
              <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-border px-3 py-3 dark:border-[#222]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 dark:bg-brand-950">
                  {g.avatar_url
                    ? <img src={g.avatar_url} alt={g.name} className="h-full w-full object-cover" />
                    : <span className="text-[16px] font-bold text-brand-700 dark:text-brand-300">{g.name.charAt(0).toUpperCase()}</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[14px] font-semibold text-ink">{g.name}</p>
                    {g.require_approval && (
                      <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-muted dark:bg-[#1a1a1a]">
                        Approval
                      </span>
                    )}
                  </div>
                  {g.description && <p className="truncate text-[12px] text-ink-muted">{g.description}</p>}
                  <p className="text-[11px] text-ink-muted">
                    {g.member_count} member{g.member_count === 1 ? '' : 's'}
                  </p>
                </div>

                {g.my_status === 'active' ? (
                  <Link href="/messages">
                    <Button variant="outline" size="sm" className="shrink-0">Open</Button>
                  </Link>
                ) : g.my_status === 'pending' ? (
                  <Button variant="outline" size="sm" disabled className="shrink-0">Requested</Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => join(g)}
                    loading={busyId === g.id}
                    className="shrink-0"
                  >
                    {g.require_approval ? 'Request' : 'Join'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className={cn(
          'fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-medium text-white shadow-lg',
          'bg-ink dark:bg-[#222]'
        )}>
          {toast}
        </div>
      )}
    </div>
  );
}
