'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const COLORS = ['blue', 'red', 'orange', 'green', 'purple', 'pink', 'yellow', 'teal', 'gray'] as const;
type HighlightColor = (typeof COLORS)[number];

const COLOR_SWATCH: Record<HighlightColor, string> = {
  blue: 'bg-blue-500', red: 'bg-red-500', orange: 'bg-orange-500',
  green: 'bg-green-500', purple: 'bg-purple-500', pink: 'bg-pink-500',
  yellow: 'bg-yellow-500', teal: 'bg-teal-500', gray: 'bg-gray-500',
};

const COLOR_BADGE: Record<HighlightColor, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const SUGGESTED_ICONS = ['📢', '📝', '⏰', '🎉', '📌', '🏆', '🔔', '📅', '⚠️', '💡', '🎓', '🩺'];

interface Highlight {
  id: number;
  title: string;
  description: string | null;
  type: string;
  icon: string;
  color: HighlightColor;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  is_active: boolean;
  creator_name: string | null;
  created_at: string;
}

interface FormState {
  title: string;
  description: string;
  type: string;
  icon: string;
  color: HighlightColor;
  start_date: string;
  end_date: string;
  priority: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  type: '',
  icon: '📌',
  color: 'blue',
  start_date: '',
  end_date: '',
  priority: '0',
};

function toInputDate(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-8 w-16 rounded-lg" />
      <Skeleton className="h-8 w-16 rounded-lg" />
    </div>
  );
}

export default function AdminHighlightsPage() {
  const { token } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const fetchHighlights = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/highlights/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHighlights(data.highlights || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHighlights(); }, [token]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (h: Highlight) => {
    setEditingId(h.id);
    setForm({
      title: h.title,
      description: h.description || '',
      type: h.type,
      icon: h.icon || '📌',
      color: h.color || 'blue',
      start_date: toInputDate(h.start_date),
      end_date: toInputDate(h.end_date),
      priority: String(h.priority),
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    if (!form.type.trim()) { setFormError('Category is required'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      const body = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type.trim(),
        icon: form.icon.trim() || '📌',
        color: form.color,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        priority: parseInt(form.priority) || 0,
      };
      const url = editingId ? `${API_URL}/api/highlights/${editingId}` : `${API_URL}/api/highlights`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      showToast(editingId ? 'Highlight updated' : 'Highlight created');
      closeForm();
      fetchHighlights();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (h: Highlight) => {
    if (!token) return;
    setActionId(h.id);
    try {
      const res = await fetch(`${API_URL}/api/highlights/${h.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !h.is_active }),
      });
      if (res.ok) {
        showToast(h.is_active ? 'Highlight hidden' : 'Highlight shown');
        fetchHighlights();
      }
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: number, title: string) => {
    if (!token || !confirm(`Delete "${title}"?`)) return;
    setActionId(id);
    try {
      const res = await fetch(`${API_URL}/api/highlights/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      showToast(data.message || 'Deleted');
      fetchHighlights();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-ink">Today&apos;s Highlights</h1>
          <p className="mt-1 text-body-sm text-ink-secondary">
            {highlights.filter(h => h.is_active).length} active highlight{highlights.filter(h => h.is_active).length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Highlight
        </Button>
      </div>

      {toast && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-body-sm text-brand-700">
          {toast}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card className="border-brand-200">
          <CardHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <CardTitle>{editingId ? 'Edit Highlight' : 'New Highlight'}</CardTitle>
              <button type="button" onClick={closeForm} className="rounded-lg p-1 text-ink-muted hover:text-ink">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body-sm text-red-600">
                  {formError}
                </div>
              )}

              <Input
                label="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Final exams begin next week"
                required
              />

              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Description (optional)</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Additional details..."
                  rows={3}
                  className={cn(
                    'w-full resize-none rounded-xl border border-border bg-white px-4 py-3 dark:bg-[#0a0a0a]',
                    'text-body-sm text-ink placeholder:text-ink-muted',
                    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                  )}
                />
              </div>

              <Input
                label="Category"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="e.g. announcement, exam, sports, scholarship..."
                required
              />
              <p className="-mt-2.5 text-caption text-ink-muted">
                Any label works — categories aren&apos;t limited to a fixed list.
              </p>

              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Icon</label>
                <div className="flex items-center gap-2">
                  <input
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    maxLength={4}
                    className={cn(
                      'w-16 rounded-xl border border-border bg-white px-3 py-2.5 text-center text-xl dark:bg-[#0a0a0a]',
                      'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                    )}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setForm({ ...form, icon: ic })}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg border text-base transition',
                          form.icon === ic ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30' : 'border-border hover:border-brand-300'
                        )}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-label text-ink-secondary">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      title={c}
                      className={cn(
                        'h-8 w-8 rounded-full transition ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]',
                        COLOR_SWATCH[c],
                        form.color === c ? 'ring-2 ring-ink' : ''
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-label text-ink-secondary">Start date (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className={cn(
                      'w-full rounded-xl border border-border bg-white px-4 py-3 dark:bg-[#0a0a0a]',
                      'text-body-sm text-ink',
                      'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                    )}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-label text-ink-secondary">End date (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className={cn(
                      'w-full rounded-xl border border-border bg-white px-4 py-3 dark:bg-[#0a0a0a]',
                      'text-body-sm text-ink',
                      'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20'
                    )}
                  />
                </div>
              </div>

              <Input
                label="Priority (higher = shown first)"
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                placeholder="0"
              />

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={submitting}>
                  {editingId ? 'Save Changes' : 'Create Highlight'}
                </Button>
                <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div>
              {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
            </div>
          ) : highlights.length === 0 ? (
            <EmptyState
              title="No highlights yet"
              description="Add a highlight to show students important announcements, exams, or events."
              action={<Button onClick={openCreate}>Add Highlight</Button>}
              icon={
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {highlights.map((h) => (
                <div key={h.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize',
                          COLOR_BADGE[h.color] || COLOR_BADGE.blue
                        )}
                      >
                        {h.icon} {h.type}
                      </span>
                      {!h.is_active && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          Hidden
                        </span>
                      )}
                      <span className="text-caption text-ink-muted">Priority {h.priority}</span>
                    </div>
                    <p className="mt-1 font-semibold text-ink">{h.title}</p>
                    {h.description && (
                      <p className="mt-0.5 line-clamp-1 text-caption text-ink-muted">{h.description}</p>
                    )}
                    {h.start_date && (
                      <p className="mt-0.5 text-caption text-ink-muted">
                        {new Date(h.start_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        {h.end_date && ` → ${new Date(h.end_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionId === h.id}
                      onClick={() => handleToggleActive(h)}
                    >
                      {h.is_active ? 'Hide' : 'Show'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionId === h.id}
                      onClick={() => openEdit(h)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionId === h.id}
                      onClick={() => handleDelete(h.id, h.title)}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
