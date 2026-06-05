import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tabs } from 'antd';
import { 
  DashboardOutlined, 
  FormOutlined, 
  UnorderedListOutlined, 
  CalendarOutlined, 
  FileDoneOutlined 
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { LeaveDashboard } from './LeaveDashboard';
import { LeaveApply } from './LeaveApply';
import { LeaveList } from './LeaveList';
import { LeaveCalendar } from './LeaveCalendar';
import { LeaveReports } from './LeaveReports';

export const LeavesWorkspace: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract active tab from URL query params (e.g. ?tab=apply)
  const searchParams = new URLSearchParams(location.search);
  const queryTab = searchParams.get('tab') || 'dashboard';
  
  const [activeKey, setActiveKey] = useState<string>(queryTab);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab') || 'dashboard';
    setActiveKey(tab);
  }, [location.search]);

  const handleTabChange = (key: string) => {
    setActiveKey(key);
    navigate(`/leaves?tab=${key}`);
  };

  const isEmployeeOrIntern = user?.role === 'Employee' || user?.role === 'Intern';

  // Build tabs items based on Role-Based Access Control
  const tabItems = [
    {
      key: 'dashboard',
      label: (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          <DashboardOutlined style={{ marginRight: 6 }} />
          Command Center
        </span>
      ),
      children: <LeaveDashboard />
    },
    {
      key: 'apply',
      label: (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          <FormOutlined style={{ marginRight: 6 }} />
          Apply Leave
        </span>
      ),
      children: <LeaveApply />
    },
    {
      key: 'registry',
      label: (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          <UnorderedListOutlined style={{ marginRight: 6 }} />
          Leave Registry
        </span>
      ),
      children: <LeaveList />
    },
    {
      key: 'calendar',
      label: (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          <CalendarOutlined style={{ marginRight: 6 }} />
          Leave Calendar
        </span>
      ),
      children: <LeaveCalendar />
    },
    ...(!isEmployeeOrIntern ? [{
      key: 'reports',
      label: (
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          <FileDoneOutlined style={{ marginRight: 6 }} />
          Reports Center
        </span>
      ),
      children: <LeaveReports />
    }] : [])
  ];

  return (
    <div style={{ minHeight: '100%' }}>
      {/* HEADER SECTION */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">
          Leave Management System
        </h1>
        <p className="body-text" style={{ margin: '4px 0 0 0' }}>
          Manage leave requests, review employee balance allocations, visualize team calendar schedules, and track approval workflows.
        </p>
      </div>

      {/* CORE WORKSPACE TABS */}
      <Tabs 
        activeKey={activeKey} 
        onChange={handleTabChange}
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}
        style={{ fontFamily: 'Inter' }}
        destroyInactiveTabPane={false}
      />
    </div>
  );
};
export default LeavesWorkspace;
