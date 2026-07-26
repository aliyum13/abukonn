// ABU's standard 5-point grading scale. Confirmed against a real ABU result
// sheet (100L, both semesters): A=5, B=4, C=3, matching every worked example
// on it, including the GPA/CGPA formulas below.
export const GRADE_POINTS: Record<string, number> = {
  A: 5, B: 4, C: 3, D: 2, E: 1, F: 0,
};
export const GRADES = Object.keys(GRADE_POINTS) as Array<keyof typeof GRADE_POINTS>;

export interface Course {
  id: string;
  code: string;
  creditUnit: number;
  grade: string; // one of GRADES
}

export interface Semester {
  id: string;
  label: string; // e.g. "100L First Semester"
  courses: Course[];
}

export interface SemesterResult {
  tcp: number;   // Total Credit Points this semester (Σ grade_point × credit_unit)
  tcur: number;  // Total Credit Units Registered this semester (Σ credit_unit)
  gpa: number | null; // tcp/tcur, null if tcur is 0 (nothing entered yet)
}

/**
 * Per-semester GPA = TCP / TCUR, using ALL registered units — a failed course
 * still counts its credit units in the denominator. Verified against the ABU
 * sheet: semester 1 = 98/23 = 4.26, semester 2 = 83/18 = 4.61.
 */
export function computeSemester(semester: Semester): SemesterResult {
  let tcp = 0;
  let tcur = 0;
  for (const c of semester.courses) {
    const cu = Number(c.creditUnit) || 0;
    const points = GRADE_POINTS[c.grade];
    if (cu <= 0 || points === undefined) continue; // skip incomplete rows
    tcur += cu;
    tcp += cu * points;
  }
  return { tcp, tcur, gpa: tcur > 0 ? tcp / tcur : null };
}

/**
 * Cumulative CGPA = (Σ all previous TCP + current TCP) / (Σ all previous TCUR
 * + current TCUR) — i.e. every semester's TCP and TCUR summed together, then
 * divided. Verified against the ABU sheet: (98+83)/(23+18) = 181/41 = 4.41.
 */
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

// ── local persistence ───────────────────────────────────────────────────────
// Personal calculator data, not auth-sensitive — a plain key-value store is
// the right tool, not expo-secure-store (small, Keychain-oriented; a full
// multi-semester record could realistically outgrow its practical per-item
// size limits, especially on Android). Required lazily and guarded, same
// discipline as expo-notifications/expo-secure-store elsewhere in this app —
// this file is only ever reached by the CGPA screen (an expo-router route,
// evaluated lazily), so this is never on the app's eager launch path, but the
// guard costs nothing and keeps the pattern consistent.
const STORAGE_KEY = 'abukonn_cgpa_semesters_v1';

type AsyncStorageModule = typeof import('@react-native-async-storage/async-storage');
let storageMod: AsyncStorageModule | null | undefined;
function getStorage(): AsyncStorageModule['default'] | null {
  if (storageMod === undefined) {
    try {
      storageMod = require('@react-native-async-storage/async-storage') as AsyncStorageModule;
    } catch (err) {
      console.log('CGPA: AsyncStorage unavailable', err);
      storageMod = null;
    }
  }
  return storageMod ? storageMod.default : null;
}

export async function loadSemesters(): Promise<Semester[]> {
  const AsyncStorage = getStorage();
  if (!AsyncStorage) return [];
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSemesters(semesters: Semester[]): Promise<boolean> {
  const AsyncStorage = getStorage();
  if (!AsyncStorage) return false;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(semesters));
    return true;
  } catch (err) {
    console.log('CGPA: save failed', err);
    return false;
  }
}

export function newSemester(label: string): Semester {
  return { id: String(Date.now()) + Math.random().toString(36).slice(2, 7), label, courses: [] };
}

export function newCourse(): Course {
  return { id: String(Date.now()) + Math.random().toString(36).slice(2, 7), code: '', creditUnit: 0, grade: '' };
}
