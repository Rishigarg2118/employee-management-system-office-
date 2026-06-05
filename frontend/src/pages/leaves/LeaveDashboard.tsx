import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Spin, Avatar, Empty, List } from 'antd';
import { 
  FileDoneOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  UserOutlined, 
  CalendarOutlined,
  RiseOutlined
} from '@ant-design/icons';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip 
} from 'recharts';
import api from '../../services/api';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export const LeaveDashboard: React.FC = () => {
  // Query analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['leaveAnalytics'],
    queryFn: () => api.getLeaveAnalytics()
  });

  // Query all requests to find who is currently on leave (FTE active roster)
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['allRequestsForDashboard'],
    queryFn: () => api.getLeaveRequests()
  });

  if (analyticsLoading || requestsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="Loading Executive Command Center..." />
      </div>
    );
  }

  const summary = analytics?.summary || { total: 0, pending: 0, approved: 0, rejected: 0, on_leave_today: 0 };
  const monthlyTrends = analytics?.monthlyTrends || [];
  const deptLeaves = analytics?.deptLeaves || [];
  const typeDistribution = analytics?.typeDistribution || [];
  const utilization = analytics?.utilization || [];

  // Filter requests that are active today
  const todayStr = new Date().toISOString().split('T')[0];
  const currentlyOnLeave = (requests || []).filter(r => {
    if (r.status !== 'Approved') return false;
    const start = r.start_date.split('T')[0];
    const end = r.end_date.split('T')[0];
    return todayStr >= start && todayStr <= end;
  });

  return (
    <div>
      <Row gutter={[24, 24]}>
        {/* KPI COUNTERS */}
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Leave Requests</span>}
              value={summary.total}
              prefix={<FileDoneOutlined style={{ color: '#10B981', marginRight: 8 }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Approvals</span>}
              value={summary.pending}
              prefix={<ClockCircleOutlined style={{ color: '#F59E0B', marginRight: 8 }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#F59E0B' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Approved Leaves</span>}
              value={summary.approved}
              prefix={<CheckCircleOutlined style={{ color: '#22C55E', marginRight: 8 }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#22C55E' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false}>
            <Statistic
              title={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Employees Out Today</span>}
              value={currentlyOnLeave.length}
              prefix={<UserOutlined style={{ color: '#8B5CF6', marginRight: 8 }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#8B5CF6' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ACTIVE EMPLOYEES ROSTER & SUMMARY */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <Card 
            title={<span style={{ fontWeight: 600, fontSize: 15 }}>Monthly Leave Trends</span>}
            bordered={false}
          >
            <div style={{ width: '100%', height: 300 }}>
              {monthlyTrends.length > 0 ? (
                <ResponsiveContainer>
                  <AreaChart data={monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorApp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
                    <YAxis stroke="var(--text-secondary)" style={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Area type="monotone" dataKey="Requested" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorReq)" />
                    <Area type="monotone" dataKey="Approved" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorApp)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No request trends logged yet." style={{ padding: '40px 0' }} />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card 
            title={<span style={{ fontWeight: 600, fontSize: 15 }}>Currently On Leave</span>}
            bordered={false} 
            style={{ height: '100%' }}
          >
            {currentlyOnLeave.length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={currentlyOnLeave}
                renderItem={(item) => {
                  const avatarLetter = item.employee?.first_name ? item.employee.first_name.charAt(0) : 'E';
                  return (
                    <List.Item style={{ padding: '12px 0' }}>
                      <List.Item.Meta
                        avatar={
                          <Avatar size={40} style={{ backgroundColor: '#10B981', color: '#FFFFFF', fontWeight: 600 }}>
                            {avatarLetter}
                          </Avatar>
                        }
                        title={
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {item.employee?.first_name} {item.employee?.last_name}
                          </span>
                        }
                        description={
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            <div>{item.employee?.designation}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              <CalendarOutlined style={{ marginRight: 4 }} />
                              {item.start_date.split('T')[0]} to {item.end_date.split('T')[0]} ({item.total_days} days)
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 260 }}>
                <Empty description="All employees are active at work today." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* DETAILED PIE AND BAR CHARTS FOR LEAVE CATEGORIES */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} md={12} lg={8}>
          <Card 
            title={<span style={{ fontWeight: 600, fontSize: 15 }}>Leave Type Distribution</span>}
            bordered={false}
          >
            <div style={{ width: '100%', height: 260, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {typeDistribution.length > 0 ? (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {typeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No leave applications logged." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={12} lg={8}>
          <Card 
            title={<span style={{ fontWeight: 600, fontSize: 15 }}>Department Requests</span>}
            bordered={false}
          >
            <div style={{ width: '100%', height: 260 }}>
              {deptLeaves.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={deptLeaves} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" style={{ fontSize: 10 }} />
                    <YAxis stroke="var(--text-secondary)" style={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No department requests logged." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={24} lg={8}>
          <Card 
            title={<span style={{ fontWeight: 600, fontSize: 15 }}>Departmental Utilization %</span>}
            bordered={false}
          >
            <div style={{ width: '100%', height: 260 }}>
              {utilization.length > 0 ? (
                <ResponsiveContainer>
                  <BarChart data={utilization} layout="vertical" margin={{ top: 10, right: 10, left: -5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-secondary)" style={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                    <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" style={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Utilization']} />
                    <Bar dataKey="value" fill="#22C55E" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No balance utilization data." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
