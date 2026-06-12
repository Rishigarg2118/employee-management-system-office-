import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Avatar, Table, Spin, Space, Empty } from 'antd';
import { 
  UserOutlined, 
  AppstoreOutlined, 
  BulbOutlined, 
  SafetyCertificateOutlined,
  ArrowRightOutlined,
  DesktopOutlined
} from '@ant-design/icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { api, SERVER_URL } from '../services/api';
import { StatCard } from '../components/StatCard';
import { DashboardStats, DepartmentDistributionItem, GrowthTrendItem, Employee } from '../types';

const COLORS = ['#10B981', '#64748B', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#6366F1'];

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deptData, setDeptData] = useState<DepartmentDistributionItem[]>([]);
  const [growthData, setGrowthData] = useState<GrowthTrendItem[]>([]);
  const [recentEmployees, setRecentEmployees] = useState<Employee[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [statsRes, deptRes, growthRes, empRes, actRes] = await Promise.all([
          api.getDashboardStats(),
          api.getDepartmentDistribution(),
          api.getEmployeeGrowth(),
          api.getEmployees({ limit: 5 }),
          api.getRecentActivities()
        ]);
        
        setStats(statsRes);
        setDeptData(deptRes);
        setGrowthData(growthRes);
        setRecentEmployees(empRes.data);
        setActivities(actRes);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Table columns for Recent Employees
  const employeeColumns = [
    {
      title: 'Employee',
      key: 'name',
      render: (_: any, record: Employee) => {
        const fullName = `${record.first_name} ${record.last_name}`;
        return (
          <Space size={10}>
            <Avatar 
              src={record.avatar_url ? `${SERVER_URL}/${record.avatar_url}` : undefined} 
              icon={<UserOutlined />} 
              style={{ backgroundColor: 'var(--hover-color)', color: 'var(--text-secondary)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link to={`/employees/${record.id}`} style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {fullName}
              </Link>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.email}</span>
            </div>
          </Space>
        );
      }
    },
    {
      title: 'Department',
      dataIndex: ['department', 'name'],
      key: 'department',
      render: (text: string) => text || '—'
    },
    {
      title: 'Joining Date',
      dataIndex: 'joining_date',
      key: 'joining_date',
      render: (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* HEADER SECTION */}
      <div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 700, 
          letterSpacing: '-0.04em', 
          color: '#0F172A',
          marginBottom: '4px'
        }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Overview of workforce metrics, hiring velocities, and recent activities.
        </p>
      </div>

      {/* METRICS GRID */}
      {stats && (
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Total Employees"
              value={stats.summary.total_employees.value}
              icon={<UserOutlined />}
              trend={stats.summary.total_employees.trend}
              percentage={stats.summary.total_employees.percentage}
              label={stats.summary.total_employees.label}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Active Headcount"
              value={stats.summary.active_employees.value}
              icon={<SafetyCertificateOutlined />}
              trend={stats.summary.active_employees.trend}
              percentage={stats.summary.active_employees.percentage}
              label={stats.summary.active_employees.label}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Departments"
              value={stats.summary.departments.value}
              icon={<AppstoreOutlined />}
              trend={stats.summary.departments.trend}
              percentage={stats.summary.departments.percentage}
              label={stats.summary.departments.label}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Core Skillset"
              value={stats.summary.skills.value}
              icon={<BulbOutlined />}
              trend={stats.summary.skills.trend}
              percentage={stats.summary.skills.percentage}
              label={stats.summary.skills.label}
            />
          </Col>
          {stats.summary.total_assets && (
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Total Assets"
                value={stats.summary.total_assets.value}
                icon={<DesktopOutlined />}
                trend={stats.summary.total_assets.trend}
                percentage={stats.summary.total_assets.percentage}
                label={stats.summary.total_assets.label}
              />
            </Col>
          )}
          {stats.summary.assigned_assets && (
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Assigned Assets"
                value={stats.summary.assigned_assets.value}
                icon={<DesktopOutlined />}
                trend={stats.summary.assigned_assets.trend}
                percentage={stats.summary.assigned_assets.percentage}
                label={stats.summary.assigned_assets.label}
              />
            </Col>
          )}
          {stats.summary.available_assets && (
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Available Assets"
                value={stats.summary.available_assets.value}
                icon={<DesktopOutlined />}
                trend={stats.summary.available_assets.trend}
                percentage={stats.summary.available_assets.percentage}
                label={stats.summary.available_assets.label}
              />
            </Col>
          )}
        </Row>
      )}

      {/* ANALYTICS CHARTS SECTION */}
      <Row gutter={[24, 24]}>
        {/* Growth area chart */}
        <Col xs={24} lg={16}>
          <Card title="Employee Growth Analytics" extra={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Hiring Trajectory</span>}>
            <div style={{ width: '100%', height: 320 }}>
              {growthData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={growthData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorEmployees" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-color)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="var(--accent-color)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} 
                    />
                    <Tooltip 
                      contentStyle={{
                        background: '#FFFFFF',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Employees" 
                      stroke="var(--accent-color)" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorEmployees)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Active" 
                      stroke="#22C55E" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorActive)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty description="No growth data available" style={{ paddingTop: 60 }} />
              )}
            </div>
          </Card>
        </Col>

        {/* Department donut chart */}
        <Col xs={24} lg={8}>
          <Card title="Department Distribution" extra={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>FTE Allocation</span>}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320 }}>
              {deptData.some(d => d.value > 0) ? (
                <>
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deptData.filter(d => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {deptData.filter(d => d.value > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: '#FFFFFF',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            boxShadow: 'none',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Custom Legend */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    justifyContent: 'center', 
                    gap: '12px',
                    width: '100%',
                    padding: '10px 0',
                    maxHeight: '100px',
                    overflowY: 'auto'
                  }}>
                    {deptData.filter(d => d.value > 0).map((entry, index) => (
                      <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                        <span style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          background: COLORS[index % COLORS.length] 
                        }} />
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{entry.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <Empty description="No department allocation data" />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* RECENT LISTS SECTION */}
      <Row gutter={[24, 24]}>
        {/* Recent Employees Table */}
        <Col xs={24} xl={14}>
          <Card 
            title="Recent Employee Additions" 
            extra={
              <Link to="/employees" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                View Directory <ArrowRightOutlined />
              </Link>
            }
          >
            <div className="responsive-table-container">
              <Table
                dataSource={recentEmployees}
                columns={employeeColumns}
                rowKey="id"
                pagination={false}
                size="middle"
                locale={{ emptyText: <Empty description="No recent employees registered" /> }}
              />
            </div>
          </Card>
        </Col>

        {/* Recent Activity Timeline Feed */}
        <Col xs={24} xl={10}>
          <Card title="Recent HR Audit Logs">
            <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
              {activities.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {activities.map((act) => {
                    const timeString = new Date(act.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    const dateString = new Date(act.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    });
                    
                    return (
                      <div key={act.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <Avatar 
                          src={act.employee_avatar ? `${SERVER_URL}/${act.employee_avatar}` : undefined} 
                          icon={<UserOutlined />}
                          size="small"
                          style={{ backgroundColor: 'var(--hover-color)', color: 'var(--text-secondary)', marginTop: '2px' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, fontSize: '13px' }}>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 400 }}>
                            {act.description}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {dateString} at {timeString}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Empty description="No recent operations logged" />
              )}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
