'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, Skeleton, EmptyState } from '@/components/ui';

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

function formatDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SemesterTable({ title, entries }: { title: string; entries: CalendarEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-[15px] font-semibold text-ink">{title}</h2>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-border text-caption uppercase tracking-wide text-ink-muted dark:border-[#222]">
                  <th className="px-4 py-3 font-medium">Activity</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">From</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">To</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Period</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} className={cn('border-b border-border last:border-0 dark:border-[#222]', i % 2 === 1 && 'bg-surface-muted/40 dark:bg-white/[0.02]')}>
                    <td className="px-4 py-3 font-medium text-ink">{e.activity}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{formatDate(e.from_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-secondary">{formatDate(e.to_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{e.period || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcademicCalendarPage() {
  const { token } = useAuth();
  const [session, setSession] = useState<string | null>(null);
  const [sessions, setSessions] = useState<string[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const load = useCallback(async (sess?: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = sess ? `${API_URL}/api/academic-calendar?session=${encodeURIComponent(sess)}` : `${API_URL}/api/academic-calendar`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json() as { session: string | null; entries: CalendarEntry[] };
        setSession(data.session);
        setSelectedSession(data.session);
        setEntries(data.entries);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    load();
    fetch(`${API_URL}/api/academic-calendar/sessions`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSessions(d.sessions || []))
      .catch(() => {});
  }, [token, load]);

  const firstSem = entries.filter(e => e.semester === 'first');
  const secondSem = entries.filter(e => e.semester === 'second');

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Academic Calendar</h1>
          {session && <p className="text-body-sm text-ink-muted">{session} session</p>}
        </div>
        {sessions.length > 1 && (
          <select
            value={selectedSession ?? ''}
            onChange={e => { setSelectedSession(e.target.value); load(e.target.value); }}
            className="rounded-xl border border-border bg-white px-3 py-2 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]"
          >
            {sessions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="No calendar published yet"
          description="The academic calendar for this session hasn't been added yet. Check back soon."
        />
      ) : (
        <>
          <SemesterTable title="First Semester" entries={firstSem} />
          <SemesterTable title="Second Semester" entries={secondSem} />
          <p className="mt-2 text-caption text-ink-muted">
            All national and state public holidays will be observed. Dates are subject to change by the University.
          </p>
        </>
      )}
    </div>
  );
}
