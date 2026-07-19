import Constants from 'expo-constants';
import { getToken } from './storage';

// The live ABUkonn backend — the same one the web app talks to.
export const API_URL: string =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ||
  'https://abukonn-production.up.railway.app';

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
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
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
