import React, { useState } from 'react';
import { Table, Card, Tag, Button, Modal, Form, Select, DatePicker, TimePicker, Input, Space, Divider, message, Row, Col, Typography } from 'antd';
import { EditOutlined, TeamOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { Attendance, AttendanceStatus } from '../../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

export const ManagerCorrections: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  
  // Search & Filter state
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

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

  // 3. Edit attendance mutation
  const editMutation = useMutation({
    mutationFn: (data: { id: number; payload: any }) => api.updateAttendance(data.id, data.payload),
    onSuccess: () => {
      message.success('Record corrected successfully!');
      queryClient.invalidateQueries({ queryKey: ['attendanceTeam'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
      setModalVisible(false);
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Error updating record.');
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

  const handleOpenEditModal = (record: any) => {
    setEditingRecord(record);
    
    // Parse times
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

    const dateStr = editingRecord.date; // Preserve original date
    
    // Construct times in ISO format relative to original date
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

  const columns = [
    {
      title: 'Employee',
      key: 'employee',
      render: (_: any, record: any) => {
        const emp = record.employee;
        return emp ? (
          <div>
            <div style={{ fontWeight: 600, color: '#0F172A' }}>
              {emp.first_name} {emp.last_name}
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
          
          <Select
            placeholder="Filter by Department"
            style={{ width: 220 }}
            allowClear
            value={selectedDept}
            onChange={(val) => setSelectedDept(val)}
          >
            {departments?.map((dept: any) => (
              <Option key={dept.id} value={dept.id}>{dept.name}</Option>
            ))}
          </Select>

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
        title={<span style={{ fontWeight: 600 }}><TeamOutlined /> Team Shift Corrections</span>}
        style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
      >
        <Table
          columns={columns}
          dataSource={teamLogs}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          style={{ borderRadius: 8 }}
        />
      </Card>

      {/* EDIT MODAL */}
      <Modal
        title={<span style={{ fontWeight: 600 }}>Correct Attendance Entry</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={500}
      >
        {editingRecord && (
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
              <TextArea rows={3} placeholder="Provide audit trail comment e.g., 'Correcting late swipe - transit issues' or 'Forgot card, checked in manual'..." style={{ borderRadius: 8 }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
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
        )}
      </Modal>
    </div>
  );
};
