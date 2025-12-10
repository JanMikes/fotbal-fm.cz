'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '@/types/user';
import * as Sentry from "@sentry/nextjs";

interface UserContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      setLoading(true);
      console.log('[UserContext] Fetching user...');

      // Always try to fetch user data - the API will handle authentication
      const response = await fetch('/api/auth/me');

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          console.log('[UserContext] User fetched:', { id: data.user.id, firstName: data.user.firstName });
          setUser(data.user);
        } else {
          console.log('[UserContext] No user in response');
          setUser(null);
        }
      } else {
        console.log('[UserContext] Response not OK:', response.status);
        setUser(null);
      }
    } catch (error) {
      console.error('[UserContext] Error fetching user:', error);
      Sentry.captureException(error, {
        tags: { component: 'UserContext', phase: 'fetchUser' },
      });
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      // Even if logout API fails, clear local state
      setUser(null);
      window.location.href = '/';
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, logout, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
