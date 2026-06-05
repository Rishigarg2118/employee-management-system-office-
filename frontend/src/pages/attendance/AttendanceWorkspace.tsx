import React from 'react';
import { Tabs, Card, Typography } from 'antd';
import { ClockCircleOutlined, HistoryOutlined, TeamOutlined, LineChartOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { PunchBoard } from './PunchBoard';
import { AttendanceLogs } from './AttendanceLogs';
import { ManagerCorrections } from './ManagerCorrections';
import { AttendanceAnalytics } from './AttendanceAnalytics';
import { AttendanceReports } from './AttendanceReports';

const { Title, Paragraph } = Typography;

export const AttendanceWorkspace: React.FC = () => {
  const { user } = useAuth();
  
  const isManagement = user && ['Super Admin', 'Admin', 'HR', 'Manager'].includes(user.role);

  const tabItems = [
    {
      key: 'punch',
      label: (
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          <ClockCircleOutlined /> Punch Board
        </span>
      ),
      children: <PunchBoard />
    },
    {
      key: 'logs',
      label: (
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          <HistoryOutlined /> Attendance Logs
        </span>
      ),
      children: <AttendanceLogs />
    }
  ];

  if (isManagement) {
    tabItems.push(
      {
        key: 'corrections',
        label: (
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            <TeamOutlined /> Correction Board
          </span>
        ),
        children: <ManagerCorrections />
      },
      {
        key: 'analytics',
        label: (
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            <LineChartOutlined /> Analytics
          </span>
        ),
        children: <AttendanceAnalytics />
      },
      {
        key: 'reports',
        label: (
          <span style={{ fontSize: 14, fontWeight: 500 }}>
            <FileExcelOutlined /> Reports Exporter
          </span>
        ),
        children: <AttendanceReports />
      }
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* HEADER SECTION */}
      <div>
        <Title level={2} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.03em', color: '#0F172A' }}>
          Workforce Attendance Center
        </Title>
        <Paragraph style={{ color: '#64748B', margin: '4px 0 0', fontSize: 14 }}>
          Clock shift logs, query historical records, execute adjustments, and export ledger reports.
        </Paragraph>
      </div>

      {/* WORKSPACE CONTENT */}
      <Tabs
        defaultActiveKey="punch"
        items={tabItems}
        size="large"
        style={{ width: '100%' }}
        className="custom-tabs"
      />
    </div>
  );
};
export default AttendanceWorkspace;
