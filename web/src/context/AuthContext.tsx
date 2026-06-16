'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface User {
  id: number;
  matric_number: string;
  full_name: string;
  email: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  bio: string | null;
  is_admin: boolean;
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
  matric_number: string;
  full_name: string;
  email: string;
  department: string;
  level: string;
  password: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('abukonn_token');
    const storedUser = localStorage.getItem('abukonn_user');

    if (storedToken && storedUser) {
      // Set cached data immediately so the UI isn't blank
      setToken(storedToken);
      setUser(JSON.parse(storedUser));

      // Refresh from API to pick up any server-side changes (e.g. is_admin)
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

  const persistAuth = (newToken: string, newUser: User) => {
    localStorage.setItem('abukonn_token', newToken);
    localStorage.setItem('abukonn_user', JSON.stringify(newUser));
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
