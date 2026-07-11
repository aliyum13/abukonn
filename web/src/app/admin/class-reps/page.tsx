'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Avatar, Button, Input, Card, CardContent } from '@/components/ui';
import { DEPARTMENTS_ALPHABETICAL, LEVELS } from '@/lib/departments';
import { formatLevel } from '@/lib/format';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Rep { id: number; user_id: number; full_name: string; profile_photo_url: string | null; department: string; level: string }
interface FoundUser { id: number; full_name: string; department: string | null; profile_photo_url: string | null }

export default function AdminClassRepsPage() {
  const { token } = useAuth();
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  // Assignment form
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<FoundUser[]>([]);
  const [picked, setPicked] = useState<FoundUser | null>(null);
  const [dept, setDept] = useState('');
  const [level, setLevel] = useState<string>('300 Level');
  const [assigning, setAssigning] = useState(false);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const loadReps = useCallback(() => {
    if (!token) return;
    fetch(`${API_URL}/api/admin/class-reps`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setReps(d.reps || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { loadReps(); }, [loadReps]);

  // Search users by name
  useEffect(() => {
    if (!token || search.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`${API_URL}/api/follows/search?q=${encodeURIComponent(search.trim())}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setResults(d.results || []))
        .catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(t);
  }, [search, token]);

  const assign = async () => {
    if (!token || !picked || !dept || !level) return;
    setAssigning(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/class-reps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: picked.id, department: dept, level }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || 'Failed'); return; }
      showToast(`${picked.full_name} is now a class rep`);
      setPicked(null); setSearch(''); setResults([]);
      loadReps();
    } catch { showToast('Network error'); }
    finally { setAssigning(false); }
  };

  const remove = async (id: number) => {
    if (!token) return;
    setReps(prev => prev.filter(r => r.id !== id));
    try {
      await fetch(`${API_URL}/api/admin/class-reps/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    } catch { loadReps(); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="text-ink-muted">←</Link>
        <div>
          <h1 className="text-[22px] font-bold text-ink">Class Representatives</h1>
          <p className="text-[13px] text-ink-muted">Assign students to manage day-to-day timetable changes for their class.</p>
        </div>
      </div>

      {/* Assign new rep */}
      <Card className="mb-6">
        <CardContent className="p-5">
          <h2 className="mb-3 font-semibold text-ink">Assign a class rep</h2>

          {!picked ? (
            <>
              <Input placeholder="Search student by name…" value={search} onChange={e => setSearch(e.target.value)} />
              {results.length > 0 && (
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-border dark:border-[#222]">
                  {results.map(u => (
                    <button key={u.id} onClick={() => setPicked(u)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-surface-muted dark:hover:bg-[#1a1a1a]">
                      <Avatar src={u.profile_photo_url} name={u.full_name} size="sm" />
                      <div>
                        <p className="text-[13px] font-medium text-ink">{u.full_name}</p>
                        <p className="text-[11px] text-ink-muted">{u.department}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 dark:bg-[#1a1a1a]">
                <div className="flex items-center gap-2">
                  <Avatar src={picked.profile_photo_url} name={picked.full_name} size="sm" />
                  <p className="text-[13px] font-medium text-ink">{picked.full_name}</p>
                </div>
                <button onClick={() => setPicked(null)} className="text-[12px] text-ink-muted">Change</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] text-ink-muted">Department</label>
                  <select value={dept} onChange={e => setDept(e.target.value)}
                    className="w-full rounded-xl border border-border bg-transparent px-2 py-2 text-[13px] text-ink dark:border-[#333]">
                    <option value="">Select…</option>
                    {DEPARTMENTS_ALPHABETICAL.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] text-ink-muted">Level</label>
                  <select value={level} onChange={e => setLevel(e.target.value)}
                    className="w-full rounded-xl border border-border bg-transparent px-2 py-2 text-[13px] text-ink dark:border-[#333]">
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <Button onClick={assign} loading={assigning} disabled={!dept} className="w-full">Assign as class rep</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current reps */}
      <h2 className="mb-3 font-semibold text-ink">Current class reps</h2>
      {loading ? (
        <p className="text-[13px] text-ink-muted">Loading…</p>
      ) : reps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-ink-muted dark:border-[#222]">
          No class reps assigned yet.
        </p>
      ) : (
        <div className="space-y-2">
          {reps.map(r => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 dark:border-[#222]">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={r.profile_photo_url} name={r.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">{r.full_name}</p>
                  <p className="truncate text-[12px] text-ink-muted">{r.department} · {formatLevel(r.level)}</p>
                </div>
              </div>
              <button onClick={() => remove(r.id)} className="shrink-0 text-[12px] font-medium text-red-600 hover:text-red-700">Remove</button>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white shadow-lg dark:bg-[#222]">
          {toast}
        </div>
      )}
    </div>
  );
}
