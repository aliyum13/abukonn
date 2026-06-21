'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const CATEGORIES = ['faculty', 'department', 'interest', 'year'] as const;
type Category = (typeof CATEGORIES)[number];
const CATEGORY_LABELS: Record<Category, string> = {
  faculty: 'Faculty', department: 'Department', interest: 'Interest', year: 'Year Group',
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
  created_at: string;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: Category | '';
}

const EMPTY_FORM: FormState = { name: '', slug: '', description: '', icon: '📌', category: '' };

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0">
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  );
}

export default function AdminChannelsPage() {
  const { token } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchChannels = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/channels/admin-list`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setChannels(data.channels ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchChannels(); }, [token]);

  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name, slug: f.slug || slugify(name) }));
  };

  const closeForm = () => { setShowForm(false); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !form.name.trim() || !form.category) { setFormError('Name and category are required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const body = { name: form.name.trim(), slug: form.slug.trim() || slugify(form.name), description: form.description.trim() || null, icon: form.icon, category: form.category };
      const res = await fetch(`${API_URL}/api/channels/admin`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast('Channel created');
      closeForm();
      fetchChannels();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!token || !confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setActionId(id);
    try {
      const res = await fetch(`${API_URL}/api/channels/admin/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      showToast(data.message || 'Deleted');
      fetchChannels();
    } finally { setActionId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-ink">Campus Channels</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">{channels.length} channel{channels.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Channel
        </Button>
      </div>

      {toast && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-body-sm text-brand-700">{toast}</div>
      )}

      {showForm && (
        <Card className="border-brand-200">
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle>New Official Channel</CardTitle>
              <button type="button" onClick={closeForm} className="rounded-lg p-1 text-ink-muted hover:text-ink">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">{formError}</div>}

              <div className="grid grid-cols-[80px_1fr] gap-3">
                <div>
                  <label className="mb-1.5 block text-label text-ink-secondary">Icon</label>
                  <input type="text" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value.slice(0, 2) })}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-center text-2xl focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a]" />
                </div>
                <Input label="Channel name" value={form.name} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Computer Science" required />
              </div>

              <Input label="Slug (URL path)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="e.g. computer-science" />

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
                  rows={2} className={cn('w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-body-sm text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none dark:bg-[#0a0a0a]')} />
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" loading={submitting}>Create Channel</Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div>{Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}</div>
          ) : channels.length === 0 ? (
            <EmptyState title="No channels yet" description="Create the first campus channel."
              action={<Button onClick={() => setShowForm(true)}>Create Channel</Button>}
              icon={<svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>} />
          ) : (
            <div className="divide-y divide-border">
              {channels.map(ch => (
                <div key={ch.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xl dark:bg-[#1a1a1a]">
                    {ch.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{ch.name}</p>
                      {ch.is_official && (
                        <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">Official</span>
                      )}
                      <span className="text-caption text-ink-muted capitalize">{CATEGORY_LABELS[ch.category]}</span>
                    </div>
                    <p className="text-caption text-ink-muted">{ch.member_count} members · /{ch.slug}</p>
                  </div>
                  <Button variant="outline" size="sm" disabled={actionId === ch.id}
                    onClick={() => handleDelete(ch.id, ch.name)}
                    className="border-red-200 text-red-600 hover:bg-red-50">
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
