import React, { useState } from 'react';
import { Table, Card, Tag, Button, Drawer, Typography, Alert, Form, DatePicker, TimePicker, Input, Space, Divider, message, Row, Col, Progress, Timeline as AntdTimeline, Badge, Tooltip as AntdTooltip } from 'antd';
import { HistoryOutlined, FormOutlined, CopyOutlined, InfoCircleOutlined, ThunderboltOutlined, ClockCircleOutlined, CoffeeOutlined, AlertOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import api from '../../services/api';
import { Attendance } from '../../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const AttendanceLogs: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [generatedText, setGeneratedText] = useState<string>('');
  const [form] = Form.useForm();
  
  // Selected date for daily timeline view
  const [timelineDate, setTimelineDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  // Fetch personal logs history
  const { data: historyLogs, isLoading } = useQuery<Attendance[]>({
    queryKey: ['attendanceHistory'],
    queryFn: api.getAttendanceHistory
  });

  // Fetch productivity details
  const { data: productivity, isLoading: isProdLoading } = useQuery({
    queryKey: ['productivityDetails', timelineDate],
    queryFn: () => api.getProductivityDetails({ date: timelineDate }),
    enabled: !!timelineDate
  });

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'Present':
        return <Tag color="success" style={{ borderRadius: 6, fontWeight: 500 }}>Present</Tag>;
      case 'Late':
        return <Tag color="warning" style={{ borderRadius: 6, fontWeight: 500 }}>Late</Tag>;
      case 'Work From Home':
        return <Tag color="blue" style={{ borderRadius: 6, fontWeight: 500 }}>WFH</Tag>;
      case 'Half Day':
        return <Tag color="orange" style={{ borderRadius: 6, fontWeight: 500 }}>Half Day</Tag>;
      case 'Absent':
        return <Tag color="error" style={{ borderRadius: 6, fontWeight: 500 }}>Absent</Tag>;
      default:
        return <Tag style={{ borderRadius: 6, fontWeight: 500 }}>{status}</Tag>;
    }
  };

  const handleOpenCorrection = (record: Attendance) => {
    setSelectedRecord(record);
    form.setFieldsValue({
      date: dayjs(record.date),
      status: record.status,
      check_in: record.check_in ? dayjs(record.check_in) : null,
      check_out: record.check_out ? dayjs(record.check_out) : null,
      reason: ''
    });
    setGeneratedText('');
    setDrawerVisible(true);
  };

  const handleGenerateRequest = async (values: any) => {
    if (!selectedRecord) return;
    try {
      const dateStr = values.date.format('YYYY-MM-DD');
      const checkInIso = values.check_in ? `${dateStr}T${values.check_in.format('HH:mm:ss')}.000Z` : null;
      const checkOutIso = values.check_out ? `${dateStr}T${values.check_out.format('HH:mm:ss')}.000Z` : null;

      await api.submitAttendanceCorrectionRequest(selectedRecord.id, {
        requested_status: values.status,
        requested_check_in: checkInIso,
        requested_check_out: checkOutIso,
        reason: values.reason
      });

      message.success('Correction request submitted to database successfully!');

      const checkInStr = values.check_in ? values.check_in.format('hh:mm A') : 'N/A';
      const checkOutStr = values.check_out ? values.check_out.format('hh:mm A') : 'N/A';
      
      const requestText = `Hi Team,
 
I am requesting an attendance log correction for ${dateStr}.
• Original Status: ${selectedRecord?.status}
• Requested Status: ${values.status}
• Corrected Times: Check-in at ${checkInStr} | Check-out at ${checkOutStr}
• Reason for Adjustment: ${values.reason || 'Not specified'}
 
Please adjust my log from the Attendance Manager Correction Board at your earliest convenience.
 
Best regards,`;
      
      setGeneratedText(requestText);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error submitting correction request.');
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(generatedText);
    message.success('Correction request copied to clipboard!');
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => (
        <Button 
          type="link" 
          onClick={() => setTimelineDate(text)} 
          style={{ padding: 0, fontWeight: 500 }}
        >
          {dayjs(text).format('ddd, MMM DD, YYYY')}
        </Button>
      ),
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
      render: (text: string) => text ? <span style={{ color: '#475569', fontSize: 13 }}>{text}</span> : <span style={{ color: '#94A3B8', fontSize: 12 }}>None</span>
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Attendance) => (
        <Button 
          type="link" 
          icon={<FormOutlined />} 
          style={{ padding: 0 }}
          onClick={() => handleOpenCorrection(record)}
        >
          Correction
        </Button>
      )
    }
  ];

  // Fetch user tasks to overlay task activity
  const { data: userTasks } = useQuery({
    queryKey: ['userTasksDone'],
    queryFn: () => api.getTasks({ status: 'Done' })
  });

  // Helper to color heartbeat timeline segments
  const getTimelineBar = () => {
    const completedTasksToday = userTasks?.filter((t: any) => t.updated_at && t.updated_at.split('T')[0] === timelineDate) || [];

    if (!productivity || !productivity.heartbeats || productivity.heartbeats.length === 0) {
      return (
        <div style={{ marginTop: 12 }}>
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#94A3B8', background: '#F8FAFC', borderRadius: 8 }}>
            No telemetry/heartbeats logged for this date.
          </div>
          {completedTasksToday.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 8 }}>Task Completions Today:</Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {completedTasksToday.map((task: any) => (
                  <Tag key={task.id} color="success" style={{ borderRadius: 4, width: '100%', padding: '4px 8px' }}>
                    ✅ {task.title}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden', background: '#E2E8F0', marginBottom: 12 }}>
          {productivity.heartbeats.map((h: any, idx: number) => {
            let color = '#10B981'; // Active
            if (h.status === 'Idle') color = '#EF4444';
            else if (h.status === 'Break') color = '#F59E0B';
            return (
              <AntdTooltip key={h.id || idx} title={`${dayjs(h.timestamp).format('hh:mm A')} - ${h.status}. Window: ${h.active_window || 'N/A'}`}>
                <div style={{ flex: 1, backgroundColor: color, borderRight: '1px solid rgba(255,255,255,0.1)' }} />
              </AntdTooltip>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
          <span>{dayjs(productivity.heartbeats[0].timestamp).format('hh:mm A')}</span>
          <span>Timeline View ({productivity.heartbeats.length} pings)</span>
          <span>{dayjs(productivity.heartbeats[productivity.heartbeats.length - 1].timestamp).format('hh:mm A')}</span>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
          <Space><Badge color="#10B981" />Active</Space>
          <Space><Badge color="#EF4444" />Idle</Space>
          <Space><Badge color="#F59E0B" />Break</Space>
        </div>

        {/* Task Activity Overlay */}
        {completedTasksToday.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px dashed #E2E8F0', paddingTop: 12 }}>
            <Text strong style={{ fontSize: 12, color: '#475569', display: 'block', marginBottom: 8 }}>
              🚀 Task Completions on Timeline:
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              {completedTasksToday.map((task: any) => (
                <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#F0FDF4', border: '1px solid #DCFCE7', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
                  <Text strong>{task.title}</Text>
                  <Text type="secondary">{dayjs(task.updated_at).format('hh:mm A')}</Text>
                </div>
              ))}
            </Space>
          </div>
        )}
      </div>
    );
  };

  const prodSummary = productivity?.summary || {
    activeHours: 0,
    idleHours: 0,
    breakHours: 0,
    productivityScore: 100
  };

  const weeklyData = productivity?.weeklySummary?.map((d: any) => ({
    name: dayjs(d.date).format('ddd'),
    'Active Hours': d.activeHours,
    'Idle Hours': d.idleHours,
    'Break Hours': d.breakHours
  })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* REAL-TIME PRODUCTIVITY CHARTS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card 
            bordered={false} 
            title={<span style={{ fontWeight: 600 }}><ThunderboltOutlined /> Daily Activity Timeline ({dayjs(timelineDate).format('MMM DD, YYYY')})</span>}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
            extra={<DatePicker onChange={(d) => d && setTimelineDate(d.format('YYYY-MM-DD'))} defaultValue={dayjs()} allowClear={false} size="small" />}
          >
            <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 12 }}>
              <Col span={8} style={{ textAlign: 'center' }}>
                <Progress 
                  type="circle" 
                  percent={prodSummary.productivityScore} 
                  strokeColor="#3B82F6" 
                  width={80} 
                  strokeWidth={6}
                />
                <Text style={{ display: 'block', fontSize: 11, color: '#64748B', marginTop: 4 }}>Productivity</Text>
              </Col>
              <Col span={16}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Active Hours</Text>
                    <Title level={5} style={{ margin: 0, color: '#10B981' }}>{prodSummary.activeHours.toFixed(2)} hrs</Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Idle Hours</Text>
                    <Title level={5} style={{ margin: 0, color: '#EF4444' }}>{prodSummary.idleHours.toFixed(2)} hrs</Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Break Hours</Text>
                    <Title level={5} style={{ margin: 0, color: '#F59E0B' }}>{prodSummary.breakHours.toFixed(2)} hrs</Title>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Total Time</Text>
                    <Title level={5} style={{ margin: 0 }}>{prodSummary.totalHours ? prodSummary.totalHours.toFixed(2) : '0.00'} hrs</Title>
                  </div>
                </div>
              </Col>
            </Row>
            {getTimelineBar()}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card 
            bordered={false} 
            title={<span style={{ fontWeight: 600 }}><HistoryOutlined /> Weekly Productivity Summary</span>}
            style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF', height: '100%' }}
          >
            <div style={{ width: '100%', height: 210 }}>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <XAxis dataKey="name" fontSize={11} stroke="#64748B" />
                    <YAxis fontSize={11} stroke="#64748B" />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Legend iconSize={10} style={{ fontSize: 11 }} />
                    <Bar dataKey="Active Hours" stackId="a" fill="#10B981" />
                    <Bar dataKey="Idle Hours" stackId="a" fill="#EF4444" />
                    <Bar dataKey="Break Hours" stackId="a" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: '50px 0', color: '#94A3B8' }}>No weekly stats available yet.</div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* REGISTRY LOGS TABLE */}
      <Card 
        bordered={false} 
        style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
        title={<span style={{ fontWeight: 600 }}><HistoryOutlined /> Personal Registry Logs (Click row date to inspect timeline)</span>}
      >
        <Table 
          columns={columns} 
          dataSource={historyLogs} 
          rowKey="id" 
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          style={{ borderRadius: 8 }}
        />
      </Card>

      {/* REQUEST CORRECTION DRAWER */}
      <Drawer
        title={<span style={{ fontWeight: 600 }}>Request Attendance Correction</span>}
        width={480}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80 }}
      >
        <Alert
          message="Submission Notice"
          description="Log adjustments are made directly by your Manager or HR Admin. Complete the form to generate a formatted adjustment message, then copy it to send to your supervisor."
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 20, borderRadius: 8 }}
        />

        {selectedRecord && (
          <Form 
            form={form} 
            layout="vertical" 
            onFinish={handleGenerateRequest}
          >
            <Form.Item label="Log Date" name="date">
              <DatePicker style={{ width: '100%' }} disabled />
            </Form.Item>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Form.Item label="Corrected Check In" name="check_in">
                <TimePicker format="hh:mm A" use12Hours style={{ width: '100%' }} placeholder="Select Time" />
              </Form.Item>
              <Form.Item label="Corrected Check Out" name="check_out">
                <TimePicker format="hh:mm A" use12Hours style={{ width: '100%' }} placeholder="Select Time" />
              </Form.Item>
            </div>

            <Form.Item 
              label="Corrected Status" 
              name="status"
              rules={[{ required: true, message: 'Please select a status' }]}
            >
              <Input placeholder="e.g. Present, WFH, Half Day" />
            </Form.Item>

            <Form.Item 
              label="Reason for Adjustment" 
              name="reason"
              rules={[{ required: true, message: 'Please specify the correction reason' }]}
            >
              <TextArea rows={3} placeholder="Traffic delay, client meeting in morning, forgot to punch..." style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block style={{ height: 40, borderRadius: 8, background: '#10B981', borderColor: '#10B981' }}>
                Generate Request Text
              </Button>
            </Form.Item>
          </Form>
        )}

        {generatedText && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 8, color: '#475569' }}>
              Generated Request Message:
            </Text>
            <div style={{ 
              background: '#F8FAFC', 
              border: '1px solid #E2E8F0', 
              padding: '16px', 
              borderRadius: 8, 
              position: 'relative',
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#334155'
            }}>
              {generatedText}
              <Button 
                type="text" 
                icon={<CopyOutlined />} 
                onClick={handleCopyText}
                style={{ 
                  position: 'absolute', 
                  right: 8, 
                  top: 8,
                  background: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              />
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
};
