import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, refreshCsrfToken } from '../lib/api';

export interface User {
  id: string;
  email: string;
  role: 'student' | 'club' | 'staff' | 'admin';
  branch: string | null;
  year: number | null;
  section: string | null;
  club: string | null;
  veg_pref: boolean | null;
  budget_default: number | null;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileComplete: boolean;
  requestOtp: (email: string) => Promise<string>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  updateProfile: (profile: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const resp = await apiClient.get('/api/me');
      setUser(resp.data.user);
      await refreshCsrfToken();
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const requestOtp = async (email: string): Promise<string> => {
    const res = await apiClient.post('/api/auth/otp/request', { email });
    return res.data.message;
  };

  const verifyOtp = async (email: string, code: string): Promise<void> => {
    const res = await apiClient.post('/api/auth/otp/verify', { email, code });
    setUser(res.data.user);
    await refreshCsrfToken();
  };

  const updateProfile = async (profile: Partial<User>): Promise<void> => {
    const res = await apiClient.patch('/api/me', profile);
    setUser(res.data.user);
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const profileComplete = Boolean(
    user && user.branch && user.year && user.section
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileComplete,
        requestOtp,
        verifyOtp,
        updateProfile,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
