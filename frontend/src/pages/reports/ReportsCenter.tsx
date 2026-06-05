import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Tabs, Row, Col, Statistic, Typography, Table, Space, Select, DatePicker, Button, Spin, Tag, message } from 'antd';
import { 
  BarChartOutlined, LineChartOutlined, FileExcelOutlined, 
  UserOutlined, ClockCircleOutlined, CalendarOutlined, CheckSquareOutlined 
} from '@ant-design/icons';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';
import api from '../../services/api';
import { Employee, Department, Task, Project } from '../../types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Harmonious color palette
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

export const ReportsCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState('1');
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);

  // Queries
  const { data: employeesRes, isLoading: isLoadingEmps } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.getEmployees({ limit: 1000 })
  });
  const employees = employeesRes?.data || [];

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.getDepartments()
  });

  const { data: attendanceAnalytics, isLoading: isLoadingAtt } = useQuery({
    queryKey: ['attendanceAnalytics', selectedDept],
    queryFn: () => api.getAttendanceAnalytics({ departmentId: selectedDept })
  });

  const { data: leaveAnalytics, isLoading: isLoadingLeaves } = useQuery({
    queryKey: ['leaveAnalytics'],
    queryFn: () => api.getLeaveAnalytics()
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks()
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects()
  });

  if (isLoadingEmps || isLoadingAtt || isLoadingLeaves || isLoadingTasks || isLoadingProjects) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="Compiling executive dashboard reports..." />
      </div>
    );
  }

  // --- Headcount Distribution Calculations ---
  const deptCountMap: { [name: string]: number } = {};
  employees.forEach(emp => {
    const dept = departments.find(d => d.id === emp.department_id);
    const deptName = dept ? dept.name : 'Unassigned';
    deptCountMap[deptName] = (deptCountMap[deptName] || 0) + 1;
  });

  const headcountChartData = Object.keys(deptCountMap).map(name => ({
    name,
    value: deptCountMap[name]
  }));

  // --- Task Priority distribution ---
  const priorityCountMap = { Low: 0, Medium: 0, High: 0, Urgent: 0 };
  tasks.forEach(t => {
    if (t.priority in priorityCountMap) {
      priorityCountMap[t.priority as keyof typeof priorityCountMap] += 1;
    }
  });

  const taskPriorityData = Object.keys(priorityCountMap).map(name => ({
    name,
    count: priorityCountMap[name as keyof typeof priorityCountMap]
  }));

  // --- Leave Monthly Trends ---
  const leaveTrendData = leaveAnalytics?.monthlyTrends || [];

  // --- Summary Cards calculations ---
  const totalEmployeesCount = employees.length;
  const attendanceRate = attendanceAnalytics?.monthlyPercentage || 92;
  const pendingLeavesCount = leaveAnalytics?.summary?.pending || 0;
  
  const completedTasksCount = tasks.filter(t => t.status === 'Done').length;
  const totalTasksCount = tasks.length;
  const taskCompletionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Mock export handler
  const handleExport = (type: string) => {
    message.success(`Exporting ${type} report to Excel format.`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>Reports Center</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Access corporate dashboards, export payroll sheets, and track labor metrics.
          </Text>
        </div>
        <Button 
          icon={<FileExcelOutlined />} 
          onClick={() => handleExport('overview')}
          style={{ height: 38, borderColor: '#E2E8F0', borderRadius: 6 }}
        >
          Export Report
        </Button>
      </div>

      {/* Metric summary boxes */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Total Roster Count</Text>}
              value={totalEmployeesCount}
              prefix={<UserOutlined style={{ color: '#10B981', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Attendance Rate</Text>}
              value={attendanceRate}
              suffix="%"
              prefix={<ClockCircleOutlined style={{ color: '#3B82F6', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Active Leave Inboxes</Text>}
              value={pendingLeavesCount}
              prefix={<CalendarOutlined style={{ color: '#F59E0B', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>Task Completion</Text>}
              value={taskCompletionRate}
              suffix="%"
              prefix={<CheckSquareOutlined style={{ color: '#10B981', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs Layout */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Tabs defaultActiveKey="1" onChange={setActiveTab} tabBarExtraContent={
          activeTab === '1' && (
            <Select 
              placeholder="All Departments" 
              style={{ width: 180 }} 
              allowClear
              value={selectedDept}
              onChange={setSelectedDept}
            >
              {departments.map(d => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          )
        }>
          {/* OVERVIEW ANALYTICS TAB */}
          <TabPane tab="Overview Dashboards" key="1">
            <Row gutter={[24, 24]} style={{ marginTop: 16 }}>
              {/* Headcount Distribution */}
              <Col xs={24} lg={12}>
                <div style={{ height: 350 }}>
                  <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12, color: '#475569' }}>
                    Roster Distribution by Department
                  </Text>
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie
                        data={headcountChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {headcountChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} staff`, 'Headcount']} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Col>

              {/* Leave Application Trends */}
              <Col xs={24} lg={12}>
                <div style={{ height: 350 }}>
                  <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12, color: '#475569' }}>
                    Leave Application Trends (Monthly)
                  </Text>
                  {leaveTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="90%">
                      <AreaChart data={leaveTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorLeaves" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                        <Area name="Requested" type="monotone" dataKey="Requested" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#colorLeaves)" />
                        <Area name="Approved" type="monotone" dataKey="Approved" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorApproved)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90%' }}>
                      <Text type="secondary">No monthly data available</Text>
                    </div>
                  )}
                </div>
              </Col>

              {/* Task Priorities distribution */}
              <Col xs={24} lg={24}>
                <div style={{ height: 320, marginTop: 16 }}>
                  <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 12, color: '#475569' }}>
                    Task Priority Layout
                  </Text>
                  <ResponsiveContainer width="100%" height="95%">
                    <BarChart data={taskPriorityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                      <Tooltip formatter={(value) => [`${value} tasks`, 'Count']} />
                      <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Col>
            </Row>
          </TabPane>

          {/* PROJECT METRICS TAB */}
          <TabPane tab="Projects Progress" key="2">
            <Table
              dataSource={projects}
              rowKey="id"
              pagination={false}
              style={{ marginTop: 16 }}
              columns={[
                {
                  title: 'Project Name',
                  dataIndex: 'name',
                  key: 'name',
                  render: (name: string) => <Text strong style={{ color: '#0F172A' }}>{name}</Text>
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status: string) => {
                    let color = 'blue';
                    if (status === 'Active') color = 'green';
                    else if (status === 'Completed') color = 'emerald';
                    else if (status === 'Archived') color = 'gray';
                    return <Tag color={color === 'emerald' ? 'green' : color}>{status}</Tag>;
                  }
                },
                {
                  title: 'Timeline',
                  key: 'timeline',
                  render: (_, record) => `${record.start_date} to ${record.deadline || 'No Deadline'}`
                },
                {
                  title: 'Team Allocated',
                  key: 'team',
                  render: (_, record) => `${record.members?.length || 0} staff`
                }
              ]}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};
export default ReportsCenter;
