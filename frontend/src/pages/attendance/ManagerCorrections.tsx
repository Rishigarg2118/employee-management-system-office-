import React, { useState } from 'react';
import { 
  Table, Card, Tag, Button, Modal, Form, Select, DatePicker, TimePicker, 
  Input, Space, Divider, message, Row, Col, Typography, Alert, 
  Segmented, Progress, Avatar, Tooltip, Drawer, List, Badge, Statistic 
} from 'antd';
import { 
  EditOutlined, TeamOutlined, SearchOutlined, FilterOutlined, 
  DesktopOutlined, CoffeeOutlined, UserOutlined, ThunderboltOutlined, 
  FieldTimeOutlined, SignalFilled, DownloadOutlined, SettingOutlined,
  ReloadOutlined, CheckCircleOutlined, FireOutlined, DashboardOutlined,
  WarningOutlined, CloseOutlined, PlusOutlined, UnorderedListOutlined, AppstoreOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { API_URL } from '../../services/api';
import { Attendance, AttendanceStatus } from '../../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { Text, Title } = Typography;

export const ManagerCorrections: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'corrections' | 'live'>('live');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  
  // Search & Filter & View State
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [form] = Form.useForm();

  // Employee Detail Drawer State
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null);
  const [selectedEmpName, setSelectedEmpName] = useState('');

  // Classifications Modal State
  const [classificationsModalVisible, setClassificationsModalVisible] = useState(false);
  const [ruleForm] = Form.useForm();

  // 1. Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments
  });

  // 2. Fetch team logs
  const { data: teamLogs, isLoading, refetch: refetchTeam } = useQuery<Attendance[]>({
    queryKey: ['attendanceTeam', selectedDept, startDate, endDate],
    queryFn: () => api.getAttendanceTeam({
      departmentId: selectedDept,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    })
  });

  // 3. Fetch pending correction requests
  const { data: correctionRequests = [] } = useQuery<any[]>({
    queryKey: ['attendanceCorrectionRequests'],
    queryFn: () => api.getAttendanceCorrectionRequests({ status: 'Pending' })
  });

  // 4. Fetch live workforce monitoring data
  const { data: liveWorkforce, isLoading: isLiveLoading, refetch: refetchLive } = useQuery({
    queryKey: ['liveWorkforce', selectedDept],
    queryFn: () => api.getLiveWorkforce({ departmentId: selectedDept }),
    refetchInterval: 10000 // Refresh live status every 10 seconds
  });

  // 5. Fetch selected employee's granular productivity details
  const { data: prodDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['productivityDetails', selectedEmpId],
    queryFn: () => selectedEmpId ? api.getProductivityDetails({ employeeId: selectedEmpId }) : null,
    enabled: !!selectedEmpId && detailDrawerVisible
  });

  // 6. Fetch productivity classifications list
  const { data: classifications = [], refetch: refetchClassifications } = useQuery({
    queryKey: ['productivityClassifications'],
    queryFn: api.getProductivityClassifications,
    enabled: classificationsModalVisible
  });

  // 7. Add/Update classification rule mutation
  const classificationMutation = useMutation({
    mutationFn: (payload: { pattern: string; category: string }) => 
      api.createOrUpdateProductivityClassification(payload as any),
    onSuccess: () => {
      message.success('Classification rule saved successfully!');
      ruleForm.resetFields();
      refetchClassifications();
      queryClient.invalidateQueries({ queryKey: ['liveWorkforce'] });
    },
    onError: () => {
      message.error('Failed to save classification rule.');
    }
  });

  // 8. Edit attendance mutation
  const editMutation = useMutation({
    mutationFn: (data: { id: number; payload: any }) => api.updateAttendance(data.id, data.payload),
    onSuccess: () => {
      message.success('Record corrected successfully!');
      queryClient.invalidateQueries({ queryKey: ['attendanceTeam'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceCorrectionRequests'] });
      setModalVisible(false);
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Error updating record.');
    }
  });

  // Reject correction request mutation
  const rejectMutation = useMutation({
    mutationFn: (data: { id: number; remarks?: string }) => api.rejectAttendanceCorrectionRequest(data.id, { remarks: data.remarks }),
    onSuccess: () => {
      message.success('Correction request rejected successfully!');
      queryClient.invalidateQueries({ queryKey: ['attendanceTeam'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceCorrectionRequests'] });
      setModalVisible(false);
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Error rejecting request.');
    }
  });

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'Present':
        return <Tag color="success" style={{ borderRadius: 6 }}>Present</Tag>;
      case 'Late':
        return <Tag color="warning" style={{ borderRadius: 6 }}>Late</Tag>;
      case 'Work From Home':
        return <Tag color="blue" style={{ borderRadius: 6 }}>WFH</Tag>;
      case 'Half Day':
        return <Tag color="orange" style={{ borderRadius: 6 }}>Half Day</Tag>;
      case 'Absent':
        return <Tag color="error" style={{ borderRadius: 6 }}>Absent</Tag>;
      default:
        return <Tag style={{ borderRadius: 6 }}>{status}</Tag>;
    }
  };

  const getLiveStatusTag = (status: string) => {
    switch (status) {
      case 'Active':
        return <Tag color="success" style={{ borderRadius: 6, fontWeight: 'bold' }}><SignalFilled /> Active</Tag>;
      case 'Idle':
        return <Tag color="error" style={{ borderRadius: 6, fontWeight: 'bold' }}>Idle</Tag>;
      case 'Break':
        return <Tag color="warning" style={{ borderRadius: 6, fontWeight: 'bold' }}><CoffeeOutlined /> Break</Tag>;
      default:
        return <Tag style={{ borderRadius: 6, color: '#64748B' }}>Offline</Tag>;
    }
  };

  const handleOpenEditModal = (record: any) => {
    setEditingRecord(record);
    const logDate = dayjs(record.date);
    const checkIn = record.check_in ? dayjs(record.check_in) : null;
    const checkOut = record.check_out ? dayjs(record.check_out) : null;

    form.setFieldsValue({
      status: record.status,
      check_in: checkIn,
      check_out: checkOut,
      remarks: record.remarks || ''
    });
    setModalVisible(true);
  };

  const handleSaveEdit = (values: any) => {
    if (!editingRecord) return;
    const dateStr = editingRecord.date;
    let checkInIso = null;
    let checkOutIso = null;

    if (values.check_in) {
      const timeStr = values.check_in.format('HH:mm:ss');
      checkInIso = `${dateStr}T${timeStr}.000Z`;
    }
    if (values.check_out) {
      const timeStr = values.check_out.format('HH:mm:ss');
      checkOutIso = `${dateStr}T${timeStr}.000Z`;
    }

    if (checkInIso && checkOutIso) {
      const start = new Date(checkInIso);
      const end = new Date(checkOutIso);
      if (end < start) {
        message.error('Clock-out time must be after clock-in time.');
        return;
      }
    }

    editMutation.mutate({
      id: editingRecord.id,
      payload: {
        status: values.status,
        check_in: checkInIso,
        check_out: checkOutIso,
        remarks: values.remarks
      }
    });
  };

  const handleExportCSV = () => {
    const dataToExport = filteredEmployees;
    if (dataToExport.length === 0) {
      message.warning('No telemetry data available to export.');
      return;
    }

    const headers = ['Employee ID', 'Name', 'Designation', 'Status', 'Productivity Score', 'Active Title', 'Active Hours', 'Idle Hours', 'Break Hours', 'Total Logged Hours'];
    const rows = dataToExport.map((emp: any) => [
      emp.employee_id,
      `${emp.first_name} ${emp.last_name}`,
      emp.designation,
      emp.currentStatus,
      `${emp.todayStats?.productivityScore || 0}%`,
      emp.activeWindow || 'None',
      emp.todayStats?.activeHours || 0,
      emp.todayStats?.idleHours || 0,
      emp.todayStats?.breakHours || 0,
      emp.todayStats?.totalHours || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r: any) => r.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Workforce_Live_Telemetry_${dayjs().format('YYYY-MM-DD_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Workforce live telemetry CSV report exported.');
  };

  const handleOpenDetailDrawer = (employeeId: number, firstName: string, lastName: string) => {
    setSelectedEmpId(employeeId);
    setSelectedEmpName(`${firstName} ${lastName}`);
    setDetailDrawerVisible(true);
  };

  const correctionsColumns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_: any, record: any) => {
        const emp = record.employee;
        const hasPendingRequest = correctionRequests.some((c: any) => c.attendance_id === record.id);
        return emp ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600, color: '#0F172A' }}>
                {emp.first_name} {emp.last_name}
              </span>
              {hasPendingRequest && (
                <Tag color="volcano" style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>
                  Requested
                </Tag>
              )}
            </div>
            <div style={{ fontSize: 11, color: '#64748B' }}>
              {emp.employee_id} • {emp.designation}
            </div>
          </div>
        ) : (
          <span style={{ color: '#94A3B8' }}>Unknown</span>
        );
      }
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => <span>{dayjs(text).format('YYYY-MM-DD')}</span>,
      sorter: (a: Attendance, b: Attendance) => a.date.localeCompare(b.date)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
      filters: [
        { text: 'Present', value: 'Present' },
        { text: 'Late', value: 'Late' },
        { text: 'WFH', value: 'Work From Home' },
        { text: 'Half Day', value: 'Half Day' },
        { text: 'Absent', value: 'Absent' }
      ],
      onFilter: (value: any, record: Attendance) => record.status === value
    },
    {
      title: 'Clock In',
      dataIndex: 'check_in',
      key: 'check_in',
      render: (time: string) => time ? dayjs(time).format('hh:mm A') : <span style={{ color: '#94A3B8' }}>--:--</span>
    },
    {
      title: 'Clock Out',
      dataIndex: 'check_out',
      key: 'check_out',
      render: (time: string) => time ? dayjs(time).format('hh:mm A') : <span style={{ color: '#94A3B8' }}>--:--</span>
    },
    {
      title: 'Hours Worked',
      dataIndex: 'working_hours',
      key: 'working_hours',
      render: (hours: number) => hours ? <span style={{ fontWeight: 500 }}>{hours} hrs</span> : <span style={{ color: '#94A3B8' }}>--</span>
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (text: string) => text ? <span style={{ color: '#475569', fontSize: 12 }}>{text}</span> : <span style={{ color: '#94A3B8' }}>--</span>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          icon={<EditOutlined style={{ color: '#10B981' }} />} 
          onClick={() => handleOpenEditModal(record)}
        >
          Edit
        </Button>
      )
    }
  ];

  const liveStats = liveWorkforce?.stats || { total: 0, active: 0, idle: 0, break: 0, offline: 0 };
  const liveEmployees = liveWorkforce?.employees || [];

  // Filter employees locally for fast real-time searching
  const filteredEmployees = liveEmployees.filter((emp: any) => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) || 
                          emp.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (emp.activeWindow && emp.activeWindow.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'All' || emp.currentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* SEGMENTED TAB SWITCHER & MAIN CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Segmented
          options={[
            { label: 'Live Workforce Monitor', value: 'live', icon: <DesktopOutlined /> },
            { label: 'Shift Corrections Ledger', value: 'corrections', icon: <TeamOutlined /> }
          ]}
          value={activeTab}
          onChange={(val: any) => setActiveTab(val)}
          size="large"
          style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        />
        
        <Space size={10} style={{ display: 'flex', alignItems: 'center' }}>
          {activeTab === 'live' && (
            <>
              <Button 
                icon={<SettingOutlined />} 
                onClick={() => setClassificationsModalVisible(true)}
                style={{ borderRadius: 8, fontWeight: 500 }}
              >
                Classifications
              </Button>
              <Button 
                type="primary"
                icon={<DownloadOutlined />} 
                onClick={handleExportCSV}
                style={{ borderRadius: 8, fontWeight: 500, backgroundColor: '#0284C7', borderColor: '#0284C7' }}
              >
                Export CSV
              </Button>
              <Button 
                icon={<ReloadOutlined spin={isLiveLoading} />} 
                onClick={() => { refetchLive(); message.success('Live telemetry data updated.'); }}
                style={{ borderRadius: 8 }}
              />
            </>
          )}
          
          <Select
            placeholder="All Departments"
            style={{ width: 220 }}
            allowClear
            value={selectedDept}
            onChange={(val) => setSelectedDept(val)}
          >
            {departments?.map((dept: any) => (
              <Option key={dept.id} value={dept.id}>{dept.name}</Option>
            ))}
          </Select>
        </Space>
      </div>

      {activeTab === 'live' ? (
        <>
          {/* LIVE METRICS & COMPLIANCE SUMMARY */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 1 20%' }}>
              <Card 
                size="small" 
                hoverable
                style={{ 
                  borderRadius: 12, 
                  textAlign: 'center', 
                  borderLeft: '4px solid #3B82F6', 
                  background: '#FFFFFF',
                  transition: 'all 0.3s ease'
                }}
              >
                <Statistic title={<Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>MANAGED STAFF</Text>} value={liveStats.total} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 1 20%' }}>
              <Card 
                size="small" 
                hoverable
                style={{ 
                  borderRadius: 12, 
                  textAlign: 'center', 
                  borderLeft: '4px solid #10B981', 
                  background: '#F0FDF4',
                  transition: 'all 0.3s ease'
                }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 11, fontWeight: 600, color: '#16A34A' }}>ACTIVE NOW</Text>} 
                  value={liveStats.active} 
                  valueStyle={{ color: '#16A34A' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 1 20%' }}>
              <Card 
                size="small" 
                hoverable
                style={{ 
                  borderRadius: 12, 
                  textAlign: 'center', 
                  borderLeft: '4px solid #EF4444', 
                  background: '#FEF2F2',
                  transition: 'all 0.3s ease'
                }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 11, fontWeight: 600, color: '#DC2626' }}>IDLE STAFF</Text>} 
                  value={liveStats.idle} 
                  valueStyle={{ color: '#DC2626' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 1 20%' }}>
              <Card 
                size="small" 
                hoverable
                style={{ 
                  borderRadius: 12, 
                  textAlign: 'center', 
                  borderLeft: '4px solid #F59E0B', 
                  background: '#FFFBEB',
                  transition: 'all 0.3s ease'
                }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>ON BREAK</Text>} 
                  value={liveStats.break} 
                  valueStyle={{ color: '#D97706' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4.8} style={{ flex: '1 1 20%' }}>
              <Card 
                size="small" 
                hoverable
                style={{ 
                  borderRadius: 12, 
                  textAlign: 'center', 
                  borderLeft: '4px solid #8B5CF6', 
                  background: '#FAF5FF',
                  transition: 'all 0.3s ease'
                }}
              >
                <Statistic 
                  title={<Text style={{ fontSize: 11, fontWeight: 600, color: '#7C3AED' }}>COMPLIANCE RATE</Text>} 
                  value={liveStats.total > 0 ? Math.round(((liveStats.total - liveStats.offline) / liveStats.total) * 100) : 0} 
                  suffix="%"
                  valueStyle={{ color: '#7C3AED' }}
                />
              </Card>
            </Col>
          </Row>

          {/* TWO-COLUMN COMMAND CENTER LAYOUT */}
          <Row gutter={[16, 16]}>
            {/* Left Column: Live Monitor Grid */}
            <Col xs={24} xl={16}>
              <Card 
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: '#0F172A' }}><DesktopOutlined /> Live Telemetry Feed ({filteredEmployees.length})</span>
                    <Space>
                      <Input 
                        placeholder="Search employee, app..." 
                        prefix={<SearchOutlined />} 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: 220, borderRadius: 8 }}
                        allowClear
                      />
                      <Select 
                        value={statusFilter} 
                        onChange={setStatusFilter} 
                        style={{ width: 120 }}
                        dropdownStyle={{ borderRadius: 8 }}
                      >
                        <Option value="All">All Statuses</Option>
                        <Option value="Active">Active</Option>
                        <Option value="Idle">Idle</Option>
                        <Option value="Break">Break</Option>
                        <Option value="Offline">Offline</Option>
                      </Select>
                      <Segmented
                        options={[
                          { value: 'grid', icon: <AppstoreOutlined /> },
                          { value: 'table', icon: <UnorderedListOutlined /> }
                        ]}
                        value={viewMode}
                        onChange={(val: any) => setViewMode(val)}
                        style={{ borderRadius: 6 }}
                      />
                    </Space>
                  </div>
                }
                bordered={false} 
                style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)', minHeight: 650 }}
              >
                {viewMode === 'grid' ? (
                  <Row gutter={[16, 16]}>
                    {filteredEmployees.map((rec: any) => {
                      const avatarUrl = rec.avatar_url ? `${API_URL.replace('/api', '')}/${rec.avatar_url}` : undefined;
                      const score = rec.todayStats?.productivityScore || 0;
                      const statusColor = rec.currentStatus === 'Active' ? '#10B981' : rec.currentStatus === 'Idle' ? '#EF4444' : rec.currentStatus === 'Break' ? '#F59E0B' : '#94A3B8';
                      return (
                        <Col xs={24} sm={12} md={12} lg={8} key={rec.id}>
                          <Card 
                            hoverable 
                            onClick={() => handleOpenDetailDrawer(rec.id, rec.first_name, rec.last_name)}
                            bodyStyle={{ padding: 16 }}
                            style={{ 
                              borderRadius: 14, 
                              border: '1px solid #E2E8F0', 
                              boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                              position: 'relative'
                            }}
                          >
                            {/* Online Badge status */}
                            <div style={{ position: 'absolute', top: 12, right: 12 }}>
                              <Badge color={statusColor} text={<span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{rec.currentStatus}</span>} />
                            </div>

                            <Space align="start" size={12} style={{ width: '100%', marginBottom: 12 }}>
                              <Avatar size={48} src={avatarUrl} icon={<UserOutlined />} style={{ backgroundColor: '#F3F4F6', border: `2px solid ${statusColor}` }} />
                              <div style={{ maxWidth: 140 }}>
                                <Text strong style={{ fontSize: 14, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                  {rec.first_name} {rec.last_name}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{rec.designation}</Text>
                              </div>
                            </Space>

                            <Divider style={{ margin: '8px 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <div>
                                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>CURRENT ACTIVITY</Text>
                                <Tooltip title={rec.activeWindow || 'None'}>
                                  <Text code style={{ fontSize: 11, maxWidth: 150, display: 'inline-block' }} ellipsis>
                                    {rec.activeWindow || 'Idle / Offline'}
                                  </Text>
                                </Tooltip>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>PRODUCTIVITY</Text>
                                <Tag color={score > 70 ? 'success' : score > 40 ? 'warning' : 'error'} style={{ fontWeight: 'bold', margin: 0, borderRadius: 4 }}>
                                  {score}%
                                </Tag>
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 8, borderRadius: 8 }}>
                              <div>
                                <Text type="secondary" style={{ fontSize: 9, display: 'block' }}>ACTIVE</Text>
                                <Text strong style={{ fontSize: 12, color: '#16A34A' }}>{rec.todayStats?.activeHours?.toFixed(1) || 0} hrs</Text>
                              </div>
                              <div>
                                <Text type="secondary" style={{ fontSize: 9, display: 'block' }}>IDLE</Text>
                                <Text strong style={{ fontSize: 12, color: '#DC2626' }}>{rec.todayStats?.idleHours?.toFixed(1) || 0} hrs</Text>
                              </div>
                              <div>
                                <Text type="secondary" style={{ fontSize: 9, display: 'block' }}>BREAK</Text>
                                <Text strong style={{ fontSize: 12, color: '#D97706' }}>{rec.todayStats?.breakHours?.toFixed(1) || 0} hrs</Text>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      );
                    })}
                    {filteredEmployees.length === 0 && (
                      <Col span={24} style={{ textAlign: 'center', padding: '60px 0' }}>
                        <Text type="secondary">No managed staff matching your search criteria.</Text>
                      </Col>
                    )}
                  </Row>
                ) : (
                  <Table
                    loading={isLiveLoading}
                    dataSource={filteredEmployees}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="middle"
                    onRow={(record: any) => ({
                      onClick: () => handleOpenDetailDrawer(record.id, record.first_name, record.last_name),
                      style: { cursor: 'pointer' }
                    })}
                    columns={[
                      {
                        title: 'Employee',
                        key: 'name',
                        render: (_, rec: any) => {
                          const avatarUrl = rec.avatar_url ? `${API_URL.replace('/api', '')}/${rec.avatar_url}` : undefined;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar src={avatarUrl} icon={<UserOutlined />} style={{ backgroundColor: '#3B82F6' }} />
                              <div>
                                <Text strong style={{ display: 'block', fontSize: 13 }}>{rec.first_name} {rec.last_name}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>{rec.designation}</Text>
                              </div>
                            </div>
                          );
                        }
                      },
                      {
                        title: 'Status',
                        dataIndex: 'currentStatus',
                        key: 'status',
                        width: 110,
                        render: (status) => getLiveStatusTag(status)
                      },
                      {
                        title: 'Active App/Window',
                        dataIndex: 'activeWindow',
                        key: 'activeWindow',
                        ellipsis: true,
                        render: (w) => w ? (
                          <Tooltip title={w}>
                            <Text code style={{ fontSize: 11, maxWidth: 180, display: 'inline-block' }} ellipsis>{w}</Text>
                          </Tooltip>
                        ) : <span style={{ color: '#94A3B8', fontSize: 11 }}>--</span>
                      },
                      {
                        title: 'Productivity',
                        dataIndex: ['todayStats', 'productivityScore'],
                        key: 'productivity',
                        width: 140,
                        render: (score) => (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                              <Text style={{ fontSize: 11, fontWeight: 'bold' }}>{score}%</Text>
                            </div>
                            <Progress percent={score} size="small" strokeColor={score > 70 ? '#10B981' : score > 40 ? '#F59E0B' : '#EF4444'} showInfo={false} />
                          </div>
                        )
                      },
                      {
                        title: 'Today Tracker',
                        key: 'telemetry',
                        width: 180,
                        render: (_, rec: any) => (
                          <div style={{ fontSize: 11, display: 'flex', gap: 8 }}>
                            <span>Act: <strong style={{ color: '#16A34A' }}>{rec.todayStats.activeHours.toFixed(1)}h</strong></span>
                            <span>Idle: <strong style={{ color: '#DC2626' }}>{rec.todayStats.idleHours.toFixed(1)}h</strong></span>
                            <span>Break: <strong style={{ color: '#D97706' }}>{rec.todayStats.breakHours.toFixed(1)}h</strong></span>
                          </div>
                        )
                      }
                    ]}
                  />
                )}
              </Card>
            </Col>

            {/* Right Column: Alerts Panel & Productivity Rankings */}
            <Col xs={24} xl={8} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Telemetry Smart Alerts Widget */}
              <Card 
                title={<span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}><ThunderboltOutlined style={{ color: '#EF4444' }} /> Smart Violations Feed</span>}
                bordered={false}
                bodyStyle={{ padding: '12px 16px', maxHeight: 300, overflowY: 'auto' }}
                style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
              >
                {liveWorkforce?.alerts && liveWorkforce.alerts.length > 0 ? (
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {liveWorkforce.alerts.map((alert: any) => (
                      <div 
                        key={alert.id}
                        style={{
                          background: alert.severity === 'error' ? '#FEF2F2' : alert.severity === 'warning' ? '#FFFBEB' : '#F0FDF4',
                          border: `1px solid ${alert.severity === 'error' ? '#FEE2E2' : alert.severity === 'warning' ? '#FEF3C7' : '#DCFCE7'}`,
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 12
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text strong style={{ color: alert.severity === 'error' ? '#991B1B' : alert.severity === 'warning' ? '#92400E' : '#15803D' }}>
                            {alert.type.replace('_', ' ')}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {dayjs(alert.timestamp).format('hh:mm A')}
                          </Text>
                        </div>
                        <Text style={{ color: '#334155' }}>{alert.message}</Text>
                      </div>
                    ))}
                  </Space>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>No telemetry violations or anomalies detected today.</Text>
                  </div>
                )}
              </Card>

              {/* Productivity Leaderboard rankings */}
              <Card 
                title={<span style={{ fontWeight: 700, fontSize: 15, color: '#0F172A' }}><SignalFilled style={{ color: '#3B82F6' }} /> Productivity Rankings</span>}
                bordered={false}
                bodyStyle={{ padding: '12px 16px' }}
                style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)' }}
              >
                {liveEmployees.length > 0 ? (
                  <div>
                    {/* Top Performer */}
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🔥 Top Performers
                    </Text>
                    <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size={8}>
                      {[...liveEmployees]
                        .sort((a, b) => b.todayStats.productivityScore - a.todayStats.productivityScore)
                        .slice(0, 2)
                        .map((emp, idx) => (
                          <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                            <Space size={8}>
                              <Avatar size="small" style={{ backgroundColor: '#10B981', fontSize: 10 }}>#{idx+1}</Avatar>
                              <Text strong style={{ fontSize: 12 }}>{emp.first_name} {emp.last_name}</Text>
                            </Space>
                            <Tag color="success" style={{ fontWeight: 'bold', borderRadius: 4 }}>
                              {emp.todayStats.productivityScore}%
                            </Tag>
                          </div>
                        ))}
                    </Space>

                    {/* Bottom Performer */}
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ⚠️ Needs Attention
                    </Text>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      {[...liveEmployees]
                        .filter(e => e.currentStatus !== 'Offline')
                        .sort((a, b) => a.todayStats.productivityScore - b.todayStats.productivityScore)
                        .slice(0, 2)
                        .map((emp) => (
                          <div key={emp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                            <Space size={8}>
                              <Avatar size="small" style={{ backgroundColor: '#EF4444', fontSize: 10 }}>!</Avatar>
                              <Text strong style={{ fontSize: 12 }}>{emp.first_name} {emp.last_name}</Text>
                            </Space>
                            <Tag color="error" style={{ fontWeight: 'bold', borderRadius: 4 }}>
                              {emp.todayStats.productivityScore}%
                            </Tag>
                          </div>
                        ))}
                      {[...liveEmployees].filter(e => e.currentStatus !== 'Offline').length === 0 && (
                        <Text type="secondary" style={{ fontSize: 11, textAlign: 'center', display: 'block' }}>No online staff to rank.</Text>
                      )}
                    </Space>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#94A3B8' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>No employee logs recorded today.</Text>
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <>
          {/* FILTER PANEL */}
          <Card 
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
          >
            <Space size={16} wrap style={{ width: '100%' }}>
              <Space>
                <FilterOutlined style={{ color: '#64748B' }} />
                <span style={{ fontWeight: 500, color: '#475569' }}>Filters</span>
              </Space>

              <DatePicker.RangePicker
                onChange={(dates) => {
                  if (dates) {
                    setStartDate(dates[0]?.format('YYYY-MM-DD'));
                    setEndDate(dates[1]?.format('YYYY-MM-DD'));
                  } else {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }
                }}
                style={{ borderRadius: 8 }}
              />
            </Space>
          </Card>

          {/* TEAM LIST TABLE */}
          <Card
            bordered={false}
            title={<span style={{ fontWeight: 600 }}><TeamOutlined /> Team Shift Corrections Ledger</span>}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
          >
            <Table
              columns={correctionsColumns}
              dataSource={teamLogs}
              rowKey="id"
              loading={isLoading}
              pagination={{ pageSize: 15, showSizeChanger: true }}
              style={{ borderRadius: 8 }}
            />
          </Card>
        </>
      )}

      {/* DETAILED TELEMETRY DRAWER */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}><DashboardOutlined /> {selectedEmpName} - Daily Telemetry Analytics</span>
            <Tag color="blue">{dayjs().format('MMMM DD, YYYY')}</Tag>
          </div>
        }
        placement="right"
        width={750}
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        destroyOnClose
        bodyStyle={{ padding: 24, backgroundColor: '#F8FAFC' }}
      >
        {isDetailsLoading ? (
          <div style={{ textAlign: 'center', padding: '100px 0' }}>
            <ReloadOutlined spin style={{ fontSize: 32, color: '#3B82F6', marginBottom: 16 }} />
            <div>Loading granular telemetry intelligence...</div>
          </div>
        ) : prodDetails ? (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            {/* Top Stat Gauges */}
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card bodyStyle={{ padding: 12, textAlign: 'center' }} style={{ borderRadius: 12 }}>
                  <Progress 
                    type="circle" 
                    percent={prodDetails.productivityScore} 
                    width={70} 
                    strokeColor="#10B981" 
                  />
                  <div style={{ fontWeight: 600, fontSize: 12, marginTop: 8 }}>Productivity</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card bodyStyle={{ padding: 12, textAlign: 'center' }} style={{ borderRadius: 12 }}>
                  <Progress 
                    type="circle" 
                    percent={prodDetails.focusScore} 
                    width={70} 
                    strokeColor="#3B82F6" 
                  />
                  <div style={{ fontWeight: 600, fontSize: 12, marginTop: 8 }}>Focus Score</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card bodyStyle={{ padding: 12, textAlign: 'center' }} style={{ borderRadius: 12 }}>
                  <Progress 
                    type="circle" 
                    percent={prodDetails.deepWorkScore} 
                    width={70} 
                    strokeColor="#8B5CF6" 
                  />
                  <div style={{ fontWeight: 600, fontSize: 12, marginTop: 8 }}>Deep Work</div>
                </Card>
              </Col>
              <Col span={6}>
                <Card bodyStyle={{ padding: 12, textAlign: 'center' }} style={{ borderRadius: 12 }}>
                  <Progress 
                    type="circle" 
                    percent={prodDetails.efficiencyScore} 
                    width={70} 
                    strokeColor="#EC4899" 
                  />
                  <div style={{ fontWeight: 600, fontSize: 12, marginTop: 8 }}>Efficiency</div>
                </Card>
              </Col>
            </Row>

            {/* SVGs Timeline Visualization */}
            <Card 
              title={<span style={{ fontSize: 14, fontWeight: 700 }}><FieldTimeOutlined /> Dynamic Activity Timeline</span>}
              style={{ borderRadius: 12 }}
            >
              {prodDetails.timeline && prodDetails.timeline.length > 0 ? (
                <div>
                  <div style={{ display: 'flex', gap: 2, height: 32, width: '100%', borderRadius: 6, overflow: 'hidden', backgroundColor: '#E2E8F0' }}>
                    {prodDetails.timeline.map((item: any, idx: number) => {
                      const color = item.status === 'Active' ? '#10B981' : item.status === 'Idle' ? '#EF4444' : '#F59E0B';
                      const timeString = `${dayjs(item.start).format('hh:mm A')} - ${dayjs(item.end).format('hh:mm A')}`;
                      return (
                        <Tooltip 
                          key={idx} 
                          title={
                            <div style={{ fontSize: 11 }}>
                              <strong>{timeString}</strong><br/>
                              <span>Status: {item.status}</span><br/>
                              {item.app && <span>App: {item.app}</span>}<br/>
                              {item.website && <span>Site: {item.website}</span>}<br/>
                              <span>Actions: {item.inputs} inputs</span>
                            </div>
                          }
                        >
                          <div style={{ flex: 1, backgroundColor: color, cursor: 'pointer', transition: 'transform 0.1s' }} />
                        </Tooltip>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginTop: 8 }}>
                    <span>{dayjs(prodDetails.timeline[0].start).format('hh:mm A')}</span>
                    <span>Midday</span>
                    <span>{dayjs(prodDetails.timeline[prodDetails.timeline.length - 1].end).format('hh:mm A')}</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94A3B8', padding: '16px 0' }}>No timeline data recorded yet.</div>
              )}
            </Card>

            {/* Productivity Heatmap */}
            <Card 
              title={<span style={{ fontSize: 14, fontWeight: 700 }}><SignalFilled /> Productivity Density Heatmap (Hourly)</span>}
              style={{ borderRadius: 12 }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 8, textAlign: 'center' }}>
                {prodDetails.heatmap && prodDetails.heatmap.map((score: number, hr: number) => {
                  let bgColor = '#F1F5F9';
                  let textColor = '#64748B';
                  if (score > 75) { bgColor = '#DCFCE7'; textColor = '#15803D'; }
                  else if (score > 45) { bgColor = '#FEF3C7'; textColor = '#92400E'; }
                  else if (score > 0) { bgColor = '#FEE2E2'; textColor = '#B91C1C'; }
                  
                  const label = hr === 0 ? '12am' : hr === 12 ? '12pm' : hr > 12 ? `${hr-12}pm` : `${hr}am`;
                  
                  return (
                    <Tooltip key={hr} title={`Hour: ${label} | Productive Density: ${score}%`}>
                      <div style={{ 
                        background: bgColor, 
                        color: textColor, 
                        padding: '8px 4px', 
                        borderRadius: 6, 
                        border: '1px solid #E2E8F0',
                        fontSize: 11
                      }}>
                        <div style={{ fontWeight: 600 }}>{score}%</div>
                        <div style={{ fontSize: 9, color: '#94A3B8' }}>{label}</div>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </Card>

            {/* App & Website Listings */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title={<span style={{ fontSize: 13, fontWeight: 700 }}>Top Applications</span>} style={{ borderRadius: 12 }}>
                  <List
                    size="small"
                    dataSource={Object.entries(prodDetails.appUsage || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5)}
                    renderItem={([app, hours]: any) => (
                      <List.Item style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <Text ellipsis style={{ maxWidth: 200, fontSize: 12 }}><span style={{ fontFamily: 'monospace' }}>{app}</span></Text>
                        <Tag color="cyan">{hours.toFixed(1)} hrs</Tag>
                      </List.Item>
                    )}
                  />
                  {Object.keys(prodDetails.appUsage || {}).length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94A3B8', padding: '16px 0', fontSize: 12 }}>No apps tracked.</div>
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card title={<span style={{ fontSize: 13, fontWeight: 700 }}>Top Visited Websites</span>} style={{ borderRadius: 12 }}>
                  <List
                    size="small"
                    dataSource={Object.entries(prodDetails.webUsage || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5)}
                    renderItem={([domain, hours]: any) => (
                      <List.Item style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                        <Text ellipsis style={{ maxWidth: 200, fontSize: 12 }}><span style={{ fontFamily: 'monospace' }}>{domain}</span></Text>
                        <Tag color="blue">{hours.toFixed(1)} hrs</Tag>
                      </List.Item>
                    )}
                  />
                  {Object.keys(prodDetails.webUsage || {}).length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94A3B8', padding: '16px 0', fontSize: 12 }}>No websites tracked.</div>
                  )}
                </Card>
              </Col>
            </Row>

            {/* Smart Diagnostics Insights */}
            <Card 
              title={<span style={{ fontSize: 14, fontWeight: 700 }}><ThunderboltOutlined style={{ color: '#F59E0B' }} /> Telemetry Suggestion & Coaching Feed</span>}
              style={{ borderRadius: 12 }}
            >
              {prodDetails.insights && prodDetails.insights.length > 0 ? (
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {prodDetails.insights.map((insight: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: 8, color: '#334155', fontSize: 12 }}>{insight}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: '#16A34A', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircleOutlined /> Active, focused workday verified. No coaching suggestions triggered.
                </div>
              )}
            </Card>
          </Space>
        ) : (
          <div style={{ textAlign: 'center', padding: '100px 0', color: '#94A3B8' }}>No metrics payload returned.</div>
        )}
      </Drawer>

      {/* CLASSIFICATIONS RULES MANAGER MODAL */}
      <Modal
        title={<span style={{ fontWeight: 700 }}><SettingOutlined /> Productivity Classification Manager</span>}
        open={classificationsModalVisible}
        onCancel={() => setClassificationsModalVisible(false)}
        footer={null}
        width={650}
        destroyOnClose
      >
        <div style={{ marginTop: 16 }}>
          <Form 
            form={ruleForm} 
            layout="inline" 
            onFinish={(values) => classificationMutation.mutate(values)}
            style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}
          >
            <Form.Item 
              name="pattern" 
              rules={[{ required: true, message: 'Specify domain/app keyword' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="Pattern (e.g. stackoverflow.com, spotify.exe)" />
            </Form.Item>
            <Form.Item 
              name="category" 
              rules={[{ required: true, message: 'Select category' }]}
            >
              <Select placeholder="Category" style={{ width: 140 }}>
                <Option value="Productive">Productive</Option>
                <Option value="Neutral">Neutral</Option>
                <Option value="Unproductive">Unproductive</Option>
              </Select>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={classificationMutation.isPending}>
                Add Rule
              </Button>
            </Form.Item>
          </Form>

          <Table
            dataSource={classifications}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            columns={[
              {
                title: 'Pattern Key',
                dataIndex: 'pattern',
                key: 'pattern',
                render: (val) => <code style={{ fontSize: 12 }}>{val}</code>
              },
              {
                title: 'Category',
                dataIndex: 'category',
                key: 'category',
                render: (cat) => {
                  let color = 'blue';
                  if (cat === 'Productive') color = 'green';
                  else if (cat === 'Unproductive') color = 'red';
                  return <Tag color={color} style={{ fontWeight: 600 }}>{cat}</Tag>;
                }
              },
              {
                title: 'Date Modified',
                dataIndex: 'updated_at',
                key: 'updated_at',
                render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm')
              }
            ]}
          />
        </div>
      </Modal>

      {/* EDIT SHIFT CORRECTIONS MODAL */}
      <Modal
        title={<span style={{ fontWeight: 600 }}>Correct Attendance Entry</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        {editingRecord && (() => {
          const pendingRequest = correctionRequests.find((c: any) => c.attendance_id === editingRecord.id);
          return (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSaveEdit}
              style={{ marginTop: 16 }}
            >
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Employee: </Text>
                <Text strong style={{ fontSize: 14 }}>
                  {editingRecord.employee?.first_name} {editingRecord.employee?.last_name}
                </Text>
                <div>
                  <Text type="secondary">Date: </Text>
                  <Text strong>{editingRecord.date}</Text>
                </div>
              </div>

              {pendingRequest && (
                <Alert
                  message="Employee Correction Request"
                  description={
                    <div style={{ marginTop: 4, fontSize: 13 }}>
                      <div><strong>Requested Status:</strong> {pendingRequest.requested_status}</div>
                      <div>
                        <strong>Requested Times:</strong>{' '}
                        {pendingRequest.requested_check_in 
                          ? dayjs(pendingRequest.requested_check_in).format('hh:mm A') 
                          : '--:--'}{' '}
                        to{' '}
                        {pendingRequest.requested_check_out 
                          ? dayjs(pendingRequest.requested_check_out).format('hh:mm A') 
                          : '--:--'}
                      </div>
                      <div><strong>Reason:</strong> {pendingRequest.reason}</div>
                    </div>
                  }
                  type="warning"
                  showIcon
                  style={{ borderRadius: 8, marginBottom: 16 }}
                />
              )}

              <Divider style={{ margin: '12px 0' }} />

              <Form.Item 
                label="Shift Status" 
                name="status"
                rules={[{ required: true, message: 'Please select a status' }]}
              >
                <Select placeholder="Select Status">
                  <Option value="Present">Present</Option>
                  <Option value="Late">Late</Option>
                  <Option value="Work From Home">Work From Home</Option>
                  <Option value="Half Day">Half Day</Option>
                  <Option value="Absent">Absent</Option>
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Check In Time" name="check_in">
                    <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Check Out Time" name="check_out">
                    <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item 
                label="Audit Correction Remarks" 
                name="remarks"
                rules={[{ required: true, message: 'Please provide adjustment remarks' }]}
              >
                <TextArea rows={3} placeholder="Provide audit trail comment..." style={{ borderRadius: 8 }} />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  {pendingRequest && (
                    <Button 
                      danger 
                      loading={rejectMutation.isPending}
                      onClick={() => {
                        Modal.confirm({
                          title: 'Reject Correction Request',
                          content: (
                            <div>
                              <p>Are you sure you want to reject this correction request?</p>
                              <Input.TextArea 
                                id="rejectRemarks" 
                                placeholder="Optional rejection remarks..." 
                                rows={3} 
                                style={{ marginTop: 8 }}
                              />
                            </div>
                          ),
                          onOk: () => {
                            const remarksVal = (document.getElementById('rejectRemarks') as HTMLTextAreaElement)?.value || '';
                            rejectMutation.mutate({ id: pendingRequest.id, remarks: remarksVal });
                          }
                        });
                      }}
                      style={{ borderRadius: 6 }}
                    >
                      Reject Request
                    </Button>
                  )}
                  <Button onClick={() => setModalVisible(false)} style={{ borderRadius: 6 }}>
                    Cancel
                  </Button>
                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    loading={editMutation.isPending}
                    style={{ borderRadius: 6, background: '#10B981', borderColor: '#10B981' }}
                  >
                    Save Adjustments
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          );
        })()}
      </Modal>
    </div>
  );
};
