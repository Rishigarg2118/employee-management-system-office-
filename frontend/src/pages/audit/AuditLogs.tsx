import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Tag, Select, Button, Space, Input, Modal, Typography as AntTypography, Spin } from 'antd';
import { HistoryOutlined, SearchOutlined, SyncOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { AuditLog, AuditLogModule } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const AuditLogs: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Queries
  const { data: logs = [], isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ['auditLogs', selectedModule],
    queryFn: () => api.getAuditLogs({ 
      module: selectedModule === 'all' ? undefined : selectedModule as AuditLogModule,
      limit: 200 
    })
  });

  const handleOpenDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const renderModuleTag = (mod: AuditLogModule) => {
    let color = 'default';
    if (mod === 'AUTH') color = 'red';
    else if (mod === 'EMPLOYEES') color = 'green';
    else if (mod === 'DEPARTMENTS') color = 'blue';
    else if (mod === 'LEAVES') color = 'orange';
    else if (mod === 'ATTENDANCE') color = 'cyan';
    else if (mod === 'TASKS') color = 'purple';
    else if (mod === 'PROJECTS') color = 'geekblue';
    else if (mod === 'TEAMS') color = 'magenta';
    else if (mod === 'SYSTEM') color = 'gold';

    return <Tag color={color} style={{ borderRadius: 4, fontSize: 11, fontWeight: 500 }}>{mod}</Tag>;
  };

  // Filter logs locally based on search
  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.actor_name.toLowerCase().includes(searchText.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchText.toLowerCase()) ||
                          (log.new_value || '').toLowerCase().includes(searchText.toLowerCase());
    return matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>Audit Trail Logs</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Monitor corporate mutations, administrative adjustments, and secure authorization traces.
          </Text>
        </div>
        <Button 
          icon={<SyncOutlined spin={isLoading} />} 
          onClick={() => refetch()}
          style={{ height: 38, borderColor: '#E2E8F0', borderRadius: 6 }}
        >
          Refresh Trail
        </Button>
      </div>

      {/* Main Table Card */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search audit trail..."
            prefix={<SearchOutlined style={{ color: '#64748B' }} />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
          />
          <Select
            value={selectedModule}
            onChange={setSelectedModule}
            style={{ width: 180 }}
            placeholder="Filter by Module"
          >
            <Option value="all">All Modules</Option>
            <Option value="AUTH">Authentication</Option>
            <Option value="EMPLOYEES">Employees</Option>
            <Option value="DEPARTMENTS">Departments</Option>
            <Option value="LEAVES">Leaves</Option>
            <Option value="ATTENDANCE">Attendance</Option>
            <Option value="TASKS">Tasks</Option>
            <Option value="PROJECTS">Projects</Option>
            <Option value="TEAMS">Teams</Option>
            <Option value="SYSTEM">System Settings</Option>
          </Select>
        </div>

        <Table
          dataSource={filteredLogs}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          columns={[
            {
              title: 'Timestamp',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 180,
              render: (date: string) => (
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  {new Date(date).toLocaleString()}
                </Text>
              )
            },
            {
              title: 'Module',
              dataIndex: 'module',
              key: 'module',
              width: 120,
              render: (mod: AuditLogModule) => renderModuleTag(mod)
            },
            {
              title: 'Actor',
              dataIndex: 'actor_name',
              key: 'actor_name',
              width: 180,
              render: (name: string, record: AuditLog) => (
                <Space direction="vertical" size={0}>
                  <Text strong style={{ fontSize: 13, color: '#0F172A' }}>{name}</Text>
                  {record.actor_id && <Text type="secondary" style={{ fontSize: 11 }}>ID: {record.actor_id}</Text>}
                </Space>
              )
            },
            {
              title: 'Action Performed',
              dataIndex: 'action',
              key: 'action',
              render: (action: string) => (
                <Text style={{ fontSize: 13, fontWeight: 500, color: '#1E293B' }}>{action}</Text>
              )
            },
            {
              title: 'Audit Detail',
              key: 'detail',
              width: 100,
              render: (_, record: AuditLog) => {
                if (!record.new_value) return null;
                return (
                  <Button 
                    type="text" 
                    icon={<EyeOutlined />} 
                    onClick={() => handleOpenDetails(record)}
                  />
                );
              }
            }
          ]}
        />
      </Card>

      {/* Log Details Modal */}
      <Modal
        title="Audit Event Details"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalOpen(false)} style={{ borderRadius: 6 }}>
            Close
          </Button>
        ]}
        width={600}
      >
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                Event Info
              </Text>
              <Space direction="vertical" size={4} style={{ marginTop: 6 }}>
                <Text style={{ fontSize: 13 }}>Timestamp: <strong>{new Date(selectedLog.created_at!).toLocaleString()}</strong></Text>
                <Text style={{ fontSize: 13 }}>Actor: <strong>{selectedLog.actor_name} (ID: {selectedLog.actor_id || 'System'})</strong></Text>
                <Text style={{ fontSize: 13 }}>Action: <strong>{selectedLog.action}</strong></Text>
                <Text style={{ fontSize: 13 }}>Module: {renderModuleTag(selectedLog.module)}</Text>
              </Space>
            </div>

            {selectedLog.new_value && (
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>
                  Parameters / Data Payload
                </Text>
                <pre style={{ 
                  padding: 12, 
                  background: '#F1F5F9', 
                  borderRadius: 6, 
                  fontSize: 12, 
                  overflowX: 'auto',
                  border: '1px solid #E2E8F0',
                  color: '#0F172A',
                  margin: 0
                }}>
                  {JSON.stringify(JSON.parse(selectedLog.new_value), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
export default AuditLogs;
