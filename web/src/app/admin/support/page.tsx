'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Ticket {
  id: number; email: string; full_name: string | null; category: string;
  subject: string; message: string; status: string; admin_notes: string | null;
  created_at: string; updated_at: string; user_name: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  in_progress: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  resolved: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
};

export default function AdminSupportPage() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('all');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/support/admin`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setTickets(data.tickets || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) fetchTickets(); }, [token]);

  const handleSelect = (t: Ticket) => { setSelected(t); setNotes(t.admin_notes || ''); setStatus(t.status); };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/support/admin/${selected.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes }),
      });
      if (!res.ok) throw new Error('Failed');
      showToast('Ticket updated');
      setSelected(null);
      fetchTickets();
    } catch { showToast('Failed to update'); }
    finally { setSaving(false); }
  };

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
  const counts = { all: tickets.length, open: tickets.filter(t => t.status === 'open').length, in_progress: tickets.filter(t => t.status === 'in_progress').length, resolved: tickets.filter(t => t.status === 'resolved').length };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm text-ink">Support Tickets</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">Manage user support requests and feedback</p>
      </div>

      {toast && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-body-sm text-brand-700">{toast}</div>}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all','open','in_progress','resolved'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('rounded-full px-4 py-1.5 text-[13px] font-semibold transition',
              filter === f ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-muted hover:text-ink')}>
            {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ticket list */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 text-center text-body-sm text-ink-muted">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-body-sm text-ink-muted">No tickets found.</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(t => (
                  <button key={t.id} onClick={() => handleSelect(t)}
                    className={cn('w-full text-left px-5 py-4 transition hover:bg-surface-muted',
                      selected?.id === t.id && 'bg-brand-50 dark:bg-brand-950/20')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink truncate">{t.subject}</p>
                        <p className="text-caption text-ink-muted mt-0.5">{t.full_name || t.email} · {t.category}</p>
                        <p className="text-caption text-ink-muted mt-0.5 truncate">{t.message}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_COLORS[t.status])}>
                          {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                        </span>
                        <span className="text-[11px] text-ink-muted">{new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ticket detail */}
        {selected ? (
          <Card>
            <CardHeader className="p-6 pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Ticket #{selected.id}</CardTitle>
                  <p className="mt-0.5 text-body-sm text-ink-muted">{selected.category}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-ink-muted hover:text-ink">✕</button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="rounded-xl bg-surface-muted p-4 space-y-2">
                <p className="text-label font-semibold text-ink-secondary">From</p>
                <p className="text-body-sm text-ink">{selected.full_name || 'Unknown'}</p>
                <p className="text-caption text-ink-muted">{selected.email}</p>
              </div>
              <div>
                <p className="mb-1 text-label font-semibold text-ink-secondary">Subject</p>
                <p className="text-body-sm font-semibold text-ink">{selected.subject}</p>
              </div>
              <div>
                <p className="mb-1 text-label font-semibold text-ink-secondary">Message</p>
                <p className="text-body-sm text-ink whitespace-pre-wrap leading-relaxed">{selected.message}</p>
              </div>
              <div>
                <label className="mb-1.5 block text-label font-semibold text-ink-secondary">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-label font-semibold text-ink-secondary">Admin Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Add internal notes about this ticket..."
                  rows={3} className="w-full rounded-xl border border-border bg-white px-4 py-2.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333] resize-none" />
              </div>
              <p className="text-caption text-ink-muted">Submitted {new Date(selected.created_at).toLocaleString('en-GB')}</p>
              <Button onClick={handleSave} loading={saving} className="w-full">Update Ticket</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex h-64 items-center justify-center">
              <p className="text-body-sm text-ink-muted">Select a ticket to view details</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
