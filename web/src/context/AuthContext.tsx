'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface User {
  id: number;
  full_name: string;
  username?: string;
  email: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  bio: string | null;
  is_admin: boolean;
  role?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

interface RegisterData {
  full_name: string;
  email: string;
  department: string;
  level: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const INACTIVITY_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

function touchActivity() {
  localStorage.setItem('abukonn_last_active', String(Date.now()));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Startup: inactivity check + restore session
  useEffect(() => {
    const storedToken = localStorage.getItem('abukonn_token');
    const storedUser = localStorage.getItem('abukonn_user');
    const lastActive = localStorage.getItem('abukonn_last_active');

    if (storedToken && storedUser) {
      // Check inactivity — if last_active was set and is > 24h ago, expire the session
      if (lastActive && Date.now() - parseInt(lastActive, 10) > INACTIVITY_LIMIT_MS) {
        localStorage.removeItem('abukonn_token');
        localStorage.removeItem('abukonn_user');
        localStorage.removeItem('abukonn_last_active');
        setLoading(false);
        window.location.replace('/login?reason=session_expired');
        return;
      }

      touchActivity();
      setToken(storedToken);
      setUser(JSON.parse(storedUser));

      fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.user) {
            localStorage.setItem('abukonn_user', JSON.stringify(data.user));
            setUser(data.user);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Track user activity — update last_active on click, keypress, scroll
  useEffect(() => {
    const touch = () => touchActivity();
    document.addEventListener('click', touch, { passive: true });
    document.addEventListener('keypress', touch, { passive: true });
    document.addEventListener('scroll', touch, { passive: true });
    return () => {
      document.removeEventListener('click', touch);
      document.removeEventListener('keypress', touch);
      document.removeEventListener('scroll', touch);
    };
  }, []);

  const persistAuth = (newToken: string, newUser: User) => {
    localStorage.setItem('abukonn_token', newToken);
    localStorage.setItem('abukonn_user', JSON.stringify(newUser));
    touchActivity();
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    persistAuth(data.token, data.user);
  };

  const register = async (registerData: RegisterData) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerData),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    persistAuth(data.token, data.user);
  };

  const logout = () => {
    localStorage.removeItem('abukonn_token');
    localStorage.removeItem('abukonn_user');
    localStorage.removeItem('abukonn_last_active');
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    localStorage.setItem('abukonn_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
