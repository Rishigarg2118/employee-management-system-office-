import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
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
import { ProjectWorkspace } from './pages/projects/ProjectWorkspace';
import { ProjectDetails } from './pages/projects/ProjectDetails';
import { TeamWorkspace } from './pages/teams/TeamWorkspace';
import { ReportsCenter } from './pages/reports/ReportsCenter';
import { AuditLogs } from './pages/audit/AuditLogs';
import { AssetWorkspace } from './pages/assets/AssetWorkspace';

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

const AppContent: React.FC = () => {
  const { theme } = useTheme();
  const isClassic = theme === 'classic';

  return (
    <ConfigProvider
      theme={{
        token: {
          fontFamily: isClassic
            ? "'DM Sans', 'Syne', sans-serif"
            : "'Plus Jakarta Sans', 'Outfit', sans-serif",
          colorPrimary: isClassic ? '#2563eb' : '#ea580c', // Classic Indigo vs Modern Warm Orange
          colorSuccess: isClassic ? '#10b981' : '#059669',
          colorWarning: isClassic ? '#f59e0b' : '#d97706',
          colorError: isClassic ? '#ef4444' : '#dc2626',
          colorTextBase: isClassic ? '#1e293b' : '#0f172a',
          colorBgBase: isClassic ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
          colorBorder: isClassic ? '#e2e8f0' : 'rgba(0, 0, 0, 0.08)',
          borderRadius: isClassic ? 8 : 12,
          wireframe: false
        },
        components: {
          Table: {
            headerBg: isClassic ? '#f8fafc' : 'rgba(240, 235, 225, 0.8)',
            headerColor: isClassic ? '#1e293b' : '#0f172a',
            rowHoverBg: isClassic ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
            cellPaddingBlock: 14,
            cellPaddingInline: 16
          },
          Card: {
            headerBg: 'transparent',
            colorBorderSecondary: isClassic ? '#e2e8f0' : 'rgba(0, 0, 0, 0.08)'
          },
          Button: {
            borderRadius: isClassic ? 8 : 12,
            controlHeight: 38
          },
          Menu: {
            darkItemBg: 'transparent',
            darkItemColor: '#94A3B8',
            darkItemSelectedBg: 'rgba(234, 88, 12, 0.15)',
            darkItemSelectedColor: '#ea580c',
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
              <Route path="/employees" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}><EmployeeList /></ProtectedRoute>} />
              <Route path="/employees/new" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}><EmployeeWizard /></ProtectedRoute>} />
              <Route path="/employees/:id" element={<ProtectedRoute><EmployeeProfile /></ProtectedRoute>} />
              <Route path="/employees/:id/edit" element={<ProtectedRoute><EmployeeWizard /></ProtectedRoute>} />
              <Route path="/departments" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><Departments /></ProtectedRoute>} />
              <Route path="/skills" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}><Skills /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}><Documents /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><Settings /></ProtectedRoute>} />
              <Route path="/leaves" element={<ProtectedRoute><LeavesWorkspace /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute><AttendanceWorkspace /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'Manager', 'Employee', 'Intern']}><TaskWorkspace /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'Manager', 'Employee']}><ProjectWorkspace /></ProtectedRoute>} />
              <Route path="/projects/:id" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'Manager', 'Employee']}><ProjectDetails /></ProtectedRoute>} />
              <Route path="/teams" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR', 'Manager']}><TeamWorkspace /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin', 'HR']}><ReportsCenter /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['Super Admin', 'Admin']}><AuditLogs /></ProtectedRoute>} />
              <Route path="/assets" element={<ProtectedRoute><AssetWorkspace /></ProtectedRoute>} />
              {/* Catch-all Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App;
