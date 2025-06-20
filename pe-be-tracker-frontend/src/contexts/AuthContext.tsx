import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/shared/api/client';

interface User {
  id: number;
  email: string;
  name?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  // Forces a refresh of the user object (e.g. after login completes)
  refresh: () => Promise<void>;
  // Logs the user out and clears state
  signOut: () => Promise<void>;
  // Convenience helper
  isAuthenticated: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const { data } = await api.get<User>('/users/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const refresh = async () => {
    setLoading(true);
    await fetchCurrentUser();
  };

  const signOut = async () => {
    try {
      // FastAPI-Users exposes this route on the auth router
      await api.post('/auth/jwt/logout');
    } catch {
      /* ignore */
    } finally {
      setUser(null);
      // Redirect to landing page
      window.location.href = '/';
    }
  };

  const isAuthenticated = () => !!user;

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}; 