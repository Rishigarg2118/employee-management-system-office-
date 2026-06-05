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
import { LeavesWorkspace } from './pages/leaves/LeavesWorkspace';
import { AttendanceWorkspace } from './pages/attendance/AttendanceWorkspace';
import { TaskWorkspace } from './pages/tasks/TaskWorkspace';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

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

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
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
          colorPrimary: '#10B981', // Emerald accent
          colorSuccess: '#22C55E', // Success green
          colorWarning: '#F59E0B', // Warning gold
          colorError: '#EF4444',   // Danger red
          colorTextBase: '#0F172A', // Primary Slate-900 text
          colorBgBase: '#FFFFFF',   // Card background
          colorBorder: '#E2E8F0',   // Border slate-200
          borderRadius: 12,         // Modern larger border radius
          wireframe: false
        },
        components: {
          Table: {
            headerBg: '#F8FAFC',
            headerColor: '#64748B',
            rowHoverBg: '#F8FAFC',
            cellPaddingBlock: 14,
            cellPaddingInline: 16
          },
          Card: {
            headerBg: '#FFFFFF',
            colorBorderSecondary: '#E2E8F0'
          },
          Button: {
            borderRadius: 8,
            controlHeight: 38
          },
          Menu: {
            darkItemBg: '#0F172A',
            darkItemColor: '#94A3B8',
            darkItemSelectedBg: 'rgba(16, 185, 129, 0.15)',
            darkItemSelectedColor: '#10B981',
            darkItemHoverBg: 'rgba(255, 255, 255, 0.05)',
            darkItemHoverColor: '#FFFFFF'
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
              <Route path="/employees/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'Manager']}><EmployeeWizard /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
              <Route path="/employees/:id/edit" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'Manager']}><EmployeeWizard /></ProtectedRoute>} />
              <Route path="/departments" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><Departments /></ProtectedRoute>} />
              <Route path="/skills" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}><Skills /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}><Documents /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><Settings /></ProtectedRoute>} />
              <Route path="/leaves" element={<ProtectedRoute><LeavesWorkspace /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><AttendanceWorkspace /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'Manager', 'Employee']}><TaskWorkspace /></ProtectedRoute>} />

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
