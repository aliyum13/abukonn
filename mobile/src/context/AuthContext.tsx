import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, fetchMe, ApiUser } from '../lib/api';
import { saveToken, getToken, clearToken } from '../lib/storage';
import { registerForPush, unregisterPush } from '../lib/push';

interface AuthState {
  user: ApiUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On launch: a stored token might be expired or revoked, so verify it with the
  // server rather than assuming it's still good.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) { setLoading(false); return; }
      try {
        const res = await fetchMe();
        setUser(res.user);
        // Re-register each launch: push tokens rotate, and the user may have
        // changed notification permissions in system settings since last time.
        registerForPush();
      } catch {
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    await saveToken(res.token);
    setUser(res.user);
    // Deliberately NOT awaited — if the push prompt is declined or fails, login
    // must still succeed.
    registerForPush();
  }, []);

  const signOut = useCallback(async () => {
    // Unregister BEFORE clearing the token (the call needs to be authenticated),
    // otherwise this phone keeps receiving the old user's notifications.
    await unregisterPush();
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
