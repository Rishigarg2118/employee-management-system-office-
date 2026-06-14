import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, Tabs, Row, Col, Statistic, Typography, Table, Space, 
  Select, DatePicker, Button, Spin, Tag, message, Input, Pagination 
} from 'antd';
import { 
  BarChartOutlined, LineChartOutlined, FileExcelOutlined, 
  UserOutlined, ClockCircleOutlined, CalendarOutlined, CheckSquareOutlined,
  PrinterOutlined, SearchOutlined, SlidersOutlined, FileTextOutlined,
  GlobalOutlined, DesktopOutlined, DashboardOutlined, FireOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area 
} from 'recharts';
import api, { SERVER_URL } from '../../services/api';
import { Department, Project } from '../../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Palette
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#64748B'];

export const ReportsCenter: React.FC = () => {
  const [reportType, setReportType] = useState('daily');
  
  // Date states
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs(), dayjs()]);
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Sync date ranges when reportType switches
  useEffect(() => {
    if (reportType === 'daily') {
      setDateRange([dayjs(), dayjs()]);
    } else if (reportType === 'weekly') {
      setDateRange([dayjs().subtract(6, 'day'), dayjs()]);
    } else if (reportType === 'monthly') {
      setDateRange([dayjs().subtract(29, 'day'), dayjs()]);
    }
    setPage(1);
  }, [reportType]);

  // Queries
  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.getDepartments()
  });

  const { data: reportResult, isLoading: isReportLoading } = useQuery({
    queryKey: ['comprehensiveReport', reportType, dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD'), selectedDept, searchQuery, page, limit],
    queryFn: () => api.getComprehensiveReport({
      reportType,
      startDate: dateRange[0].format('YYYY-MM-DD'),
      endDate: dateRange[1].format('YYYY-MM-DD'),
      departmentId: selectedDept,
      search: searchQuery,
      page,
      limit
    }),
    enabled: reportType !== 'overview'
  });

  // Overview Queries
  const { data: headcountData } = useQuery({
    queryKey: ['reportsHeadcount'],
    queryFn: () => api.getReportsHeadcount(),
    enabled: reportType === 'overview'
  });

  const { data: leaveStats } = useQuery({
    queryKey: ['reportsLeaveStats'],
    queryFn: () => api.getReportsLeaveStats(),
    enabled: reportType === 'overview'
  });

  const { data: taskStats } = useQuery({
    queryKey: ['reportsTaskStats'],
    queryFn: () => api.getReportsTaskStats(),
    enabled: reportType === 'overview'
  });

  const { data: deptDistribution = [] } = useQuery({
    queryKey: ['reportsDeptDistribution'],
    queryFn: () => api.getReportsDepartmentDistribution(),
    enabled: reportType === 'overview'
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects(),
    enabled: reportType === 'overview'
  });

  // Headers dynamically compiled based on reports
  const getColumns = () => {
    switch (reportType) {
      case 'daily':
        return [
          {
            title: 'Employee',
            key: 'employee',
            render: (_: any, r: any) => (
              <Space>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }} />
                <div>
                  <Text strong style={{ color: '#1E293B' }}>{r.name}</Text>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{r.display_id} - {r.designation}</div>
                </div>
              </Space>
            )
          },
          { title: 'Department', dataIndex: 'department', key: 'department' },
          { 
            title: 'Clock In', 
            dataIndex: 'check_in', 
            key: 'check_in',
            render: (v: string) => v ? dayjs(v).format('hh:mm A') : <Tag>Absent</Tag>
          },
          { 
            title: 'Clock Out', 
            dataIndex: 'check_out', 
            key: 'check_out',
            render: (v: string) => v ? dayjs(v).format('hh:mm A') : '--:--'
          },
          { 
            title: 'Working Hours', 
            dataIndex: 'working_hours', 
            key: 'working_hours', 
            render: (v: number) => <Text strong>{v.toFixed(1)} hrs</Text>
          },
          { 
            title: 'Idle Hours', 
            dataIndex: 'idle_hours', 
            key: 'idle_hours', 
            render: (v: number) => <span style={{ color: '#EF4444' }}>{v.toFixed(1)} hrs</span>
          },
          { 
            title: 'Break Hours', 
            dataIndex: 'break_hours', 
            key: 'break_hours', 
            render: (v: number) => <span style={{ color: '#F59E0B' }}>{v.toFixed(1)} hrs</span>
          }
        ];

      case 'weekly':
      case 'monthly':
      case 'employee':
      case 'intern':
        return [
          {
            title: 'Employee',
            key: 'employee',
            render: (_: any, r: any) => (
              <Space>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }} />
                <div>
                  <Text strong style={{ color: '#1E293B' }}>{r.name}</Text>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{r.display_id} - {r.designation}</div>
                </div>
              </Space>
            )
          },
          { title: 'Department', dataIndex: 'department', key: 'department' },
          { 
            title: reportType === 'weekly' || reportType === 'monthly' ? 'Days Active' : 'Days Checked-in', 
            dataIndex: reportType === 'weekly' || reportType === 'monthly' ? 'days_active' : 'days_checked_in', 
            key: 'days' 
          },
          { 
            title: 'Working Hours', 
            dataIndex: reportType === 'weekly' || reportType === 'monthly' ? 'total_working_hours' : 'working_hours', 
            key: 'work', 
            render: (v: number) => <Text strong style={{ color: '#10B981' }}>{v.toFixed(1)} hrs</Text>
          },
          { 
            title: 'Idle Hours', 
            dataIndex: reportType === 'weekly' || reportType === 'monthly' ? 'total_idle_hours' : 'idle_hours', 
            key: 'idle', 
            render: (v: number) => <span style={{ color: '#EF4444' }}>{v.toFixed(1)} hrs</span>
          },
          { 
            title: 'Break Hours', 
            dataIndex: reportType === 'weekly' || reportType === 'monthly' ? 'total_break_hours' : 'break_hours', 
            key: 'break', 
            render: (v: number) => <span style={{ color: '#F59E0B' }}>{v.toFixed(1)} hrs</span>
          }
        ];

      case 'department':
        return [
          { title: 'Department Name', dataIndex: 'department', key: 'department', render: (v: string) => <Text strong style={{ color: '#0F172A' }}>{v}</Text> },
          { title: 'Manager', dataIndex: 'manager', key: 'manager', render: (v: string) => v || 'Unassigned' },
          { title: ' Roster Staff Count', dataIndex: 'staff_count', key: 'staff_count' },
          { 
            title: 'Working Hours', 
            dataIndex: 'total_working_hours', 
            key: 'work', 
            render: (v: number) => <Text strong>{v.toFixed(1)} hrs</Text>
          },
          { 
            title: 'Idle Hours', 
            dataIndex: 'total_idle_hours', 
            key: 'idle', 
            render: (v: number) => <span style={{ color: '#EF4444' }}>{v.toFixed(1)} hrs</span>
          }
        ];

      case 'top-performers':
      case 'least-active':
        return [
          {
            title: 'Employee',
            key: 'employee',
            render: (_: any, r: any) => (
              <Space>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)' }} />
                <div>
                  <Text strong style={{ color: '#1E293B' }}>{r.name}</Text>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{r.display_id} - {r.designation}</div>
                </div>
              </Space>
            )
          },
          { title: 'Department', dataIndex: 'department', key: 'department' },
          { 
            title: 'Focus Score', 
            dataIndex: 'focus_score', 
            key: 'focus_score', 
            render: (v: number) => (
              <Space>
                <Progress percent={v} size="small" type="circle" width={20} format={() => ''} strokeColor={v >= 80 ? '#10B981' : (v >= 50 ? '#F59E0B' : '#EF4444')} />
                <Text strong>{v}%</Text>
              </Space>
            )
          },
          { 
            title: 'Working Time', 
            dataIndex: 'total_working_hours', 
            key: 'work', 
            render: (v: number) => <Text>{v.toFixed(1)} hrs</Text>
          }
        ];

      case 'idle-analysis':
        return [
          {
            title: 'Employee',
            key: 'employee',
            render: (_: any, r: any) => (
              <Space>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }} />
                <div>
                  <Text strong style={{ color: '#1E293B' }}>{r.name}</Text>
                  <div style={{ fontSize: 10, color: '#64748B' }}>{r.display_id}</div>
                </div>
              </Space>
            )
          },
          { title: 'Department', dataIndex: 'department', key: 'department' },
          { title: 'Designation', dataIndex: 'designation', key: 'designation' },
          { 
            title: 'Idle Time', 
            dataIndex: 'idle_hours', 
            key: 'idle_hours',
            render: (v: number) => <span style={{ color: '#EF4444', fontWeight: 600 }}>{v.toFixed(1)} hrs</span>
          },
          { 
            title: 'Idle Ratio %', 
            dataIndex: 'idle_percentage', 
            key: 'idle_percentage',
            render: (v: number) => <Text strong>{v}%</Text>
          }
        ];

      case 'website-usage':
        return [
          { title: 'Domain Address', dataIndex: 'website', key: 'website', render: (v: string) => <code style={{ background: '#F1F5F9', padding: '2px 4px', borderRadius: 4 }}>{v}</code> },
          { title: 'Total Hours', dataIndex: 'duration_hours', key: 'duration_hours', render: (v: number) => <span>{v.toFixed(2)} hrs</span> },
          { title: 'Users Count', dataIndex: 'staff_count', key: 'staff_count' }
        ];

      case 'application-usage':
        return [
          { title: 'Application Process', dataIndex: 'app_name', key: 'app_name', render: (v: string) => <Text strong>{v}</Text> },
          { title: 'Total Hours', dataIndex: 'duration_hours', key: 'duration_hours', render: (v: number) => <span>{v.toFixed(2)} hrs</span> },
          { title: 'Users Count', dataIndex: 'staff_count', key: 'staff_count' }
        ];

      default:
        return [];
    }
  };

  // CSV/Excel Exports generator
  const exportData = (format: 'csv' | 'excel') => {
    const list = reportResult?.data || [];
    if (list.length === 0) {
      message.warning('No reporting data to export.');
      return;
    }

    const cols = getColumns();
    const headers = cols.map(c => c.title).join(format === 'csv' ? ',' : '\t');
    
    const rows = list.map((r: any) => {
      return cols.map(c => {
        if (c.key === 'employee') {
          return `"${r.name} (${r.display_id || ''})"`;
        }
        const val = r[c.dataIndex as string] || '';
        return typeof val === 'object' ? JSON.stringify(val) : `"${val}"`;
      }).join(format === 'csv' ? ',' : '\t');
    });

    const fileContent = [headers, ...rows].join('\n');
    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${reportType}_report_${dayjs().format('YYYYMMDD')}.${format === 'csv' ? 'csv' : 'xls'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(`Successfully exported ${reportType} report sheet.`);
  };

  // PDF Export Trigger
  const triggerPrintPDF = () => {
    window.print();
  };

  const reportOptions = [
    { value: 'daily', label: 'Daily Roster Activity', icon: <ClockCircleOutlined /> },
    { value: 'weekly', label: 'Weekly Rollup Ledger', icon: <CalendarOutlined /> },
    { value: 'monthly', label: 'Monthly Rollup Ledger', icon: <CalendarOutlined /> },
    { value: 'department', label: 'Department Summary', icon: <SlidersOutlined /> },
    { value: 'employee', label: 'Regular Employees', icon: <UserOutlined /> },
    { value: 'intern', label: 'Interns & Probationers', icon: <UserOutlined /> },
    { value: 'top-performers', label: 'Top Focus Performers', icon: <FireOutlined /> },
    { value: 'least-active', label: 'Least Active Staff', icon: <WarningOutlined /> },
    { value: 'idle-analysis', label: 'Workstation Idle Analysis', icon: <SlidersOutlined /> },
    { value: 'website-usage', label: 'Corporate Website Usage', icon: <GlobalOutlined /> },
    { value: 'application-usage', label: 'Desktop App Usage', icon: <DesktopOutlined /> },
    { value: 'overview', label: 'Executive Analytics', icon: <DashboardOutlined /> }
  ];

  return (
    <div className="reports-print-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* HEADER CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em' }}>
            Enterprise Analytics Center
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Exposes visual productivity ratios, chronological timelines, application classifications, and printable audits.
          </Text>
        </div>

        <Space className="no-print">
          <Button icon={<PrinterOutlined />} onClick={triggerPrintPDF} style={{ borderRadius: 6 }}>Print / PDF</Button>
          <Button icon={<FileExcelOutlined />} type="primary" onClick={() => exportData('excel')} style={{ borderRadius: 6, backgroundColor: '#16A34A', borderColor: '#16A34A' }}>Excel</Button>
          <Button icon={<FileTextOutlined />} onClick={() => exportData('csv')} style={{ borderRadius: 6 }}>CSV</Button>
        </Space>
      </div>

      {/* SEARCH AND FILTERS */}
      <Card className="no-print" style={{ borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: 'none' }} bodyStyle={{ padding: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} lg={4}>
            <Select 
              value={reportType} 
              onChange={setReportType} 
              style={{ width: '100%' }}
              dropdownStyle={{ borderRadius: 8 }}
            >
              {reportOptions.map(opt => (
                <Option key={opt.value} value={opt.value}>
                  <Space>{opt.icon} {opt.label}</Space>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <RangePicker 
              value={dateRange}
              onChange={(dates) => dates && setDateRange([dates[0]!, dates[1]!])}
              style={{ width: '100%', borderRadius: 6 }}
              allowClear={false}
            />
          </Col>
          <Col xs={12} sm={12} lg={4}>
            <Select
              placeholder="All Departments"
              value={selectedDept}
              onChange={setSelectedDept}
              allowClear
              style={{ width: '100%' }}
            >
              {departments.map((d: any) => (
                <Option key={d.id} value={d.id}>{d.name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={12} sm={12} lg={6}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ borderRadius: 6 }}
            />
          </Col>
        </Row>
      </Card>

      {/* COMPREHENSIVE TABULAR DATA GRID */}
      {reportType !== 'overview' ? (
        <Card style={{ borderRadius: 12, border: '1px solid #E2E8F0' }} bodyStyle={{ padding: 0 }}>
          {isReportLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <Spin size="large" tip="Aggregating metrics registry..." />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Table
                dataSource={reportResult?.data || []}
                columns={getColumns() as any}
                rowKey="id"
                pagination={false}
                size="middle"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px', borderTop: '1px solid #F1F5F9' }}>
                <Pagination
                  current={page}
                  pageSize={limit}
                  total={reportResult?.total || 0}
                  onChange={(p, s) => { setPage(p); setLimit(s); }}
                  showSizeChanger
                  size="small"
                />
              </div>
            </div>
          )}
        </Card>
      ) : (
        /* TRADITIONAL EXECUTIVE ANALYTICS CHARTS TAB fallback */
        <Row gutter={[24, 24]}>
          {/* Summary stats */}
          <Col xs={24} md={8}>
            <Card title="Roster Headcount Ratio" style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <Statistic title="Total Active Employees" value={headcountData?.count || 0} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card title="Leave Inboxes" style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <Statistic title="Pending Reviews" value={leaveStats?.pendingLeavesCount || 0} prefix={<CalendarOutlined />} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card title="Task Deliveries" style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <Statistic title="Completion Ratios" value={taskStats?.taskCompletionRate || 0} suffix="%" prefix={<CheckSquareOutlined />} />
            </Card>
          </Col>

          {/* Donut Distribution charts */}
          <Col xs={24} lg={12}>
            <Card title="Roster distribution by Department" style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deptDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {deptDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v} staff`, 'Headcount']} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>

          {/* Project progress table */}
          <Col xs={24} lg={12}>
            <Card title="Allocation status of active projects" style={{ borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <Table
                dataSource={projects}
                rowKey="id"
                pagination={{ pageSize: 4 }}
                size="small"
                columns={[
                  { title: 'Project', dataIndex: 'name', render: (v) => <Text strong>{v}</Text> },
                  { title: 'Deadline', dataIndex: 'deadline' },
                  { title: 'Members', render: (_, r) => `${r.members?.length || 0} staff` }
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* RECHARTS REPORTS-CENTRIC CHARTS */}
      {reportType !== 'overview' && (reportResult?.data || []).length > 0 && (
        <Card style={{ borderRadius: 12, border: '1px solid #E2E8F0' }} title={<span style={{ fontWeight: 700 }}>Metrics Distribution Chart</span>}>
          <div style={{ height: 300 }}>
            {reportType === 'application-usage' || reportType === 'website-usage' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportResult.data} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey={reportType === 'website-usage' ? 'website' : 'app_name'} stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} label={{ value: 'Duration (Hours)', angle: -90, position: 'insideLeft', offset: 10 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} hrs`, 'Duration']} />
                  <Bar dataKey="duration_hours" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportResult.data} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} hrs`, 'Time Spent']} />
                  <Bar dataKey={reportType === 'daily' ? 'working_hours' : 'total_working_hours'} name="Working Time" fill="#10B981" radius={[4, 4, 0, 0]} barSize={25} />
                  <Bar dataKey={reportType === 'daily' ? 'idle_hours' : 'total_idle_hours'} name="Idle Time" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      )}

    </div>
  );
};
export default ReportsCenter;
