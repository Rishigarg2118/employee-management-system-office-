import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, Table, Button, Tag, Space, Input, Select, Modal, Form, 
  Avatar, Tooltip, Row, Col, Statistic, Typography, Popconfirm, message 
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, UserOutlined, EditOutlined, 
  DeleteOutlined, TeamOutlined, AppstoreOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api, { SERVER_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Team, Employee, Department } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const TeamWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [form] = Form.useForm();

  // Can create/edit check
  const canModify = user && ['Super Admin', 'Admin', 'HR', 'Manager'].includes(user.role);

  // Queries
  const { data: teams = [], isLoading } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.getTeams()
  });

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: () => api.getDepartments()
  });

  const { data: employeesRes } = useQuery<{ data: Employee[] }>({
    queryKey: ['employees'],
    queryFn: () => api.getEmployees({ limit: 100 })
  });
  const employees = employeesRes?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createTeam(payload),
    onSuccess: () => {
      message.success('Team created successfully.');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create team.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => api.updateTeam(id, payload),
    onSuccess: () => {
      message.success('Team updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setIsModalOpen(false);
      setEditingTeam(null);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to update team.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTeam(id),
    onSuccess: () => {
      message.success('Team deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to delete team.');
    }
  });

  // Action handlers
  const handleOpenCreate = () => {
    setEditingTeam(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (team: Team, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTeam(team);
    form.setFieldsValue({
      name: team.name,
      department_id: team.department_id,
      lead_id: team.lead_id,
      memberIds: team.members?.map(m => m.id) || []
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    deleteMutation.mutate(id);
  };

  const handleFormSubmit = () => {
    form.validateFields().then(values => {
      const payload = {
        name: values.name,
        department_id: values.department_id ? Number(values.department_id) : null,
        lead_id: values.lead_id ? Number(values.lead_id) : null,
        memberIds: values.memberIds ? values.memberIds.map((id: any) => Number(id)) : []
      };
      
      if (editingTeam) {
        updateMutation.mutate({ id: editingTeam.id, payload });
      } else {
        createMutation.mutate(payload);
      }
    });
  };

  // Filter teams
  const filteredTeams = teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchText.toLowerCase());
    const matchesDept = deptFilter === 'all' || t.department_id === parseInt(deptFilter);
    return matchesSearch && matchesDept;
  });

  // Calculate metrics
  const totalTeams = teams.length;
  const totalStaffInTeams = teams.reduce((acc, t) => acc + (t.members?.length || 0), 0);
  
  // Find largest team
  let largestTeamName = 'None';
  let largestTeamSize = 0;
  teams.forEach(t => {
    const size = t.members?.length || 0;
    if (size > largestTeamSize) {
      largestTeamSize = size;
      largestTeamName = t.name;
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>Corporate Teams</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Organize staff divisions, assign managers, and manage resource allocations.
          </Text>
        </div>
        {canModify && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleOpenCreate}
            style={{ height: 40, background: '#10B981', borderColor: '#10B981' }}
          >
            Create Team
          </Button>
        )}
      </div>

      {/* Metrics Row */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Active Teams</Text>} 
              value={totalTeams} 
              prefix={<TeamOutlined style={{ color: '#10B981', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Total Staff in Teams</Text>} 
              value={totalStaffInTeams} 
              prefix={<UserOutlined style={{ color: '#3B82F6', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={24} lg={8}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Largest Team</Text>} 
              value={largestTeamName} 
              suffix={`(${largestTeamSize} staff)`}
              valueStyle={{ fontWeight: 700, color: '#0F172A', fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter and Table Control Card */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search teams..."
            prefix={<SearchOutlined style={{ color: '#64748B' }} />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300, borderRadius: 8 }}
          />
          <Select
            value={deptFilter}
            onChange={value => setDeptFilter(value)}
            style={{ width: 200 }}
            placeholder="Filter by Department"
          >
            <Option value="all">All Departments</Option>
            {departments.map(dept => (
              <Option key={dept.id} value={dept.id.toString()}>{dept.name}</Option>
            ))}
          </Select>
        </div>

        <Table
          dataSource={filteredTeams}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          columns={[
            {
              title: 'Team Name',
              dataIndex: 'name',
              key: 'name',
              render: (name: string) => (
                <Text strong style={{ color: '#0F172A', fontSize: 14 }}>{name}</Text>
              )
            },
            {
              title: 'Department',
              dataIndex: 'department',
              key: 'department',
              render: (dept: Department | null) => {
                if (!dept) return <Text type="secondary" style={{ fontSize: 13 }}>General</Text>;
                return <Tag color="blue" style={{ borderRadius: 4 }}>{dept.name}</Tag>;
              }
            },
            {
              title: 'Team Lead',
              dataIndex: 'lead',
              key: 'lead',
              render: (lead: any) => {
                if (!lead) return <Text type="secondary" style={{ fontSize: 13 }}>Unassigned</Text>;
                return (
                  <Space>
                    <Avatar 
                      src={lead.avatar_url ? `${SERVER_URL}/${lead.avatar_url}` : undefined}
                      icon={!lead.avatar_url && <UserOutlined />}
                      size="small"
                      style={{ backgroundColor: '#10B981' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                      <Text strong style={{ fontSize: 13 }}>{lead.first_name} {lead.last_name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{lead.designation}</Text>
                    </div>
                  </Space>
                );
              }
            },
            {
              title: 'Members allocated',
              dataIndex: 'members',
              key: 'members',
              render: (members: any[] | undefined) => {
                const count = members?.length || 0;
                if (count === 0) return <Text type="secondary" style={{ fontSize: 13 }}>No staff</Text>;
                
                return (
                  <Space size={4}>
                    <Avatar.Group maxCount={4} size="small" maxStyle={{ color: '#10B981', backgroundColor: '#ECFDF5' }}>
                      {members?.map(m => (
                        <Tooltip key={m.id} title={`${m.first_name} ${m.last_name}`}>
                          <Avatar 
                            src={m.avatar_url ? `${SERVER_URL}/${m.avatar_url}` : undefined}
                            icon={!m.avatar_url && <UserOutlined />}
                            style={{ backgroundColor: '#3B82F6' }}
                          />
                        </Tooltip>
                      ))}
                    </Avatar.Group>
                    <Text style={{ fontSize: 12, color: '#64748B', marginLeft: 4 }}>
                      ({count})
                    </Text>
                  </Space>
                );
              }
            },
            {
              title: 'Actions',
              key: 'actions',
              width: 120,
              render: (_, record: Team) => {
                if (!canModify) return null;
                return (
                  <Space>
                    <Button 
                      type="text" 
                      icon={<EditOutlined />} 
                      onClick={(e) => handleOpenEdit(record, e)}
                    />
                    <Popconfirm
                      title="Are you sure you want to delete this team?"
                      description="This action cannot be undone."
                      onConfirm={() => handleDelete(record.id)}
                      okText="Delete"
                      cancelText="Cancel"
                      okButtonProps={{ danger: true }}
                    >
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                      />
                    </Popconfirm>
                  </Space>
                );
              }
            }
          ]}
        />
      </Card>

      {/* Creation / Editing Modal */}
      <Modal
        title={editingTeam ? 'Edit Team Properties' : 'Create New Corporate Team'}
        open={isModalOpen}
        onOk={handleFormSubmit}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingTeam ? 'Save Changes' : 'Create Team'}
        width={550}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="Team Name"
            rules={[{ required: true, message: 'Please enter team name' }]}
          >
            <Input placeholder="e.g. Infrastructure Engineering" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="department_id" label="Department Division">
                <Select placeholder="Select Department" allowClear>
                  {departments.map(dept => (
                    <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lead_id" label="Team Lead / Manager">
                <Select placeholder="Assign Lead" showSearch optionFilterProp="children" allowClear>
                  {employees.map(emp => (
                    <Option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="memberIds" label="Team Members">
            <Select 
              mode="multiple" 
              placeholder="Assign team members" 
              showSearch 
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {employees.map(emp => (
                <Option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.designation})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default TeamWorkspace;
