import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';

// Pages
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';
import { Dashboard } from './pages/Dashboard';
import { EmployeeList } from './pages/EmployeeList';
import { EmployeeProfile } from './pages/EmployeeProfile';
import { EmployeeWizard } from './pages/EmployeeWizard';
import { Departments } from './pages/Departments';
import { Skills } from './pages/Skills';
import { Documents } from './pages/Documents';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Protected Route Shielding Helper
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#FFFFFF' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

// Anonymous Route (Redirect to home if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#FFFFFF' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <AuthLayout>{children}</AuthLayout>;
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          colorPrimary: '#0070F3', // Accent Vercel blue
          colorSuccess: '#16A34A', // Success green
          colorWarning: '#D97706', // Warning gold
          colorError: '#DC2626',   // Danger red
          colorTextBase: '#000000', // Primary black text
          colorBgBase: '#FFFFFF',   // Clean background
          colorBorder: '#EAEAEA',   // Clean card borders
          borderRadius: 6,          // Minimal border corners
          wireframe: false
        },
        components: {
          Table: {
            headerBg: '#F8FAFC',
            headerColor: '#666666'
          }
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Auth Pathways */}
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/setup" element={<PublicRoute><Setup /></PublicRoute>} />

              {/* Protected System Pathways */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute><EmployeeList /></ProtectedRoute>} />
              <Route path="/employees/new" element={<ProtectedRoute><EmployeeWizard /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
              <Route path="/employees/:id/edit" element={<ProtectedRoute><EmployeeWizard /></ProtectedRoute>} />
              <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
              <Route path="/skills" element={<ProtectedRoute><Skills /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* Catch-all Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
};
export default App;
