import React, { useState } from 'react';
import { Table, Card, Tag, Button, Select, Space, message, Row, Col, Typography, Avatar, Tooltip, Empty } from 'antd';
import { 
  LaptopOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  StopOutlined, 
  ClockCircleOutlined, 
  UserOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text, Title } = Typography;

export const DeviceManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);

  // 1. Fetch departments for filtering
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments
  });

  // 2. Fetch device list
  const { data: devices = [], isLoading, refetch } = useQuery({
    queryKey: ['adminDevices', selectedStatus, selectedDept],
    queryFn: () => api.getDevices({
      status: selectedStatus || undefined,
      departmentId: selectedDept || undefined
    })
  });

  // 3. Update device status mutation
  const statusMutation = useMutation({
    mutationFn: (data: { id: number; status: string }) => api.updateDeviceStatus(data.id, data.status),
    onSuccess: (_, variables) => {
      message.success(`Device successfully ${variables.status.toLowerCase()}ed.`);
      queryClient.invalidateQueries({ queryKey: ['adminDevices'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to update device trust status.');
    }
  });

  const handleStatusChange = (id: number, status: 'Approved' | 'Rejected' | 'Revoked' | 'Blocked') => {
    statusMutation.mutate({ id, status });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Tag color="success" style={{ borderRadius: 6, fontWeight: 600 }}><CheckCircleOutlined /> Approved</Tag>;
      case 'Pending':
        return <Tag color="warning" style={{ borderRadius: 6, fontWeight: 600 }}><ClockCircleOutlined /> Pending Approval</Tag>;
      case 'Rejected':
        return <Tag color="error" style={{ borderRadius: 6, fontWeight: 600 }}><CloseCircleOutlined /> Rejected</Tag>;
      case 'Revoked':
        return <Tag color="default" style={{ borderRadius: 6, fontWeight: 600, color: '#64748B' }}><StopOutlined /> Revoked</Tag>;
      case 'Blocked':
        return <Tag color="error" style={{ borderRadius: 6, fontWeight: 600 }}><StopOutlined /> Blocked</Tag>;
      default:
        return <Tag style={{ borderRadius: 6 }}>{status}</Tag>;
    }
  };

  // Compile summary stats for registered devices
  const stats = {
    total: devices.length,
    pending: devices.filter((d: any) => d.status === 'Pending').length,
    approved: devices.filter((d: any) => d.status === 'Approved').length,
    rejected: devices.filter((d: any) => d.status === 'Rejected').length,
    revoked: devices.filter((d: any) => d.status === 'Revoked').length,
    blocked: devices.filter((d: any) => d.status === 'Blocked').length,
  };

  const columns = [
    {
      title: 'Employee Name',
      key: 'employee',
      render: (_: any, record: any) => (
        <Space size={10}>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#10B981' }} />
          <div>
            <Text strong style={{ display: 'block', fontSize: 13 }}>
              {record.first_name} {record.last_name}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.employee_code} • {record.department_name}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Workstation Name',
      dataIndex: 'hostname',
      key: 'hostname',
      render: (text: string, record: any) => (
        <Space size={4} direction="vertical">
          <Text strong style={{ fontSize: 12 }}><LaptopOutlined /> {record.device_name || text || 'Unknown'}</Text>
          <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace' }}>UUID: {record.device_uuid}</Text>
          {record.hardware_fingerprint && (
            <Text type="secondary" style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748B' }}>HW-FP: {record.hardware_fingerprint}</Text>
          )}
          {record.installation_id && (
            <Text type="secondary" style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748B' }}>INST-ID: {record.installation_id}</Text>
          )}
        </Space>
      )
    },
    {
      title: 'OS & Version',
      key: 'os',
      render: (_: any, record: any) => (
        <div>
          <Text style={{ fontSize: 12, display: 'block' }}>{record.os_platform} ({record.platform || 'native'})</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>Agent v{record.agent_version || '1.0.0'}</Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string) => getStatusTag(status)
    },
    {
      title: 'Last Seen / Sync',
      dataIndex: 'last_sync',
      key: 'last_sync',
      render: (time: string) => time ? (
        <Tooltip title={dayjs(time).format('YYYY-MM-DD HH:mm:ss')}>
          <Text style={{ fontSize: 12 }}>{dayjs(time).format('MMM DD, hh:mm A')}</Text>
        </Tooltip>
      ) : <Text type="secondary">--</Text>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_: any, record: any) => (
        <Space size={8}>
          {record.status !== 'Approved' && (
            <Button 
              type="primary" 
              size="small"
              icon={<CheckCircleOutlined />} 
              onClick={() => handleStatusChange(record.id, 'Approved')}
              style={{ background: '#10B981', borderColor: '#10B981', borderRadius: 6 }}
            >
              Approve
            </Button>
          )}
          {record.status === 'Pending' && (
            <Button 
              danger
              size="small"
              icon={<CloseCircleOutlined />} 
              onClick={() => handleStatusChange(record.id, 'Rejected')}
              style={{ borderRadius: 6 }}
            >
              Reject
            </Button>
          )}
          {record.status === 'Approved' && (
            <>
              <Button 
                danger 
                size="small"
                icon={<StopOutlined />} 
                onClick={() => handleStatusChange(record.id, 'Revoked')}
                style={{ borderRadius: 6 }}
              >
                Revoke
              </Button>
              <Button 
                danger 
                size="small"
                icon={<StopOutlined />} 
                onClick={() => handleStatusChange(record.id, 'Blocked')}
                style={{ borderRadius: 6 }}
              >
                Block
              </Button>
            </>
          )}
          {record.status === 'Revoked' && (
            <Button 
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleStatusChange(record.id, 'Approved')}
              style={{ borderRadius: 6 }}
            >
              Re-Authorize
            </Button>
          )}
          {record.status === 'Blocked' && (
            <Button 
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleStatusChange(record.id, 'Approved')}
              style={{ borderRadius: 6 }}
            >
              Unblock
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* DEVICE ROSTER STATUS GAUGE */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: '4px solid #3B82F6', background: '#F8FAFC' }}>
            <Title level={4} style={{ margin: 0 }}>{stats.total}</Title>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>REGISTERED DEVICES</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: '4px solid #F59E0B', background: '#F8FAFC' }}>
            <Title level={4} style={{ margin: 0, color: '#F59E0B' }}>{stats.pending}</Title>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>PENDING TRUST</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: '4px solid #10B981', background: '#F8FAFC' }}>
            <Title level={4} style={{ margin: 0, color: '#10B981' }}>{stats.approved}</Title>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>TRUSTED DEVICES</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small" style={{ borderRadius: 12, borderLeft: '4px solid #EF4444', background: '#F8FAFC' }}>
            <Title level={4} style={{ margin: 0, color: '#EF4444' }}>{stats.revoked + stats.rejected + stats.blocked}</Title>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>REVOKED / REJECTED / BLOCKED</Text>
          </Card>
        </Col>
      </Row>

      {/* FILTER CONTROLS */}
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
            placeholder="Select Status"
            style={{ width: 180 }}
            allowClear
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
          >
            <Option value="Pending">Pending Approval</Option>
            <Option value="Approved">Approved</Option>
            <Option value="Rejected">Rejected</Option>
            <Option value="Revoked">Revoked</Option>
            <Option value="Blocked">Blocked</Option>
          </Select>

          <Select
            placeholder="All Departments"
            style={{ width: 200 }}
            allowClear
            value={selectedDept}
            onChange={(val) => setSelectedDept(val)}
          >
            {departments?.map((dept: any) => (
              <Option key={dept.id} value={dept.id}>{dept.name}</Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* DEVICES TABLE */}
      <Card
        bordered={false}
        title={<span style={{ fontWeight: 600 }}><LaptopOutlined /> Trust Registry Ledger</span>}
        style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
      >
        <Table
          columns={columns}
          dataSource={devices}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          locale={{
            emptyText: <Empty description="No registered agent workstations match the selected filters." />
          }}
          style={{ borderRadius: 8 }}
        />
      </Card>
    </div>
  );
};
export default DeviceManagement;
