import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Employee } from '../types';
import { api, resetAuthSession } from '../services/api';

interface AuthContextType {
  user: Employee | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Employee) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStoredAuth() {
      const storedToken = localStorage.getItem('hrms_token');
      const storedUser = localStorage.getItem('hrms_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        try {
          // Verify token and fetch fresh user profile info
          const freshUser = await api.getMe();
          setUser(freshUser);
          localStorage.setItem('hrms_user', JSON.stringify(freshUser));
        } catch (err) {
          console.error('[AuthContext] Session validation failed. Wiping tokens.', err);
          logout();
        }
      }
      setIsLoading(false);
    }
    loadStoredAuth();
  }, []);

  const login = async (credentials: any) => {
    setIsLoading(true);
    try {
      resetAuthSession();
      const data = await api.login(credentials);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('hrms_token', data.token);
      localStorage.setItem('hrms_refresh_token', data.refreshToken);
      localStorage.setItem('hrms_user', JSON.stringify(data.user));
    } catch (err) {
      logout();
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setIsLoading(true);
    try {
      resetAuthSession();
      const data = await api.googleLogin(idToken);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('hrms_token', data.token);
      localStorage.setItem('hrms_refresh_token', data.refreshToken);
      localStorage.setItem('hrms_user', JSON.stringify(data.user));
    } catch (err) {
      logout();
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    resetAuthSession();
    const refreshToken = localStorage.getItem('hrms_refresh_token');
    if (refreshToken) {
      api.logout({ refreshToken }).catch((err) => {
        console.error('Logout error:', err);
      });
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('hrms_token');
    localStorage.removeItem('hrms_refresh_token');
    localStorage.removeItem('hrms_user');
  };

  const updateUser = (updatedUser: Employee) => {
    setUser(updatedUser);
    localStorage.setItem('hrms_user', JSON.stringify(updatedUser));
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, loginWithGoogle, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
