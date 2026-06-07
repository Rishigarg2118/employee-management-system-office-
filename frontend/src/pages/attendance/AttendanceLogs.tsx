import React, { useState } from 'react';
import { Table, Card, Tag, Button, Drawer, Typography, Alert, Form, DatePicker, TimePicker, Input, Space, Divider, message } from 'antd';
import { HistoryOutlined, FormOutlined, CopyOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
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

  // Fetch personal logs history
  const { data: historyLogs, isLoading } = useQuery<Attendance[]>({
    queryKey: ['attendanceHistory'],
    queryFn: api.getAttendanceHistory
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
      render: (text: string) => <span style={{ fontWeight: 500 }}>{dayjs(text).format('ddd, MMM DD, YYYY')}</span>,
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
          Request Correction
        </Button>
      )
    }
  ];

  return (
    <Card 
      bordered={false} 
      style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
      title={<span style={{ fontWeight: 600 }}><HistoryOutlined /> Personal Registry Logs</span>}
    >
      <Table 
        columns={columns} 
        dataSource={historyLogs} 
        rowKey="id" 
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        style={{ borderRadius: 8 }}
      />

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
    </Card>
  );
};
