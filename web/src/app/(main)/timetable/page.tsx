'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button, Card, CardContent, Skeleton } from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
type Day = (typeof DAYS)[number];
const DAY_SHORT: Record<Day, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri',
};
const TODAY_IDX = Math.min(4, Math.max(0, new Date().getDay() - 1)); // 0=Mon … 4=Fri; clamp weekends to Mon

interface TimetableClass {
  id: number;
  day: Day;
  start_time: string;
  end_time: string;
  course_code: string | null;
  course_title: string;
  venue: string | null;
  lecturer: string | null;
  status: 'holding' | 'cancelled';
}

export default function TimetablePage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<TimetableClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [activeDay, setActiveDay] = useState<Day>(DAYS[TODAY_IDX]);
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');

  useEffect(() => {
    if (!authLoading && !token) router.push('/login');
  }, [authLoading, token, router]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/timetable/week`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setClasses(d.classes || []);
        setNoProfile(!!d.no_profile);
        setDepartment(d.department || '');
        setLevel(d.level || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const dayClasses = classes.filter(c => c.day === activeDay);

  if (authLoading || !user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">My Timetable</h1>
          {department && level && (
            <p className="mt-0.5 text-[13px] text-ink-muted">{department} · {level}</p>
          )}
        </div>
      </div>

      {noProfile ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-2xl mb-3">📚</p>
            <p className="font-semibold text-ink">No timetable available</p>
            <p className="mt-1 text-[14px] text-ink-muted">
              Set your department and level in Settings to see your timetable.
            </p>
            <Link href="/settings#account" className="mt-4 block">
              <Button size="sm" variant="outline">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Day tabs */}
          <div className="mb-4 flex gap-1 rounded-xl bg-surface-muted p-1 dark:bg-[#1a1a1a]">
            {DAYS.map(day => (
              <button key={day} type="button" onClick={() => setActiveDay(day)}
                className={cn(
                  'flex-1 rounded-lg py-2 text-[13px] font-medium transition',
                  activeDay === day
                    ? 'bg-white dark:bg-[#111] text-brand-700 dark:text-brand-400 shadow-sm'
                    : 'text-ink-secondary hover:text-ink'
                )}>
                {DAY_SHORT[day]}
                {day === DAYS[TODAY_IDX] && (
                  <span className="ml-1 h-1.5 w-1.5 inline-block rounded-full bg-brand-500 align-middle" />
                )}
              </button>
            ))}
          </div>

          {/* Classes */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
          ) : dayClasses.length === 0 ? (
            <div className="rounded-2xl border border-border py-16 text-center dark:border-[#222]">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-medium text-ink">No classes on {activeDay}</p>
              <p className="mt-1 text-[13px] text-ink-muted">Free day! Enjoy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayClasses.map(cls => {
                const isCancelled = cls.status === 'cancelled';
                return (
                  <div key={cls.id}
                    className={cn(
                      'rounded-2xl border p-4',
                      isCancelled
                        ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
                        : 'border-indigo-200 bg-indigo-50 dark:border-indigo-900/40 dark:bg-indigo-950/30'
                    )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn(
                            'font-bold text-[15px] leading-snug',
                            isCancelled ? 'text-red-900 line-through dark:text-red-200' : 'text-indigo-900 dark:text-indigo-100'
                          )}>
                            {cls.course_code && <span className="mr-1.5">{cls.course_code}</span>}
                            {cls.course_title}
                          </p>
                          {isCancelled && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                              Cancelled
                            </span>
                          )}
                        </div>
                        {cls.venue && (
                          <p className={cn('mt-1 text-[13px]', isCancelled ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400')}>📍 {cls.venue}</p>
                        )}
                        {cls.lecturer && (
                          <p className={cn('text-[13px]', isCancelled ? 'text-red-600 dark:text-red-400' : 'text-indigo-600 dark:text-indigo-400')}>👨‍🏫 {cls.lecturer}</p>
                        )}
                      </div>
                      <div className={cn(
                        'shrink-0 rounded-xl px-3 py-1.5 text-center',
                        isCancelled ? 'bg-red-100 dark:bg-red-900/50' : 'bg-indigo-100 dark:bg-indigo-900/50'
                      )}>
                        <p className={cn('text-[12px] font-bold', isCancelled ? 'text-red-700 dark:text-red-300' : 'text-indigo-700 dark:text-indigo-300')}>{cls.start_time}</p>
                        <p className={cn('text-[10px]', isCancelled ? 'text-red-500' : 'text-indigo-500')}>to {cls.end_time}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
