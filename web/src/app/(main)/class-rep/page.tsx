'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface RepClass { id: number; department: string; level: string }
interface OfficialClass {
  id: number; day: string; start_time: string; end_time: string;
  course_code: string | null; course_title: string; venue: string | null; lecturer: string | null;
}
interface Override {
  id: number; override_date: string; kind: 'add' | 'edit' | 'cancel';
  original_class_id: number | null; start_time: string | null; end_time: string | null;
  course_code: string | null; course_title: string | null; venue: string | null;
  lecturer: string | null; note: string | null;
}

type Mode = 'add' | 'edit' | 'cancel';

export default function ClassRepPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [repClasses, setRepClasses] = useState<RepClass[]>([]);
  const [active, setActive] = useState<RepClass | null>(null);
  const [official, setOfficial] = useState<OfficialClass[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Form state
  const [mode, setMode] = useState<Mode>('add');
  const [date, setDate] = useState('');
  const [targetClassId, setTargetClassId] = useState<number | null>(null);
  const [form, setForm] = useState({ course_code: '', course_title: '', start_time: '', end_time: '', venue: '', lecturer: '', note: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Load which classes the user reps
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/class-reps/my-classes`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setRepClasses(d.classes || []);
        if ((d.classes || []).length > 0) setActive(d.classes[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Load official timetable + existing overrides for the active class
  const loadClassData = useCallback((cls: RepClass) => {
    if (!token) return;
    // Official weekly timetable for this dept+level
    fetch(`${API_URL}/api/timetable/${encodeURIComponent(cls.department)}/${encodeURIComponent(cls.level)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setOfficial(d.classes || d.timetable || []))
      .catch(() => setOfficial([]));
    // Existing upcoming overrides
    fetch(`${API_URL}/api/class-reps/overrides?department=${encodeURIComponent(cls.department)}&level=${encodeURIComponent(cls.level)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setOverrides(d.overrides || []))
      .catch(() => setOverrides([]));
  }, [token]);

  useEffect(() => {
    if (active) loadClassData(active);
  }, [active, loadClassData]);

  const resetForm = () => {
    setForm({ course_code: '', course_title: '', start_time: '', end_time: '', venue: '', lecturer: '', note: '' });
    setTargetClassId(null);
  };

  // When picking an official class to edit/cancel, prefill the form
  const pickTarget = (cls: OfficialClass) => {
    setTargetClassId(cls.id);
    if (mode === 'edit') {
      setForm({
        course_code: cls.course_code || '', course_title: cls.course_title,
        start_time: cls.start_time, end_time: cls.end_time,
        venue: cls.venue || '', lecturer: cls.lecturer || '', note: '',
      });
    }
  };

  const submit = async () => {
    if (!token || !active) return;
    setFormError('');
    if (!date) { setFormError('Pick a date'); return; }
    if ((mode === 'add' || mode === 'edit') && (!form.course_title.trim() || !form.start_time)) {
      setFormError('Course title and start time are required'); return;
    }
    if ((mode === 'edit' || mode === 'cancel') && !targetClassId) {
      setFormError('Select which class to change'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/class-reps/overrides`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: active.department, level: active.level,
          override_date: date, kind: mode,
          original_class_id: targetClassId,
          course_code: form.course_code || null, course_title: form.course_title || null,
          start_time: form.start_time || null, end_time: form.end_time || null,
          venue: form.venue || null, lecturer: form.lecturer || null, note: form.note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message || 'Failed to save'); return; }
      showToast(mode === 'add' ? 'Extra class added' : mode === 'edit' ? 'Class updated for that day' : 'Class cancelled for that day');
      resetForm();
      loadClassData(active);
    } catch {
      setFormError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteOverride = async (id: number) => {
    if (!token || !active) return;
    setOverrides(prev => prev.filter(o => o.id !== id));
    try {
      await fetch(`${API_URL}/api/class-reps/overrides/${id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
    } catch { loadClassData(active); }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  if (loading) {
    return <div className="mx-auto max-w-2xl px-4 py-12 text-center text-ink-muted">Loading…</div>;
  }

  // Not a class rep
  if (repClasses.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-[17px] font-bold text-ink">You&apos;re not a class representative</p>
        <p className="mt-2 text-[14px] text-ink-muted">
          Class reps are assigned by admins to manage day-to-day timetable changes for their class.
          If you volunteer to help, ask an admin to assign you.
        </p>
        <Link href="/feed" className="mt-4 inline-block text-[14px] font-semibold text-brand-600">← Back to feed</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-white dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-white/90 px-4 py-3 backdrop-blur dark:border-[#222] dark:bg-[#0a0a0a]/90">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-ink-muted" aria-label="Back">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-ink">Class Rep — Timetable</h1>
            <p className="text-[12px] text-ink-muted">Temporary changes for a specific day. Reverts automatically after.</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Class selector (if repping more than one) */}
        {repClasses.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {repClasses.map(c => (
              <button key={c.id} onClick={() => setActive(c)}
                className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition',
                  active?.id === c.id ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950' : 'border-border text-ink-muted')}>
                {c.department} · {c.level}
              </button>
            ))}
          </div>
        )}

        {active && (
          <div className="mb-4 rounded-xl bg-brand-50 px-4 py-2.5 dark:bg-brand-950/40">
            <p className="text-[13px] font-semibold text-brand-700 dark:text-brand-300">
              Managing: {active.department} · {active.level} level
            </p>
          </div>
        )}

        {/* Mode selector */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {(['add', 'edit', 'cancel'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); resetForm(); }}
              className={cn('rounded-xl border py-2 text-[13px] font-semibold capitalize transition',
                mode === m ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950' : 'border-border text-ink-muted')}>
              {m === 'add' ? 'Add extra' : m === 'edit' ? 'Edit class' : 'Cancel class'}
            </button>
          ))}
        </div>

        {/* Date */}
        <label className="mb-1 block text-[13px] font-semibold text-ink">Date</label>
        <input type="date" value={date} min={todayStr} onChange={e => setDate(e.target.value)}
          className="mb-4 w-full rounded-xl border border-border bg-transparent px-3 py-2 text-[14px] text-ink dark:border-[#333]" />

        {/* For edit/cancel — pick the official class */}
        {(mode === 'edit' || mode === 'cancel') && (
          <div className="mb-4">
            <label className="mb-1 block text-[13px] font-semibold text-ink">Which class?</label>
            {official.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No official classes found for this class.</p>
            ) : (
              <div className="space-y-1.5">
                {official.map(c => (
                  <button key={c.id} onClick={() => pickTarget(c)}
                    className={cn('flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition',
                      targetClassId === c.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-950' : 'border-border')}>
                    <span className="text-[13px] font-medium text-ink">{c.course_code} {c.course_title}</span>
                    <span className="text-[12px] text-ink-muted">{c.day} {c.start_time}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Class details for add/edit */}
        {(mode === 'add' || mode === 'edit') && (
          <div className="mb-4 space-y-2.5">
            <Input placeholder="Course title (required)" value={form.course_title} onChange={e => setForm(f => ({ ...f, course_title: e.target.value }))} />
            <Input placeholder="Course code (e.g. ACC301)" value={form.course_code} onChange={e => setForm(f => ({ ...f, course_code: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[12px] text-ink-muted">Start</label>
                <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-[14px] text-ink dark:border-[#333]" />
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-ink-muted">End</label>
                <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-[14px] text-ink dark:border-[#333]" />
              </div>
            </div>
            <Input placeholder="Venue" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
            <Input placeholder="Lecturer" value={form.lecturer} onChange={e => setForm(f => ({ ...f, lecturer: e.target.value }))} />
          </div>
        )}

        {/* Optional note shown to students */}
        <Input placeholder="Note for students (optional, e.g. 'Extra class for missed lecture')"
          value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className="mb-3" />

        {formError && <p className="mb-3 text-[13px] text-red-600">{formError}</p>}

        <Button onClick={submit} loading={submitting} className="w-full">
          {mode === 'add' ? 'Add extra class' : mode === 'edit' ? 'Save change for that day' : 'Cancel class for that day'}
        </Button>

        {/* Existing upcoming overrides */}
        {overrides.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-2 text-[14px] font-bold text-ink">Upcoming changes you&apos;ve made</h2>
            <div className="space-y-2">
              {overrides.map(o => (
                <div key={o.id} className="flex items-start justify-between gap-2 rounded-xl border border-border px-3 py-2.5 dark:border-[#222]">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">
                      <span className={cn('mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                        o.kind === 'add' ? 'bg-amber-100 text-amber-700' : o.kind === 'cancel' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>
                        {o.kind}
                      </span>
                      {o.course_code} {o.course_title || (o.kind === 'cancel' ? '(cancelled)' : '')}
                    </p>
                    <p className="text-[12px] text-ink-muted">
                      {new Date(o.override_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                      {o.start_time ? ` · ${o.start_time}${o.end_time ? `–${o.end_time}` : ''}` : ''}
                    </p>
                    {o.note && <p className="text-[11px] text-ink-muted">✎ {o.note}</p>}
                  </div>
                  <button onClick={() => deleteOverride(o.id)} className="shrink-0 text-[12px] font-medium text-red-600 hover:text-red-700">
                    Undo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-lg dark:bg-[#222]">
          {toast}
        </div>
      )}
    </div>
  );
}
