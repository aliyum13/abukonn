import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

export const API_URL = 'http://172.20.10.8:3000';

export interface User {
  id: number;
  matric_number: string;
  full_name: string;
  email: string;
  department: string;
  level: string;
  profile_photo_url: string | null;
  bio: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (matricNumber: string, password: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await AsyncStorage.getItem('abukonn_token');
      const storedUser = await AsyncStorage.getItem('abukonn_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
      setLoading(false);
    })();
  }, []);

  const persistAuth = async (newToken: string, newUser: User) => {
    await AsyncStorage.setItem('abukonn_token', newToken);
    await AsyncStorage.setItem('abukonn_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const login = async (matricNumber: string, password: string) => {
    const { data } = await axios.post(`${API_URL}/api/auth/login`, {
      matric_number: matricNumber,
      password,
    });
    await persistAuth(data.token, data.user);
  };

  const register = async (registerData: RegisterData) => {
    const { data } = await axios.post(`${API_URL}/api/auth/register`, registerData);
    await persistAuth(data.token, data.user);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['abukonn_token', 'abukonn_user']);
    setToken(null);
    setUser(null);
  };

  const updateUser = async (updatedUser: User) => {
    await AsyncStorage.setItem('abukonn_user', JSON.stringify(updatedUser));
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
