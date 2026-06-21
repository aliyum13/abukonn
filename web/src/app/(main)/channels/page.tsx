'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardContent, EmptyState, Input, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const CATEGORIES = ['faculty', 'department', 'interest', 'year'] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  faculty: 'Faculty',
  department: 'Department',
  interest: 'Interest',
  year: 'Year Group',
};

interface Channel {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  category: Category;
  member_count: number;
  is_official: boolean;
  is_member: boolean;
}

interface FormState {
  name: string;
  description: string;
  icon: string;
  category: Category | '';
}

const EMPTY_FORM: FormState = { name: '', description: '', icon: '📌', category: '' };

function ChannelCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function ChannelsPage() {
  const { token, loading: authLoading } = useAuth();
  const router = useRouter();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchChannels = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/channels`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setChannels(data.channels ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const handleJoinLeave = async (ch: Channel) => {
    if (!token) return;
    setJoiningId(ch.id);
    try {
      const method = ch.is_member ? 'DELETE' : 'POST';
      const url = ch.is_member
        ? `${API_URL}/api/channels/${ch.id}/leave`
        : `${API_URL}/api/channels/${ch.id}/join`;
      await fetch(url, { method, headers: { Authorization: `Bearer ${token}` } });
      setChannels(prev => prev.map(c =>
        c.id === ch.id
          ? { ...c, is_member: !c.is_member, member_count: c.is_member ? c.member_count - 1 : c.member_count + 1 }
          : c
      ));
    } finally {
      setJoiningId(null);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !form.name.trim() || !form.category) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch(`${API_URL}/api/channels`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast('Channel created!');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      fetchChannels();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  const myChannels = channels.filter(c => c.is_member);
  const filtered = channels.filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'all' || c.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border border-brand-200 bg-brand-50 px-5 py-3 text-sm font-medium text-brand-700 shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Campus Channels</h1>
          <p className="mt-0.5 text-[14px] text-ink-muted">Topic-based communities at ABU</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="mb-6 border-brand-200">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-ink">New Channel</h2>
              <button type="button" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setCreateError(''); }}
                className="text-ink-muted hover:text-ink">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{createError}</div>
              )}
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="mb-1.5 block text-label text-ink-secondary">Icon</label>
                  <input type="text" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value.slice(0, 2) })}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-center text-2xl focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a]" />
                </div>
                <div className="flex-1">
                  <Input label="Channel name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Computer Science" required />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Category | '' })}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a]" required>
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2} placeholder="What is this channel about?"
                  className="w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-[#0a0a0a]" />
              </div>
              <div className="flex gap-3">
                <Button type="submit" loading={creating}>Create Channel</Button>
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* My Channels */}
      {myChannels.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">My Channels</h2>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {myChannels.map(ch => (
              <Link key={ch.id} href={`/channels/${ch.slug}`}
                className="flex min-w-[140px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-brand-200 bg-brand-50/60 px-4 py-3 text-center transition hover:bg-brand-100/60 dark:border-brand-800 dark:bg-brand-950/30 dark:hover:bg-brand-950/50">
                <span className="text-2xl">{ch.icon}</span>
                <p className="text-[12px] font-semibold text-ink leading-tight">{ch.name}</p>
                <p className="text-[10px] text-ink-muted">{ch.member_count} members</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search + category filter */}
      <div className="mb-4 space-y-3">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search channels…" />
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {(['all', ...CATEGORIES] as const).map(cat => (
            <button key={cat} type="button" onClick={() => setCategoryFilter(cat)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition',
                categoryFilter === cat
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-muted text-ink-secondary hover:text-ink dark:bg-[#1a1a1a]'
              )}>
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Channels grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <ChannelCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="No channels found" description={search ? `No channels match "${search}"` : 'No channels yet.'}
            icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(ch => (
            <div key={ch.id} className="flex flex-col rounded-2xl border border-border bg-white p-4 transition hover:border-brand-200 hover:shadow-sm dark:bg-[#0a0a0a] dark:border-[#222] dark:hover:border-brand-800">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-2xl dark:bg-[#1a1a1a]">
                  {ch.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link href={`/channels/${ch.slug}`} className="font-semibold text-[14px] text-ink hover:text-brand-600 transition">
                      {ch.name}
                    </Link>
                    {ch.is_official && (
                      <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                        Official
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    'mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                    'bg-surface-muted text-ink-muted dark:bg-[#1a1a1a]'
                  )}>
                    {CATEGORY_LABELS[ch.category]}
                  </span>
                  {ch.description && (
                    <p className="mt-1.5 text-[12px] text-ink-muted leading-snug line-clamp-2">{ch.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[12px] text-ink-muted">
                  {ch.member_count.toLocaleString()} member{ch.member_count !== 1 ? 's' : ''}
                </span>
                <Button
                  size="sm"
                  variant={ch.is_member ? 'outline' : 'primary'}
                  loading={joiningId === ch.id}
                  onClick={() => handleJoinLeave(ch)}
                  className={cn('rounded-full px-4', ch.is_member && 'hover:border-red-300 hover:text-red-600')}>
                  {ch.is_member ? 'Joined' : 'Join'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
