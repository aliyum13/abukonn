'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  Semester, GRADES, computeSemester, computeCumulative, classification, round2,
  loadSemesters, saveSemesters, newSemester, newCourse,
} from '@/lib/cgpa';

export default function CgpaCalculatorPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loaded, setLoaded] = useState(false);

  // localStorage is only available client-side, so load after mount.
  useEffect(() => {
    const saved = loadSemesters();
    setSemesters(saved.length > 0 ? saved : [newSemester('Semester 1')]);
    setLoaded(true);
  }, []);

  const persist = (next: Semester[]) => {
    setSemesters(next);
    saveSemesters(next);
  };

  const addSemester = () => persist([...semesters, newSemester(`Semester ${semesters.length + 1}`)]);

  const removeSemester = (id: string) => {
    if (semesters.length <= 1) return;
    if (!window.confirm('Remove this semester? This deletes all courses entered for it.')) return;
    persist(semesters.filter(sem => sem.id !== id));
  };

  const updateSemesterLabel = (id: string, label: string) =>
    persist(semesters.map(sem => sem.id === id ? { ...sem, label } : sem));

  const addCourse = (semId: string) =>
    persist(semesters.map(sem => sem.id === semId ? { ...sem, courses: [...sem.courses, newCourse()] } : sem));

  const removeCourse = (semId: string, courseId: string) =>
    persist(semesters.map(sem =>
      sem.id === semId ? { ...sem, courses: sem.courses.filter(c => c.id !== courseId) } : sem
    ));

  const updateCourse = (semId: string, courseId: string, patch: Partial<{ code: string; creditUnit: number; grade: string }>) =>
    persist(semesters.map(sem =>
      sem.id === semId
        ? { ...sem, courses: sem.courses.map(c => c.id === courseId ? { ...c, ...patch } : c) }
        : sem
    ));

  const resetAll = () => {
    if (!window.confirm('Reset everything? This clears all semesters and courses. This cannot be undone.')) return;
    persist([newSemester('Semester 1')]);
  };

  if (!loaded) {
    return <div className="mx-auto max-w-3xl px-4 py-6" />;
  }

  const cumulative = computeCumulative(semesters);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-sm font-bold text-ink">CGPA Calculator</h1>
          <p className="mt-1 text-body-sm text-ink-muted">Grading scale: A=5, B=4, C=3, D=2, E=1, F=0</p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetAll}>Reset</Button>
      </div>

      {/* Cumulative summary */}
      <Card className="mb-6 bg-brand-600 border-brand-600">
        <CardContent className="flex flex-col items-center p-6 text-center">
          <p className="text-label uppercase tracking-wide text-white/80">Cumulative GPA</p>
          <p className="mt-1 text-5xl font-black text-white">{round2(cumulative.cgpa)}</p>
          <p className="mt-1 text-body-sm font-semibold text-white">
            {cumulative.cgpa !== null ? classification(cumulative.cgpa) : 'Enter courses below to get started'}
          </p>
          <p className="mt-3 text-caption text-white/70">TCP {cumulative.tcp} / TCUR {cumulative.tcur}</p>
        </CardContent>
      </Card>

      {semesters.map((sem) => {
        const result = computeSemester(sem);
        return (
          <Card key={sem.id} className="mb-4">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={sem.label}
                  onChange={(e) => updateSemesterLabel(sem.id, e.target.value)}
                  placeholder="Semester name"
                  className="flex-1 border-0 bg-transparent p-0 text-body-md font-bold text-ink focus:outline-none focus:ring-0"
                />
                <button
                  onClick={() => removeSemester(sem.id)}
                  className="text-ink-muted hover:text-red-600"
                  aria-label="Remove semester"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {sem.courses.map((course) => (
                  <div key={course.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 dark:border-[#2a2a2a] sm:border-0 sm:p-0">
                    <input
                      value={course.code}
                      onChange={(e) => updateCourse(sem.id, course.id, { code: e.target.value.toUpperCase() })}
                      placeholder="Code"
                      className="w-24 min-w-0 flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333] sm:w-28 sm:flex-none"
                    />
                    <input
                      value={course.creditUnit || ''}
                      onChange={(e) => updateCourse(sem.id, course.id, { creditUnit: parseInt(e.target.value, 10) || 0 })}
                      placeholder="CU"
                      type="number"
                      min={0}
                      className="w-14 shrink-0 rounded-lg border border-border bg-white px-2 py-1.5 text-center text-body-sm text-ink focus:border-brand-500 focus:outline-none dark:bg-[#111] dark:border-[#333]"
                    />
                    <button
                      onClick={() => removeCourse(sem.id, course.id)}
                      className="shrink-0 text-ink-muted hover:text-red-600"
                      aria-label="Remove course"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {/* Grade chips get their own row -- 6 chips at ~28px each fit
                        one line even on a narrow phone, they just don't fit
                        alongside the code/CU inputs too on the same line. */}
                    <div className="flex w-full gap-1 sm:w-auto">
                      {GRADES.map((g) => (
                        <button
                          key={g}
                          onClick={() => updateCourse(sem.id, course.id, { grade: g })}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full border text-caption font-bold transition',
                            course.grade === g
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : 'border-border text-ink-secondary hover:border-brand-300 dark:border-[#333]'
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addCourse(sem.id)}
                className="mt-3 flex items-center gap-1 text-body-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add course
              </button>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 dark:border-[#333]">
                <p className="font-bold text-ink">GPA: {round2(result.gpa)}</p>
                <p className="text-caption text-ink-muted">TCP {result.tcp} / TCUR {result.tcur}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <button
        onClick={addSemester}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-400 py-3 text-body-sm font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40"
      >
        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Add semester
      </button>

      <p className="pb-8 text-center text-caption text-ink-muted">
        Saved in this browser only.
      </p>
    </div>
  );
}
