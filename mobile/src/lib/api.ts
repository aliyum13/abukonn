import Constants from 'expo-constants';
import { getToken } from './storage';

// The live ABUkonn backend — the same one the web app talks to.
export const API_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'https://abukonn-production.up.railway.app';

// Thrown by fetchWithTimeout when a request is aborted for taking too long,
// distinct from a plain network failure so callers (namely apiFetch below)
// can surface a clear "timed out" message instead of collapsing it into the
// generic "Network error" one.
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// fetch() has no timeout of its own -- on a hung connection (weak campus
// WiFi/cellular handoff, backgrounding mid-request) the promise never
// resolves OR rejects, so any try/finally gating a `loading` flag never
// reaches `finally` and the screen is stuck on its spinner permanently with
// no error and no in-app recovery except backing out and back in. This
// wraps fetch in an AbortController so a hung request reliably fails
// instead of hanging forever.
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new TimeoutError('Request timed out — check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Generous enough for a normal API call on a slow connection without making
// a genuinely dead request hang around forever.
const REQUEST_TIMEOUT_MS = 20000;

// Mirrors the backend's toPrivateUser().
export interface ApiUser {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  department: string | null;
  level: string | null;
  profile_photo_url: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
  role?: string;
  is_verified?: boolean;
  is_content_creator?: boolean;
  is_admin?: boolean;
  is_pro?: boolean;
  pro_expires_at?: string | null;
}

// Attaches the token, parses JSON, and surfaces real errors rather than
// failing silently.
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  withAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (withAuth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(`${API_URL}${path}`, { ...options, headers }, REQUEST_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof TimeoutError) throw err;
    throw new Error('Network error — check your connection.');
  }

  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

  if (!res.ok) {
    const msg = (data as { message?: string } | null)?.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}

export function login(email: string, password: string) {
  return apiFetch<{ token: string; user: ApiUser }>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    false,
  );
}

export function register(input: {
  full_name: string; email: string; department: string; level: string; password: string;
}) {
  return apiFetch<{ token: string; user: ApiUser }>(
    '/api/auth/register',
    { method: 'POST', body: JSON.stringify(input) },
    false,
  );
}

// Password reset is a 3-step flow: request an OTP by email, verify it, then set a
// new password. Mirrors the web client.
export function forgotPassword(email: string) {
  return apiFetch<{ message: string }>(
    '/api/auth/forgot-password',
    { method: 'POST', body: JSON.stringify({ email }) },
    false,
  );
}

export function verifyOtp(email: string, otp: string) {
  return apiFetch<{ valid: boolean; reset_token: string }>(
    '/api/auth/verify-otp',
    { method: 'POST', body: JSON.stringify({ email, otp }) },
    false,
  );
}

export function resetPassword(input: { reset_token: string; new_password: string }) {
  return apiFetch<{ message: string }>(
    '/api/auth/reset-password',
    { method: 'POST', body: JSON.stringify(input) },
    false,
  );
}

// NOTE: the current-user endpoint is /api/users/me — there is no /api/auth/me.
export function fetchMe() {
  return apiFetch<{ user: ApiUser }>('/api/users/me');
}
