/* RASID — Auth Context with real local authentication via tRPC */
import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

export type UserRole = 'admin' | 'editor' | 'viewer' | 'analyst' | 'user';

export interface User {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  mobile: string | null;
  role: string;
  department: string | null;
  avatar: string | null;
  status: string;
  permissions: string[];
  createdAt: string;
  lastSignedIn: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<User>) => void;
}

interface RegisterData {
  userId: string;
  displayName: string;
  password: string;
  email?: string;
  mobile?: string;
  department?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const utils = trpc.useUtils();

  // Sync user from server
  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data as User);
      setIsLoading(false);
    } else if (meQuery.isError || meQuery.data === null) {
      setUser(null);
      setIsLoading(false);
    }
  }, [meQuery.data, meQuery.isError]);

  const login = useCallback(async (userId: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({ userId, password });
      if (result.success && 'user' in result) {
        setUser(result.user as User);
        utils.auth.me.invalidate();
        return { success: true };
      }
      return { success: false, error: 'error' in result ? result.error : 'فشل تسجيل الدخول' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ في الاتصال' };
    }
  }, [loginMutation, utils]);

  const register = useCallback(async (data: RegisterData) => {
    try {
      const result = await registerMutation.mutateAsync({
        userId: data.userId,
        password: data.password,
        displayName: data.displayName,
        email: data.email,
        mobile: data.mobile,
        department: data.department,
      });
      if (result.success && 'user' in result) {
        setUser(result.user as User);
        utils.auth.me.invalidate();
        return { success: true };
      }
      return { success: false, error: 'error' in result ? result.error : 'فشل التسجيل' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'خطأ في الاتصال' };
    }
  }, [registerMutation, utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
      setUser(null);
      utils.auth.me.setData(undefined, null);
    } catch {
      // Force clear on error
      setUser(null);
    }
  }, [logoutMutation, utils]);

  const forgotPassword = useCallback(async (_email: string) => {
    return { success: true };
  }, []);

  const resetPassword = useCallback(async (_token: string, _password: string) => {
    return { success: true };
  }, []);

  const updateProfile = useCallback((data: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...data };
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      forgotPassword,
      resetPassword,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
