'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton, EmptyState } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface CalendarEntry {
  id: number;
  session: string;
  semester: 'first' | 'second';
  activity: string;
  from_date: string | null;
  to_date: string | null;
  period: string | null;
}

const EMPTY_FORM = { semester: 'first' as 'first' | 'second', activity: '', from_date: '', to_date: '', period: '' };

// Pre-filled with the official ABU 2025/2026 calendar so the admin has a
// ready reference — they can edit dates for future sessions and re-upload.
const CSV_TEMPLATE = `semester,activity,from_date,to_date,period
first,Registration,2026-01-05,2026-01-17,2 weeks
first,Lectures,2026-01-12,2026-03-21,10 weeks
first,Mid-Semester Break,2026-03-23,2026-03-28,1 week
first,Lectures,2026-03-30,2026-04-25,4 weeks
first,Final Examination,2026-04-27,2026-05-16,3 weeks
first,End of Semester Break,2026-05-18,2026-05-30,2 weeks
first,Add and Drop,2026-02-02,2026-02-14,2 weeks
second,Lectures,2026-06-01,2026-07-25,8 weeks
second,Mid-Semester Break,2026-07-27,2026-08-01,1 week
second,Lectures,2026-08-03,2026-09-12,6 weeks
second,Final Examination,2026-09-14,2026-10-03,3 weeks
second,Add and Drop,2026-06-22,2026-07-04,2 weeks
`;

function toInputDate(d: string | null): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

export default function AdminAcademicCalendarPage() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<string[]>([]);
  const [session, setSession] = useState('');
  const [newSession, setNewSession] = useState('');
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ valid: unknown[]; total: number; errors: string[] } | null>(null);
  const [csvReplace, setCsvReplace] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const loadSessions = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/academic-calendar/sessions`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const d = await res.json() as { sessions: string[] };
      setSessions(d.sessions);
      if (d.sessions.length > 0 && !session) setSession(d.sessions[0]);
    }
  }, [token, session]);

  const loadEntries = useCallback(async (sess: string) => {
    if (!token || !sess) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/academic-calendar?session=${encodeURIComponent(sess)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json() as { entries: CalendarEntry[] };
        setEntries(d.entries);
      }
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { if (session) loadEntries(session); else setLoading(false); }, [session, loadEntries]);

  const activeSession = newSession.trim() || session;

  const handleSubmit = async () => {
    if (!token || !activeSession || !form.activity.trim()) {
      showToast('Session and activity are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        session: activeSession,
        semester: form.semester,
        activity: form.activity.trim(),
        from_date: form.from_date || null,
        to_date: form.to_date || null,
        period: form.period.trim() || null,
      };
      const url = editingId
        ? `${API_URL}/api/academic-calendar/admin/entry/${editingId}`
        : `${API_URL}/api/academic-calendar/admin/entry`;
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setForm(EMPTY_FORM);
        setEditingId(null);
        if (newSession.trim()) { setSession(newSession.trim()); setNewSession(''); await loadSessions(); }
        await loadEntries(activeSession);
        showToast(editingId ? 'Entry updated.' : 'Entry added.');
      } else {
        const d = await res.json().catch(() => ({})) as { message?: string };
        showToast(d.message || 'Failed to save.');
      }
    } finally { setSaving(false); }
  };

  const startEdit = (e: CalendarEntry) => {
    setEditingId(e.id);
    setForm({
      semester: e.semester,
      activity: e.activity,
      from_date: toInputDate(e.from_date),
      to_date: toInputDate(e.to_date),
      period: e.period || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    const res = await fetch(`${API_URL}/api/academic-calendar/admin/entry/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { setEntries(prev => prev.filter(e => e.id !== id)); showToast('Entry deleted.'); }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'academic_calendar_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setCsvFile(file);
    setCsvPreview(null);
    const fd = new FormData();
    fd.append('csv', file);
    try {
      const res = await fetch(`${API_URL}/api/academic-calendar/admin/preview`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (res.ok) {
        setCsvPreview(await res.json());
      } else {
        showToast('Could not read that CSV.');
        setCsvFile(null);
      }
    } catch {
      showToast('Could not read that CSV.');
      setCsvFile(null);
    }
    e.target.value = '';
  };

  const handleCsvUpload = async () => {
    if (!token || !csvFile) return;
    const targetSession = newSession.trim() || session;
    if (!targetSession) { showToast('Pick or create a session first.'); return; }
    setCsvUploading(true);
    try {
      const fd = new FormData();
      fd.append('csv', csvFile);
      fd.append('session', targetSession);
      fd.append('replace', String(csvReplace));
      const res = await fetch(`${API_URL}/api/academic-calendar/admin/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await res.json() as { message?: string };
      if (res.ok) {
        setCsvFile(null);
        setCsvPreview(null);
        setCsvReplace(false);
        if (newSession.trim()) { setSession(newSession.trim()); setNewSession(''); await loadSessions(); }
        await loadEntries(targetSession);
        showToast(data.message || 'Calendar uploaded.');
      } else {
        showToast(data.message || 'Upload failed.');
      }
    } finally {
      setCsvUploading(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-border bg-white px-3 py-2 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]';

  const firstSem = entries.filter(e => e.semester === 'first');
  const secondSem = entries.filter(e => e.semester === 'second');

  return (
    <div className="mx-auto max-w-3xl p-6">
      <CardHeader className="px-0 pb-4">
        <CardTitle>Academic Calendar</CardTitle>
        <p className="mt-1 text-body-sm text-ink-muted">Add semester dates, exams, breaks and deadlines. Students see this in the Library.</p>
      </CardHeader>

      {/* Session selector */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        {sessions.length > 0 && (
          <div>
            <label className="mb-1 block text-caption text-ink-muted">Session</label>
            <select value={session} onChange={e => { setSession(e.target.value); setEditingId(null); setForm(EMPTY_FORM); }} className={inputCls}>
              {sessions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-caption text-ink-muted">Or create new session</label>
          <input value={newSession} onChange={e => setNewSession(e.target.value)} placeholder="e.g. 2025/2026" className={inputCls} />
        </div>
      </div>

      {/* Add / edit form */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <p className="mb-3 font-semibold text-ink">{editingId ? 'Edit entry' : 'Add entry'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-caption text-ink-muted">Activity *</label>
              <input value={form.activity} onChange={e => setForm(f => ({ ...f, activity: e.target.value }))} placeholder="e.g. Registration, Lectures, Final Examination" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-caption text-ink-muted">Semester *</label>
              <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value as 'first' | 'second' }))} className={inputCls}>
                <option value="first">First Semester</option>
                <option value="second">Second Semester</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-caption text-ink-muted">Period</label>
              <input value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} placeholder="e.g. 2 weeks" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-caption text-ink-muted">From date</label>
              <input type="date" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-caption text-ink-muted">To date</label>
              <input type="date" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleSubmit} loading={saving} disabled={!form.activity.trim() || (!activeSession)}>
              {editingId ? 'Save changes' : 'Add entry'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>Cancel</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bulk upload via CSV */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">Bulk upload (CSV)</p>
              <p className="mt-1 text-caption text-ink-muted">
                Add a whole session at once. Download the template — it&apos;s pre-filled with the
                current ABU calendar as a starting point — edit it, then upload.
              </p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={downloadTemplate}>
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Template
            </Button>
          </div>

          <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={handleCsvSelect} className="hidden" />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}>
              {csvFile ? 'Choose a different file' : 'Choose CSV file'}
            </Button>
            {csvFile && <span className="text-caption text-ink-muted">{csvFile.name}</span>}
          </div>

          {csvPreview && (
            <div className="mt-3 rounded-xl border border-border p-3 dark:border-[#222]">
              <p className="text-body-sm text-ink">
                <span className="font-semibold text-brand-700 dark:text-brand-400">{csvPreview.total}</span> valid row{csvPreview.total === 1 ? '' : 's'} ready to import
                {(newSession.trim() || session) ? <> into <span className="font-medium">{newSession.trim() || session}</span></> : ''}.
              </p>
              {csvPreview.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-caption text-red-600">
                  {csvPreview.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {csvPreview.errors.length > 5 && <li>…and {csvPreview.errors.length - 5} more</li>}
                </ul>
              )}
              <label className="mt-3 flex items-center gap-2 text-caption text-ink-secondary">
                <input type="checkbox" checked={csvReplace} onChange={e => setCsvReplace(e.target.checked)} className="rounded border-border" />
                Replace all existing entries for this session first
              </label>
              <div className="mt-3">
                <Button size="sm" loading={csvUploading} disabled={csvPreview.total === 0} onClick={handleCsvUpload}>
                  Import {csvPreview.total} row{csvPreview.total === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry list */}
      {loading ? (
        <div className="space-y-3"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>
      ) : entries.length === 0 ? (
        <EmptyState title="No entries yet" description="Add the first calendar entry above." />
      ) : (
        <>
          {([['First Semester', firstSem], ['Second Semester', secondSem]] as const).map(([label, list]) =>
            list.length > 0 ? (
              <div key={label} className="mb-6">
                <h3 className="mb-2 text-[14px] font-semibold text-ink">{label}</h3>
                <div className="space-y-2">
                  {list.map(e => (
                    <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 dark:border-[#222]">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{e.activity}</p>
                        <p className="text-caption text-ink-muted">
                          {e.from_date ? new Date(e.from_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                          {e.to_date ? ` → ${new Date(e.to_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                          {e.period ? ` · ${e.period}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" onClick={() => startEdit(e)} className="rounded-lg px-2.5 py-1 text-caption font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950">Edit</button>
                        <button type="button" onClick={() => handleDelete(e.id)} className="rounded-lg px-2.5 py-1 text-caption font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-caption font-medium text-white shadow-lg dark:bg-[#222]">
          {toast}
        </div>
      )}
    </div>
  );
}
