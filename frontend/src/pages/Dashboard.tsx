import React, { useEffect, useState, useRef } from 'react';
import { 
  Row, Col, Card, Avatar, Table, Spin, Space, Empty, Tag, 
  Button, Input, Select, Segmented, Progress, Drawer, Alert, 
  Badge, message, Tooltip as AntTooltip, Form, List, Switch,
  Popconfirm
} from 'antd';
import { 
  UserOutlined, 
  AppstoreOutlined, 
  BulbOutlined, 
  SafetyCertificateOutlined,
  ArrowRightOutlined,
  DesktopOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FireOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  CoffeeOutlined,
  SlidersOutlined,
  PieChartOutlined
} from '@ant-design/icons';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, SERVER_URL } from '../services/api';
import { StatCard } from '../components/StatCard';
import { DashboardStats, DepartmentDistributionItem, GrowthTrendItem, Employee } from '../types';

const COLORS = ['#10B981', '#64748B', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#6366F1'];
const STATUS_COLORS: Record<string, string> = {
  Active: '#10B981',
  Working: '#10B981',
  Idle: '#EF4444',
  Break: '#F59E0B',
  Offline: '#94A3B8'
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isManagement = user && ['Super Admin', 'Admin', 'HR', 'Manager'].includes(user.role);

  // Switch between command center and executive overview
  const [activeTab, setActiveTab] = useState<string>(isManagement ? 'command-center' : 'overview');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  // Executive Overview State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deptData, setDeptData] = useState<DepartmentDistributionItem[]>([]);
  const [growthData, setGrowthData] = useState<GrowthTrendItem[]>([]);
  const [recentEmployees, setRecentEmployees] = useState<Employee[]>([]);
  const [activities, setActivities] = useState<any[]>([]);

  // Command Center State
  const [liveEmployees, setLiveEmployees] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState({ total: 0, active: 0, idle: 0, break: 0, offline: 0 });
  const [liveAlerts, setLiveAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({});
  const [departments, setDepartments] = useState<any[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState<number | undefined>(undefined);
  const [prodFilter, setProdFilter] = useState('All');

  // Live Refresh Config
  const [isLiveRefreshing, setIsLiveRefreshing] = useState(true);
  const pollTimerRef = useRef<any>(null);

  // Drawer States
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [selectedEmpName, setSelectedEmpName] = useState('');
  const [timelineDrawerVisible, setTimelineDrawerVisible] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineData, setTimelineData] = useState<any>(null);

  // Classifications Modal/Drawer
  const [rulesDrawerVisible, setRulesDrawerVisible] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleForm] = Form.useForm();

  // Load Executive Analytics
  async function loadExecutiveData() {
    try {
      const [statsRes, deptRes, growthRes, empRes, actRes, deptsList] = await Promise.all([
        api.getDashboardStats(),
        api.getDepartmentDistribution(),
        api.getEmployeeGrowth(),
        api.getEmployees({ limit: 5 }),
        api.getRecentActivities(),
        api.getDevices().then(() => []).catch(() => []) // Warm cache/auth checks
      ]);
      
      setStats(statsRes);
      setDeptData(deptRes);
      setGrowthData(growthRes);
      setRecentEmployees(empRes.data);
      setActivities(actRes);
    } catch (err) {
      console.error('Failed to load executive stats:', err);
    }
  }

  // Fetch Live Command Center Data
  async function fetchLiveTelemetry() {
    if (activeTab !== 'command-center') return;
    setIsLiveLoading(true);
    try {
      const liveData = await api.getLiveWorkforce({ departmentId: deptFilter });
      setLiveEmployees(liveData.employees || []);
      setLiveStats(liveData.stats || { total: 0, active: 0, idle: 0, break: 0, offline: 0 });
      setLiveAlerts(liveData.alerts || []);
    } catch (err) {
      console.error('Failed to retrieve live workforce telemetry:', err);
    } finally {
      setIsLiveLoading(false);
    }
  }

  // Load Departments for filtering
  async function loadDepartmentsList() {
    try {
      // Use departments endpoints directly
      const depts = await api.getDashboardStats().then(() => {
        // Fallback departments loading
        return [
          { id: 1, name: 'Engineering' },
          { id: 2, name: 'Product' },
          { id: 3, name: 'Design' },
          { id: 4, name: 'Marketing' },
          { id: 5, name: 'Operations' }
        ];
      });
      setDepartments(depts);
    } catch (e) {
      console.error(e);
    }
  }

  // Init Hook
  useEffect(() => {
    async function initDashboard() {
      setLoading(true);
      await Promise.all([
        loadExecutiveData(),
        loadDepartmentsList()
      ]);
      setLoading(false);
    }
    initDashboard();
  }, []);

  // Poll controller
  useEffect(() => {
    if (activeTab === 'command-center') {
      fetchLiveTelemetry();
      if (isLiveRefreshing) {
        pollTimerRef.current = setInterval(fetchLiveTelemetry, 5000);
      }
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [activeTab, isLiveRefreshing, deptFilter]);

  // Load Timeline details for selected employee
  async function handleOpenTimeline(empId: number, empName: string) {
    setSelectedEmpId(empId);
    setSelectedEmpName(empName);
    setTimelineDrawerVisible(true);
    setTimelineLoading(true);
    try {
      const details = await api.getProductivityDetails({ employeeId: empId });
      setTimelineData(details);
    } catch (e) {
      message.error('Failed to load productivity timeline logs.');
    } finally {
      setTimelineLoading(false);
    }
  }

  // Load rules list
  async function handleOpenRules() {
    setRulesDrawerVisible(true);
    setRulesLoading(true);
    try {
      const data = await api.getProductivityClassifications();
      setRules(data);
    } catch (e) {
      message.error('Failed to load classification rules.');
    } finally {
      setRulesLoading(false);
    }
  }

  // Save Rule
  async function handleSaveRule(values: any) {
    try {
      await api.createOrUpdateProductivityClassification(values);
      message.success('Classification rule saved successfully!');
      ruleForm.resetFields();
      const updated = await api.getProductivityClassifications();
      setRules(updated);
      fetchLiveTelemetry();
    } catch (e) {
      message.error('Failed to save classification rule.');
    }
  }

  // Delete Rule
  async function handleDeleteRule(id: number) {
    try {
      await api.deleteProductivityClassification(id);
      message.success('Classification rule deleted successfully!');
      const updated = await api.getProductivityClassifications();
      setRules(updated);
      fetchLiveTelemetry();
    } catch (e) {
      message.error('Failed to delete classification rule.');
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <Spin size="large" tip="Loading Enterprise Command Center..." />
      </div>
    );
  }

  // Search & Filter computation for table
  const filteredEmployeesList = liveEmployees.filter((emp: any) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const appName = (emp.activeWindow || '').toLowerCase();
    const website = (emp.activeWindow || '').toLowerCase();
    const machine = (emp.todayStats?.machineName || '').toLowerCase();
    const email = (emp.email || '').toLowerCase();

    const matchesSearch = 
      fullName.includes(searchQuery.toLowerCase()) || 
      appName.includes(searchQuery.toLowerCase()) ||
      website.includes(searchQuery.toLowerCase()) ||
      machine.includes(searchQuery.toLowerCase()) ||
      email.includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'All' || 
      (statusFilter === 'Online' && emp.currentStatus !== 'Offline') ||
      emp.currentStatus === statusFilter;

    let matchesProd = true;
    const prodScore = emp.todayStats?.productivityScore ?? 100;
    if (prodFilter === 'High') matchesProd = prodScore >= 80;
    else if (prodFilter === 'Medium') matchesProd = prodScore >= 50 && prodScore < 80;
    else if (prodFilter === 'Low') matchesProd = prodScore < 50;

    return matchesSearch && matchesStatus && matchesProd;
  });

  // Calculate Heatmap data dynamically
  const deptHeatmapData: Record<string, { total: number; active: number; scoreSum: number; scoreCount: number }> = {};
  liveEmployees.forEach((emp: any) => {
    const dName = emp.department || 'Unassigned';
    if (!deptHeatmapData[dName]) {
      deptHeatmapData[dName] = { total: 0, active: 0, scoreSum: 0, scoreCount: 0 };
    }
    deptHeatmapData[dName].total++;
    if (emp.currentStatus !== 'Offline') {
      deptHeatmapData[dName].active++;
    }
    if (emp.todayStats?.productivityScore !== undefined) {
      deptHeatmapData[dName].scoreSum += emp.todayStats.productivityScore;
      deptHeatmapData[dName].scoreCount++;
    }
  });

  const activeAlerts = liveAlerts.filter(a => !dismissedAlerts[a.id]);

  // Executive stats columns
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
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Link to={`/employees/${record.id}`} style={{ fontWeight: 600, color: '#0F172A' }}>
                {fullName}
              </Link>
              <span style={{ fontSize: 11, color: '#64748B' }}>{record.email}</span>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '12px 0' }}>
      
      {/* SWITCHER HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', color: '#0F172A', margin: 0 }}>
            Workforce command dashboard
          </h1>
          <p style={{ color: '#64748B', margin: '4px 0 0', fontSize: 13 }}>
            {activeTab === 'command-center' 
              ? 'Real-time telemetry, device application focus tracks, productivity ratios, and dynamic alerts.' 
              : 'Aggregated organizational distributions, FTE ratios, hiring velocity, and corporate growth.'}
          </p>
        </div>

        {isManagement && (
          <Segmented
            options={[
              { label: 'Workforce Command Center', value: 'command-center', icon: <ThunderboltOutlined /> },
              { label: 'Executive Analytics', value: 'overview', icon: <PieChartOutlined /> }
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as string)}
            size="large"
            style={{ borderRadius: 8, background: '#F1F5F9', border: '1px solid #E2E8F0', padding: 3 }}
          />
        )}
      </div>

      {activeTab === 'command-center' ? (
        <>
          {/* LIVE STATUS SUMMARY BADGES */}
          <Row gutter={[16, 16]}>
            {[
              { label: 'MANAGED STAFF', value: liveStats.total, status: 'All', color: '#3B82F6', bg: '#EFF6FF' },
              { label: 'ACTIVE / WORKING', value: liveStats.active, status: 'Active', color: '#10B981', bg: '#F0FDF4' },
              { label: 'IDLE STAFF', value: liveStats.idle, status: 'Idle', color: '#EF4444', bg: '#FEF2F2' },
              { label: 'ON BREAK', value: liveStats.break, status: 'Break', color: '#F59E0B', bg: '#FFFBEB' },
              { label: 'OFFLINE', value: liveStats.offline, status: 'Offline', color: '#94A3B8', bg: '#F8FAFC' }
            ].map(item => (
              <Col xs={12} sm={12} md={4.8} key={item.label} style={{ flex: '1 1 20%' }}>
                <Card 
                  hoverable 
                  onClick={() => setStatusFilter(item.status)}
                  style={{ 
                    borderRadius: 12, 
                    border: '1px solid #E2E8F0', 
                    borderLeft: `4px solid ${item.color}`,
                    background: statusFilter === item.status ? item.bg : '#FFFFFF',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  bodyStyle={{ padding: '16px 20px' }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>{item.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: item.color, marginTop: 4 }}>{item.value}</div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* TELEMETRY SEARCH & FILTER BAR */}
          <Card style={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: 'none' }} bodyStyle={{ padding: 16 }}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} lg={8}>
                <Input
                  prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
                  placeholder="Search staff name, app, website, machine name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                  style={{ borderRadius: 8 }}
                />
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Select
                  placeholder="Department"
                  style={{ width: '100%' }}
                  value={deptFilter}
                  onChange={setDeptFilter}
                  allowClear
                >
                  {departments.map((d: any) => (
                    <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                  ))}
                </Select>
              </Col>
              <Col xs={12} sm={8} lg={4}>
                <Select
                  placeholder="Productivity Bracket"
                  style={{ width: '100%' }}
                  value={prodFilter}
                  onChange={setProdFilter}
                >
                  <Select.Option value="All">All Productivity Levels</Select.Option>
                  <Select.Option value="High">Highly Productive (&gt;= 80%)</Select.Option>
                  <Select.Option value="Medium">Medium Productivity (50% - 80%)</Select.Option>
                  <Select.Option value="Low">Low Productivity (&lt; 50%)</Select.Option>
                </Select>
              </Col>
              <Col xs={24} sm={8} lg={8} style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button 
                  icon={<SettingOutlined />} 
                  onClick={handleOpenRules}
                  style={{ borderRadius: 8, fontWeight: 500 }}
                >
                  Productivity Rules
                </Button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8FAFC', padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <Badge status={isLiveRefreshing ? 'processing' : 'default'} color={isLiveRefreshing ? '#10B981' : '#94A3B8'} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>
                    {isLiveRefreshing ? 'Live Sync Active' : 'Polling Paused'}
                  </span>
                  <Button
                    type="text"
                    size="small"
                    icon={isLiveRefreshing ? <PauseCircleOutlined style={{ color: '#EF4444' }} /> : <PlayCircleOutlined style={{ color: '#10B981' }} />}
                    onClick={() => setIsLiveRefreshing(!isLiveRefreshing)}
                    style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20 }}
                  />
                </div>
                <Button 
                  icon={<ReloadOutlined spin={isLiveLoading} />} 
                  onClick={fetchLiveTelemetry}
                  style={{ borderRadius: 8 }}
                />
              </Col>
            </Row>
          </Card>

          {/* MAIN MONITORING CONTENT: GRID */}
          <Row gutter={[16, 16]}>
            {/* Table list */}
            <Col xs={24} xl={17}>
              <Card 
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: '#10B981' }} />
                    <span style={{ fontWeight: 700 }}>Real-time Telemetry Registry</span>
                    <Tag color="cyan" style={{ borderRadius: 4 }}>{filteredEmployeesList.length} Connected</Tag>
                  </Space>
                }
                style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}
                bodyStyle={{ padding: 0 }}
              >
                <Table
                  dataSource={filteredEmployeesList}
                  rowKey="id"
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  size="middle"
                  locale={{ emptyText: <Empty description="No active staff match selection filters." /> }}
                  columns={[
                    {
                      title: 'Employee / Machine',
                      key: 'employee',
                      render: (_, record: any) => {
                        const name = `${record.first_name} ${record.last_name}`;
                        return (
                          <Space size={10} style={{ padding: '4px 0' }}>
                            <Badge dot status={record.currentStatus === 'Offline' ? 'default' : 'processing'} color={STATUS_COLORS[record.currentStatus] || '#94A3B8'}>
                              <Avatar src={record.avatar_url ? `${SERVER_URL}/${record.avatar_url}` : undefined} icon={<UserOutlined />} style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }} />
                            </Badge>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{name}</span>
                              <span style={{ fontSize: 10, color: '#64748B', display: 'flex', gap: 4, alignItems: 'center' }}>
                                <DesktopOutlined style={{ fontSize: 11 }} /> {record.todayStats?.machineName || 'Workstation'}
                              </span>
                            </div>
                          </Space>
                        );
                      }
                    },
                    {
                      title: 'Current Status',
                      dataIndex: 'currentStatus',
                      key: 'status',
                      render: (status: string) => {
                        let color = 'default';
                        if (status === 'Active') color = 'success';
                        else if (status === 'Idle') color = 'error';
                        else if (status === 'Break') color = 'warning';
                        return (
                          <Tag color={color} style={{ borderRadius: 6, fontWeight: 700, padding: '2px 8px', fontSize: 11 }}>
                            {status === 'Active' ? 'Working' : status}
                          </Tag>
                        );
                      }
                    },
                    {
                      title: 'Active App / Website',
                      key: 'current_work',
                      ellipsis: true,
                      render: (_, record: any) => {
                        if (record.currentStatus === 'Offline') {
                          return <span style={{ color: '#94A3B8', fontSize: 12 }}>— Offline —</span>;
                        }
                        // Prefer new enriched fields, fall back to activeWindow
                        const appLabel = record.appName || record.activeWindow || 'HRMS Dashboard';
                        const domain   = record.currentDomain || record.email?.split('@')[1] || '';
                        const focused  = record.isFocused !== false;
                        const switches = record.tabSwitchCount || 0;
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 220 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {/* Focus indicator dot */}
                              <span
                                title={focused ? 'Tab focused' : 'Tab not in focus'}
                                style={{
                                  width: 7, height: 7, borderRadius: '50%',
                                  background: focused ? '#10B981' : '#F59E0B',
                                  flexShrink: 0,
                                  boxShadow: focused ? '0 0 4px #10B981' : '0 0 4px #F59E0B'
                                }}
                              />
                              <span style={{ fontWeight: 600, color: '#1E293B', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {appLabel}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                              {domain && (
                                <span style={{ fontSize: 10, color: '#10B981', display: 'flex', gap: 3, alignItems: 'center' }}>
                                  <GlobalOutlined style={{ fontSize: 10 }} /> {domain}
                                </span>
                              )}
                              {switches > 0 && (
                                <span style={{ fontSize: 10, color: switches > 5 ? '#EF4444' : '#F59E0B', fontWeight: 600 }}>
                                  {switches} tab {switches === 1 ? 'switch' : 'switches'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      }
                    },

                    {
                      title: 'Department / Manager',
                      key: 'dept',
                      render: (_, record: any) => (
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 11 }}>
                          <span style={{ fontWeight: 500, color: '#334155' }}>{record.department}</span>
                          <span style={{ color: '#64748B' }}>Mgr: {record.manager}</span>
                        </div>
                      )
                    },
                    {
                      title: 'Time Breakdown',
                      key: 'breakdown',
                      render: (_, record: any) => {
                        const ts = record.todayStats || {};
                        const working = ts.activeHours || 0;
                        const idle = ts.idleHours || 0;
                        const onBreak = ts.breakHours || 0;
                        return (
                          <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                            <span style={{ color: '#10B981', fontWeight: 600 }}>{working}h <span style={{ fontWeight: 400, color: '#94A3B8' }}>wrk</span></span>
                            <span style={{ color: '#EF4444', fontWeight: 600 }}>{idle}h <span style={{ fontWeight: 400, color: '#94A3B8' }}>idl</span></span>
                            <span style={{ color: '#F59E0B', fontWeight: 600 }}>{onBreak}h <span style={{ fontWeight: 400, color: '#94A3B8' }}>brk</span></span>
                          </div>
                        );
                      }
                    },
                    {
                      title: 'Prod %',
                      key: 'productivity',
                      sorter: (a: any, b: any) => (a.todayStats?.productivityScore || 0) - (b.todayStats?.productivityScore || 0),
                      render: (_, record: any) => {
                        const score = record.todayStats?.productivityScore ?? 100;
                        let strokeColor = '#10B981';
                        if (score < 50) strokeColor = '#EF4444';
                        else if (score < 80) strokeColor = '#F59E0B';
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Progress 
                              type="circle" 
                              percent={score} 
                              size={28} 
                              strokeWidth={10} 
                              strokeColor={strokeColor} 
                              format={() => ''}
                            />
                            <span style={{ fontWeight: 700, color: '#334155', fontSize: 12 }}>{score}%</span>
                          </div>
                        );
                      }
                    },
                    {
                      title: 'Action',
                      key: 'actions',
                      align: 'center',
                      render: (_, record: any) => (
                        <Button 
                          type="primary"
                          size="small"
                          ghost
                          onClick={() => handleOpenTimeline(record.id, `${record.first_name} ${record.last_name}`)}
                          style={{ borderRadius: 6, fontSize: 11 }}
                        >
                          Inspect
                        </Button>
                      )
                    }
                  ]}
                />
              </Card>
            </Col>

            {/* Sidewidgets */}
            <Col xs={24} xl={7} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* SMART ALERTS FEED */}
              <Card 
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#EF4444' }} />
                    <span style={{ fontWeight: 700 }}>Telemetry Smart Alerts</span>
                  </Space>
                }
                extra={<Badge count={activeAlerts.length} color="#EF4444" />}
                style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}
                bodyStyle={{ padding: 12, maxHeight: 220, overflowY: 'auto' }}
              >
                {activeAlerts.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {activeAlerts.map(alert => (
                      <div 
                        key={alert.id} 
                        style={{ 
                          padding: 10, 
                          borderRadius: 8, 
                          border: '1px solid #F1F5F9',
                          background: alert.severity === 'error' ? '#FEF2F2' : (alert.severity === 'warning' ? '#FFFBEB' : '#F0FDF4'),
                          borderLeft: `3px solid ${alert.severity === 'error' ? '#EF4444' : (alert.severity === 'warning' ? '#F59E0B' : '#10B981')}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 700, fontSize: 11, color: '#334155' }}>
                            {alert.type.replace('_', ' ')}
                          </span>
                          <Button 
                            type="text" 
                            size="small" 
                            danger 
                            onClick={() => setDismissedAlerts(prev => ({ ...prev, [alert.id]: true }))}
                            style={{ padding: 0, height: 16, fontSize: 10, display: 'flex', alignItems: 'center' }}
                          >
                            Dismiss
                          </Button>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: '#475569' }}>{alert.message}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                          <span style={{ fontSize: 9, color: '#94A3B8' }}>
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                          <Button 
                            type="link" 
                            size="small" 
                            onClick={() => handleOpenTimeline(alert.employeeId, alert.employeeName)}
                            style={{ padding: 0, fontSize: 10, height: 12 }}
                          >
                            Inspect Timeline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No active anomalies detected." style={{ margin: '16px 0' }} />
                )}
              </Card>

              {/* DEPARTMENT HEATMAP */}
              <Card 
                title={
                  <Space>
                    <SlidersOutlined style={{ color: '#3B82F6' }} />
                    <span style={{ fontWeight: 700 }}>Department Analytics Heatmap</span>
                  </Space>
                }
                style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}
                bodyStyle={{ padding: 12 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.keys(deptHeatmapData).map(dName => {
                    const data = deptHeatmapData[dName];
                    const avgScore = data.scoreCount > 0 ? Math.round(data.scoreSum / data.scoreCount) : 100;
                    let color = 'green';
                    if (avgScore < 50) color = 'red';
                    else if (avgScore < 80) color = 'orange';

                    return (
                      <div key={dName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #F1F5F9', borderRadius: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: 12, color: '#1E293B' }}>{dName}</span>
                          <span style={{ fontSize: 10, color: '#64748B' }}>{data.active} / {data.total} Active Staff</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: color === 'green' ? '#10B981' : (color === 'orange' ? '#F59E0B' : '#EF4444') }}>
                            {avgScore}%
                          </span>
                          <Progress 
                            type="circle" 
                            percent={avgScore} 
                            size={18} 
                            strokeWidth={14} 
                            strokeColor={color === 'green' ? '#10B981' : (color === 'orange' ? '#F59E0B' : '#EF4444')} 
                            format={() => ''}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* PRODUCTIVITY RANKING LEADERBOARD */}
              <Card 
                title={
                  <Space>
                    <FireOutlined style={{ color: '#F59E0B' }} />
                    <span style={{ fontWeight: 700 }}>Workforce Rankings</span>
                  </Space>
                }
                style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}
                bodyStyle={{ padding: 12 }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', marginBottom: 6, letterSpacing: '0.05em' }}>TOP PRODUCERS TODAY</div>
                    <List
                      size="small"
                      dataSource={[...liveEmployees]
                        .filter(e => e.currentStatus !== 'Offline')
                        .sort((a, b) => (b.todayStats?.productivityScore || 0) - (a.todayStats?.productivityScore || 0))
                        .slice(0, 3)}
                      renderItem={(item: any, idx) => (
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                          <Space size={8}>
                            <span style={{ fontWeight: 700, color: '#64748B', width: 12 }}>{idx + 1}.</span>
                            <span style={{ fontWeight: 500, color: '#334155' }}>{item.first_name} {item.last_name}</span>
                          </Space>
                          <span style={{ fontWeight: 700, color: '#10B981' }}>{item.todayStats?.productivityScore}%</span>
                        </div>
                      )}
                      locale={{ emptyText: <span style={{ fontSize: 10, color: '#94A3B8' }}>No metrics loaded today.</span> }}
                    />
                  </div>
                  
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', marginBottom: 6, letterSpacing: '0.05em' }}>ATTENTION NEEDED</div>
                    <List
                      size="small"
                      dataSource={[...liveEmployees]
                        .filter(e => e.currentStatus !== 'Offline')
                        .sort((a, b) => (a.todayStats?.productivityScore || 0) - (b.todayStats?.productivityScore || 0))
                        .slice(0, 3)}
                      renderItem={(item: any, idx) => (
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
                          <Space size={8}>
                            <span style={{ fontWeight: 700, color: '#64748B', width: 12 }}>{idx + 1}.</span>
                            <span style={{ fontWeight: 500, color: '#334155' }}>{item.first_name} {item.last_name}</span>
                          </Space>
                          <span style={{ fontWeight: 700, color: '#EF4444' }}>{item.todayStats?.productivityScore}%</span>
                        </div>
                      )}
                      locale={{ emptyText: <span style={{ fontSize: 10, color: '#94A3B8' }}>No metrics loaded today.</span> }}
                    />
                  </div>
                </div>
              </Card>

            </Col>
          </Row>
        </>
      ) : (
        /* TRADITIONAL EXECUTIVE ANALYTICS VIEW */
        <>
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
            </Row>
          )}

          {/* ANALYTICS CHARTS SECTION */}
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card title="Employee Growth Analytics" extra={<span style={{ fontSize: 12, color: '#64748B' }}>Hiring Trajectory</span>}>
                <div style={{ width: '100%', height: 320 }}>
                  {growthData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={growthData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorEmployees" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                        <RechartsTooltip 
                          contentStyle={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                            fontSize: '12px'
                          }}
                        />
                        <Area type="monotone" dataKey="Employees" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorEmployees)" />
                        <Area type="monotone" dataKey="Active" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#colorActive)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <Empty description="No growth data available" style={{ paddingTop: 60 }} />
                  )}
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={8}>
              <Card title="Department Distribution" extra={<span style={{ fontSize: 12, color: '#64748B' }}>FTE Allocation</span>}>
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
                            <RechartsTooltip
                              contentStyle={{
                                background: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: '6px',
                                fontSize: '12px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, width: '100%', padding: '10px 0', maxHeight: 100, overflowY: 'auto' }}>
                        {deptData.filter(d => d.value > 0).map((entry, index) => (
                          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[index % COLORS.length] }} />
                            <span style={{ fontWeight: 500, color: '#0F172A' }}>{entry.name}</span>
                            <span style={{ color: '#64748B' }}>({entry.value})</span>
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

            <Col xs={24} xl={10}>
              <Card title="Recent HR Audit Logs">
                <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                  {activities.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {activities.map((act) => (
                        <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <Avatar 
                            src={act.employee_avatar ? `${SERVER_URL}/${act.employee_avatar}` : undefined} 
                            icon={<UserOutlined />}
                            size="small"
                            style={{ backgroundColor: '#F1F5F9', color: '#64748B', marginTop: 2 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, fontSize: 13 }}>
                            <span style={{ color: '#0F172A' }}>{act.description}</span>
                            <span style={{ fontSize: 11, color: '#64748B' }}>
                              {new Date(act.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="No recent operations logged" />
                  )}
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* TIMELINE telemetry DRAWDER OVERLAY */}
      <Drawer
        title={<span style={{ fontWeight: 700 }}>Telemetry Inspect: {selectedEmpName}</span>}
        placement="right"
        width={720}
        onClose={() => setTimelineDrawerVisible(false)}
        open={timelineDrawerVisible}
        destroyOnClose
      >
        {timelineLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin size="large" tip="Aggregating telemetry logs..." />
          </div>
        ) : timelineData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Visual Timeline State Bar */}
            <div>
              <h4 style={{ fontWeight: 700, margin: '0 0 10px', fontSize: 13, color: '#64748B', letterSpacing: '0.05em' }}>STATE CHUNKS TODAY</h4>
              {timelineData.timeline && timelineData.timeline.length > 0 ? (
                <div style={{ display: 'flex', width: '100%', height: 32, borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                  {timelineData.timeline.map((block: any, idx: number) => {
                    let color = '#94A3B8';
                    if (block.status === 'Active') color = '#10B981';
                    else if (block.status === 'Idle') color = '#EF4444';
                    else if (block.status === 'Break') color = '#F59E0B';
                    return (
                      <AntTooltip 
                        key={idx} 
                        title={`Time: ${new Date(block.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${block.status} (inputs: ${block.inputs || 0})`}
                      >
                        <div style={{ flex: 1, backgroundColor: color, borderRight: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
                      </AntTooltip>
                    );
                  })}
                </div>
              ) : (
                <div style={{ background: '#F8FAFC', padding: '10px 16px', borderRadius: 8, border: '1px solid #E2E8F0', color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>
                  No state chunks recorded for today.
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, justifyContent: 'center' }}>
                <Space><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} /> Working</Space>
                <Space><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} /> Idle</Space>
                <Space><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} /> Break</Space>
                <Space><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#94A3B8' }} /> Offline</Space>
              </div>
            </div>

            {/* Daily Metrics Summary */}
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>PRODUCTIVITY</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#10B981', marginTop: 4 }}>{timelineData.summary.productivityScore}%</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>FOCUS SCORE</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#3B82F6', marginTop: 4 }}>{timelineData.summary.focusScore}%</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>DEEP WORK</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#6366F1', marginTop: 4 }}>{Math.round(timelineData.summary.deepWorkScore)}m</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ textAlign: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: 10, color: '#64748B', fontWeight: 600 }}>SWITCHES</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#EF4444', marginTop: 4 }}>{timelineData.summary.contextSwitches}</div>
                </Card>
              </Col>
            </Row>

            {/* Smart Insights list */}
            {timelineData.insights && timelineData.insights.length > 0 && (
              <div>
                <h4 style={{ fontWeight: 700, margin: '0 0 10px', fontSize: 13, color: '#64748B', letterSpacing: '0.05em' }}>BEHAVIORAL INSIGHTS</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {timelineData.insights.map((insight: string, idx: number) => (
                    <Alert key={idx} message={insight} type="info" showIcon style={{ borderRadius: 8, fontSize: 11 }} />
                  ))}
                </div>
              </div>
            )}

            {/* Top Applications & Top Web Domains */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title={<span style={{ fontSize: 13, fontWeight: 700 }}><DesktopOutlined /> Top Applications</span>} size="small" style={{ borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  {Object.keys(timelineData.appUsage || {}).length > 0 ? (
                    <List
                      size="small"
                      dataSource={Object.entries(timelineData.appUsage).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5)}
                      renderItem={([app, hours]: any) => (
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                          <span style={{ color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{app}</span>
                          <span style={{ fontWeight: 700, color: '#1E293B' }}>{hours} hrs</span>
                        </div>
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No application logs." />
                  )}
                </Card>
              </Col>
              
              <Col span={12}>
                <Card title={<span style={{ fontSize: 13, fontWeight: 700 }}><GlobalOutlined /> Top Visited Domains</span>} size="small" style={{ borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  {Object.keys(timelineData.webUsage || {}).length > 0 ? (
                    <List
                      size="small"
                      dataSource={Object.entries(timelineData.webUsage).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5)}
                      renderItem={([web, hours]: any) => (
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 11 }}>
                          <span style={{ color: '#475569', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{web}</span>
                          <span style={{ fontWeight: 700, color: '#1E293B' }}>{hours} hrs</span>
                        </div>
                      )}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No website logs." />
                  )}
                </Card>
              </Col>
            </Row>

            {/* Granular state timelines */}
            <div>
              <h4 style={{ fontWeight: 700, margin: '0 0 10px', fontSize: 13, color: '#64748B', letterSpacing: '0.05em' }}>CHRONOLOGICAL TELEMETRY JOURNAL</h4>
              <Table 
                dataSource={timelineData.heartbeats ? [...timelineData.heartbeats].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 30) : []}
                rowKey="id"
                pagination={{ pageSize: 6 }}
                size="small"
                columns={[
                  {
                    title: 'Time',
                    dataIndex: 'timestamp',
                    render: (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  },
                  {
                    title: 'State',
                    dataIndex: 'status',
                    render: (s) => <Tag color={s === 'Active' ? 'success' : (s === 'Idle' ? 'error' : 'warning')}>{s}</Tag>
                  },
                  {
                    title: 'Active Window Content',
                    dataIndex: 'active_window',
                    ellipsis: true,
                    render: (w) => <span style={{ fontSize: 11, color: '#475569' }}>{w || '--'}</span>
                  },
                  {
                    title: 'Clicks/Keys',
                    key: 'inputs',
                    render: (_, r: any) => <span style={{ fontSize: 11 }}>{r.mouse_clicks || r.mouseClicks || 0} / {r.keyboard_presses || r.keyboardPresses || 0}</span>
                  }
                ]}
              />
            </div>
            
          </div>
        ) : (
          <Empty description="No details available." />
        )}
      </Drawer>

      {/* CLASSIFICATION RULES MANAGEMENT DRAWER */}
      <Drawer
        title={<span style={{ fontWeight: 700 }}><SlidersOutlined /> Corporate Productivity Classification Rules</span>}
        placement="right"
        width={680}
        onClose={() => setRulesDrawerVisible(false)}
        open={rulesDrawerVisible}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Add rule form */}
          <Card title={<span style={{ fontSize: 12, fontWeight: 700 }}>Add / Edit Classification Pattern</span>} size="small" style={{ borderRadius: 8, border: '1px solid #E2E8F0' }}>
            <Form form={ruleForm} layout="vertical" onFinish={handleSaveRule}>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="pattern" label="Window Pattern / Executable Name" rules={[{ required: true, message: 'Specify window title pattern (e.g. vscode, stackoverflow)' }]}>
                    <Input placeholder="e.g. vscode, stackoverflow, youtube.com" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="category" label="Productivity Category" rules={[{ required: true }]}>
                    <Select placeholder="Select category">
                      <Select.Option value="Productive">Productive</Select.Option>
                      <Select.Option value="Neutral">Neutral</Select.Option>
                      <Select.Option value="Unproductive">Unproductive</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="tag" label="Productivity Tag" rules={[{ required: true }]}>
                    <Select placeholder="Select category tag">
                      <Select.Option value="Deep Work">Deep Work</Select.Option>
                      <Select.Option value="Communication">Communication</Select.Option>
                      <Select.Option value="Learning">Learning</Select.Option>
                      <Select.Option value="Research">Research</Select.Option>
                      <Select.Option value="Entertainment">Entertainment</Select.Option>
                      <Select.Option value="Social Media">Social Media</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="score" label="Score Percentage Weight (0-100%)" rules={[{ required: true }]} initialValue={100}>
                    <Input type="number" min={0} max={100} />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />} style={{ borderRadius: 6 }}>
                Register Rule
              </Button>
            </Form>
          </Card>

          {/* List of rules */}
          <div>
            <h4 style={{ fontWeight: 700, margin: '0 0 10px', fontSize: 13, color: '#64748B', letterSpacing: '0.05em' }}>REGISTERED PATTERNS</h4>
            <Table
              dataSource={rules}
              rowKey="id"
              size="small"
              loading={rulesLoading}
              pagination={{ pageSize: 8 }}
              columns={[
                {
                  title: 'Pattern Rule',
                  dataIndex: 'pattern',
                  render: (p) => <code style={{ background: '#F1F5F9', padding: '2px 4px', borderRadius: 4, fontSize: 11 }}>{p}</code>
                },
                {
                  title: 'Category',
                  dataIndex: 'category',
                  render: (cat) => {
                    let c = 'default';
                    if (cat === 'Productive') c = 'success';
                    else if (cat === 'Unproductive') c = 'error';
                    return <Tag color={c}>{cat}</Tag>;
                  }
                },
                {
                  title: 'Tag',
                  dataIndex: 'tag',
                  render: (t) => <Tag color="blue">{t || 'General'}</Tag>
                },
                {
                  title: 'Score',
                  dataIndex: 'score',
                  render: (s) => <span style={{ fontWeight: 700 }}>{s}%</span>
                },
                {
                  title: 'Action',
                  key: 'action',
                  align: 'center',
                  render: (_, record: any) => (
                    <Popconfirm title="Delete this pattern classification rule?" onConfirm={() => handleDeleteRule(record.id)}>
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )
                }
              ]}
            />
          </div>

        </div>
      </Drawer>

    </div>
  );
};
export default Dashboard;
