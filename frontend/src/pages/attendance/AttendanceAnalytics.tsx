import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Select, Progress, Spin, Typography, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined, 
  HomeOutlined, 
  LineChartOutlined,
  CalendarOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import api from '../../services/api';
import { AttendanceAnalytics as AnalyticsType } from '../../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;

export const AttendanceAnalytics: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);

  // 1. Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments
  });

  // 2. Fetch analytics
  const { data: analytics, isLoading } = useQuery<AnalyticsType>({
    queryKey: ['attendanceAnalytics', selectedDept],
    queryFn: () => api.getAttendanceAnalytics({ departmentId: selectedDept })
  });

  if (isLoading || !analytics) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Format daily stats for Recharts
  const chartData = analytics.dailyStats.map(stat => ({
    name: dayjs(stat.date).format('MMM DD'),
    Present: stat.present,
    Absent: stat.absent,
    Late: stat.late,
    WFH: stat.wfh
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* FILTER PANEL */}
      <Card 
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
      >
        <Space size={16}>
          <LineChartOutlined style={{ color: '#10B981', fontSize: 18 }} />
          <Text strong style={{ color: '#475569' }}>Analytics Filter</Text>
          <Select
            placeholder="Global System Analytics"
            style={{ width: 250 }}
            allowClear
            value={selectedDept}
            onChange={(val) => setSelectedDept(val)}
          >
            {departments?.map((dept: any) => (
              <Option key={dept.id} value={dept.id}>{dept.name} Division</Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* STATISTIC METRICS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card 
            bordered={false} 
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.02)' }}
            className="stat-card"
          >
            <Statistic
              title={<span style={{ color: '#64748B', fontWeight: 500 }}>Active Checked-In Today</span>}
              value={analytics.presentToday}
              precision={0}
              valueStyle={{ color: '#10B981', fontWeight: 700, fontSize: 32 }}
              prefix={<CheckCircleOutlined style={{ color: '#10B981', marginRight: 8 }} />}
            />
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>
              On-site shift active headcount
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            bordered={false} 
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.02)' }}
            className="stat-card"
          >
            <Statistic
              title={<span style={{ color: '#64748B', fontWeight: 500 }}>Unexcused Absences Today</span>}
              value={analytics.absentToday}
              precision={0}
              valueStyle={{ color: '#EF4444', fontWeight: 700, fontSize: 32 }}
              prefix={<CloseCircleOutlined style={{ color: '#EF4444', marginRight: 8 }} />}
            />
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>
              Active employees without logs
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            bordered={false} 
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.02)' }}
            className="stat-card"
          >
            <Statistic
              title={<span style={{ color: '#64748B', fontWeight: 500 }}>Late Arrivals (Today)</span>}
              value={analytics.lateArrivals}
              precision={0}
              valueStyle={{ color: '#F59E0B', fontWeight: 700, fontSize: 32 }}
              prefix={<ClockCircleOutlined style={{ color: '#F59E0B', marginRight: 8 }} />}
            />
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>
              Swiped in after 09:30 AM
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card 
            bordered={false} 
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.02)' }}
            className="stat-card"
          >
            <Statistic
              title={<span style={{ color: '#64748B', fontWeight: 500 }}>Work From Home Today</span>}
              value={analytics.wfhCount}
              precision={0}
              valueStyle={{ color: '#3B82F6', fontWeight: 700, fontSize: 32 }}
              prefix={<HomeOutlined style={{ color: '#3B82F6', marginRight: 8 }} />}
            />
            <div style={{ marginTop: 8, color: '#64748B', fontSize: 12 }}>
              Remote workers logged today
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* CHART VELOCITY */}
        <Col xs={24} lg={17}>
          <Card 
            bordered={false} 
            title={<span style={{ fontWeight: 600 }}><DashboardOutlined /> 15-Day Attendance Velocity Trends</span>}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
          >
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorWFH" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area type="monotone" dataKey="Present" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorPresent)" />
                  <Area type="monotone" dataKey="Late" stroke="#F59E0B" strokeWidth={2} fill="url(#colorLate)" fillOpacity={0.1} />
                  <Area type="monotone" dataKey="WFH" stroke="#3B82F6" strokeWidth={2} fill="url(#colorWFH)" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>

        {/* PROGRESS METRICS CARD */}
        <Col xs={24} lg={7}>
          <Card 
            bordered={false} 
            title={<span style={{ fontWeight: 600 }}><CalendarOutlined /> Monthly Attendance Target</span>}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF', height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0 12px' }}>
              <Progress
                type="dashboard"
                percent={analytics.monthlyPercentage}
                strokeColor={{
                  '0%': '#10B981',
                  '100%': '#059669',
                }}
                strokeWidth={8}
                width={160}
              />
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <Text style={{ display: 'block', fontSize: 13, color: '#64748B' }}>
                  Average Attendance Rate (Monthly)
                </Text>
                <Title level={4} style={{ margin: '4px 0 0', color: '#0F172A', fontWeight: 600 }}>
                  {analytics.monthlyPercentage}% Attendance
                </Title>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 12, background: '#F8FAFC', padding: '8px 12px', borderRadius: 8 }}>
                  Target: 95% minimum corporate standard.
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
