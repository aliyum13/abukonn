// Mirrors mobile/src/lib/cgpa.ts exactly — same grading scale, same formulas,
// validated against the same real ABU result sheet. Only the persistence
// layer differs (localStorage here vs AsyncStorage on mobile), since the two
// platforms don't share a code directory in this project.

export const GRADE_POINTS: Record<string, number> = {
  A: 5, B: 4, C: 3, D: 2, E: 1, F: 0,
};
export const GRADES = Object.keys(GRADE_POINTS) as Array<keyof typeof GRADE_POINTS>;

export interface Course {
  id: string;
  code: string;
  creditUnit: number;
  grade: string;
}

export interface Semester {
  id: string;
  label: string;
  courses: Course[];
}

export interface SemesterResult {
  tcp: number;
  tcur: number;
  gpa: number | null;
}

// Verified against a real ABU sheet: semester 1 = 98/23 = 4.26, semester 2 =
// 83/18 = 4.61.
export function computeSemester(semester: Semester): SemesterResult {
  let tcp = 0;
  let tcur = 0;
  for (const c of semester.courses) {
    const cu = Number(c.creditUnit) || 0;
    const points = GRADE_POINTS[c.grade];
    if (cu <= 0 || points === undefined) continue;
    tcur += cu;
    tcp += cu * points;
  }
  return { tcp, tcur, gpa: tcur > 0 ? tcp / tcur : null };
}

// Verified against the same sheet: (98+83)/(23+18) = 181/41 = 4.41.
export function computeCumulative(semesters: Semester[]): { cgpa: number | null; tcp: number; tcur: number } {
  let tcp = 0;
  let tcur = 0;
  for (const sem of semesters) {
    const r = computeSemester(sem);
    tcp += r.tcp;
    tcur += r.tcur;
  }
  return { cgpa: tcur > 0 ? tcp / tcur : null, tcp, tcur };
}

export function classification(cgpa: number | null): string {
  if (cgpa === null) return '';
  if (cgpa >= 4.5) return 'First Class';
  if (cgpa >= 3.5) return 'Second Class Upper';
  if (cgpa >= 2.4) return 'Second Class Lower';
  if (cgpa >= 1.5) return 'Third Class';
  if (cgpa >= 1.0) return 'Pass';
  return 'Fail';
}

export function round2(n: number | null): string {
  return n === null ? '—' : n.toFixed(2);
}

// ── local persistence (browser localStorage) ────────────────────────────────
const STORAGE_KEY = 'abukonn_cgpa_semesters_v1';

export function loadSemesters(): Semester[] {
  if (typeof window === 'undefined') return []; // SSR pass — no window yet
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSemesters(semesters: Semester[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(semesters));
    return true;
  } catch {
    return false; // e.g. private-browsing quota errors — non-fatal, just don't persist
  }
}

export function newSemester(label: string): Semester {
  return { id: String(Date.now()) + Math.random().toString(36).slice(2, 7), label, courses: [] };
}

export function newCourse(): Course {
  return { id: String(Date.now()) + Math.random().toString(36).slice(2, 7), code: '', creditUnit: 0, grade: '' };
}
