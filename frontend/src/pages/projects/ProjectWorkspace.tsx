import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, Table, Button, Tag, Space, Input, Select, Modal, Form, 
  DatePicker, Avatar, Tooltip, Progress, Row, Col, Statistic, Typography, Popconfirm, message 
} from 'antd';
import { 
  ProjectOutlined, PlusOutlined, SearchOutlined, CalendarOutlined, 
  UserOutlined, EditOutlined, DeleteOutlined, TeamOutlined 
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api, { SERVER_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Project, ProjectStatus, Employee } from '../../types';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const ProjectWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form] = Form.useForm();

  // Can create/edit check
  const canModify = user && ['Super Admin', 'Admin', 'HR', 'Manager'].includes(user.role);

  // Queries
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.getProjects()
  });

  const { data: employeesRes } = useQuery<{ data: Employee[] }>({
    queryKey: ['employees'],
    queryFn: () => api.getEmployees({ limit: 100 })
  });
  const employees = employeesRes?.data || [];

  // Mutations
  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createProject(payload),
    onSuccess: () => {
      message.success('Project created successfully.');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create project.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => api.updateProject(id, payload),
    onSuccess: () => {
      message.success('Project updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setIsModalOpen(false);
      setEditingProject(null);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to update project.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteProject(id),
    onSuccess: () => {
      message.success('Project deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to delete project.');
    }
  });

  // Action handlers
  const handleOpenCreate = () => {
    setEditingProject(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      status: project.status,
      start_date: dayjs(project.start_date),
      deadline: project.deadline ? dayjs(project.deadline) : null,
      manager_id: project.manager_id,
      memberIds: project.members?.map(m => m.id) || []
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
        ...values,
        start_date: values.start_date.format('YYYY-MM-DD'),
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : null,
      };
      
      if (editingProject) {
        updateMutation.mutate({ id: editingProject.id, payload });
      } else {
        createMutation.mutate(payload);
      }
    });
  };

  // Filter projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          (p.description || '').toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate metrics
  const totalCount = projects.length;
  const activeCount = projects.filter(p => p.status === 'Active').length;
  const planningCount = projects.filter(p => p.status === 'Planning').length;
  const completedCount = projects.filter(p => p.status === 'Completed').length;

  // Render Status Tag helper
  const renderStatusTag = (status: ProjectStatus) => {
    let color = 'blue';
    if (status === 'Active') color = 'green';
    else if (status === 'Review') color = 'orange';
    else if (status === 'Completed') color = 'emerald';
    else if (status === 'Archived') color = 'gray';

    // Map emerald to custom HEX style since AntD tag colors are standard
    const customStyle = color === 'emerald' ? { color: '#10B981', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' } : {};
    const label = status;

    return (
      <Tag color={color === 'emerald' ? undefined : color} style={customStyle}>
        {label}
      </Tag>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>Projects Space</Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Coordinate deliverables, timelines, resource allocation, and project-mapped tasks.
          </Text>
        </div>
        {canModify && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleOpenCreate}
            style={{ height: 44, background: '#10B981', borderColor: '#10B981', display: 'flex', alignItems: 'center' }}
          >
            Create Project
          </Button>
        )}
      </div>

      {/* Metrics Summary Row */}
      <Row gutter={[20, 20]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Active Projects</Text>} 
              value={activeCount} 
              prefix={<ProjectOutlined style={{ color: '#10B981', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Planning Phase</Text>} 
              value={planningCount} 
              prefix={<CalendarOutlined style={{ color: '#3B82F6', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Completed Projects</Text>} 
              value={completedCount} 
              prefix={<TeamOutlined style={{ color: '#10B981', marginRight: 8 }} />}
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic 
              title={<Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Total Projects</Text>} 
              value={totalCount} 
              valueStyle={{ fontWeight: 700, color: '#0F172A' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter and Table Control Card */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={12} lg={8}>
            <Input
              placeholder="Search projects..."
              prefix={<SearchOutlined style={{ color: '#64748B' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: '100%', borderRadius: 8, height: 38 }}
            />
          </Col>
          <Col xs={24} md={6} lg={4}>
            <Select
              value={statusFilter}
              onChange={value => setStatusFilter(value)}
              style={{ width: '100%', height: 38 }}
              placeholder="Filter by Status"
            >
              <Option value="all">All Statuses</Option>
              <Option value="Planning">Planning</Option>
              <Option value="Active">Active</Option>
              <Option value="Review">Review</Option>
              <Option value="Completed">Completed</Option>
              <Option value="Archived">Archived</Option>
            </Select>
          </Col>
        </Row>

        <div className="responsive-table-container">
          <Table
            dataSource={filteredProjects}
            rowKey="id"
            loading={isLoading}
            onRow={(record) => ({
              onClick: () => navigate(`/projects/${record.id}`),
              style: { cursor: 'pointer' }
            })}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            columns={[
              {
                title: 'Project Name',
                dataIndex: 'name',
                key: 'name',
                render: (name: string, record: Project) => (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong style={{ color: '#0F172A', fontSize: 14 }}>{name}</Text>
                    {record.description && (
                      <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: record.description }}>
                        {record.description}
                      </Text>
                    )}
                  </div>
                )
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 120,
                render: (status: ProjectStatus) => renderStatusTag(status)
              },
              {
                title: 'Timeline',
                key: 'timeline',
                width: 200,
                render: (_, record: Project) => (
                  <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
                    <span style={{ color: '#475569' }}>Start: {record.start_date}</span>
                    <span style={{ color: '#94A3B8' }}>End: {record.deadline || 'No Deadline'}</span>
                  </Space>
                )
              },
              {
                title: 'Project Manager',
                dataIndex: 'manager',
                key: 'manager',
                width: 200,
                render: (manager: any) => {
                  if (!manager) return <Text type="secondary" style={{ fontSize: 13 }}>Unassigned</Text>;
                  return (
                    <Space>
                      <Avatar 
                        src={manager.avatar_url ? `${SERVER_URL}/${manager.avatar_url}` : undefined}
                        icon={!manager.avatar_url && <UserOutlined />}
                        size="small"
                        style={{ backgroundColor: '#10B981' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                        <Text strong style={{ fontSize: 13 }}>{manager.first_name} {manager.last_name}</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>{manager.designation}</Text>
                      </div>
                    </Space>
                  );
                }
              },
              {
                title: 'Team Size',
                key: 'team',
                width: 120,
                render: (_, record: Project) => {
                  const count = record.members?.length || 0;
                  return (
                    <Tooltip 
                      title={
                        record.members && record.members.length > 0 
                          ? record.members.map(m => `${m.first_name} ${m.last_name}`).join(', ') 
                          : 'No team members'
                      }
                    >
                      <Space size={4}>
                        <TeamOutlined style={{ color: '#64748B' }} />
                        <Text style={{ fontSize: 13, fontWeight: 500 }}>{count} members</Text>
                      </Space>
                    </Tooltip>
                  );
                }
              },
              {
                title: 'Actions',
                key: 'actions',
                width: 120,
                render: (_, record: Project) => {
                  if (!canModify) return null;
                  return (
                    <Space onClick={e => e.stopPropagation()}>
                      <Button 
                        type="text" 
                        icon={<EditOutlined />} 
                        onClick={(e) => handleOpenEdit(record, e)}
                      />
                      <Popconfirm
                        title="Are you sure you want to delete this project?"
                        description="This action cannot be undone."
                        onConfirm={(e) => handleDelete(record.id, e)}
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
        </div>
      </Card>

      {/* Creation / Editing Modal */}
      <Modal
        title={editingProject ? 'Edit Project Details' : 'Create New Project'}
        open={isModalOpen}
        onOk={handleFormSubmit}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText={editingProject ? 'Save Changes' : 'Create Project'}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
          initialValues={{ status: 'Planning' }}
        >
          <Form.Item
            name="name"
            label="Project Name"
            rules={[{ required: true, message: 'Please enter project name' }]}
          >
            <Input placeholder="e.g. Enterprise Client Portal Integration" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Describe the scope, objectives, and parameters of the project..." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="start_date"
                label="Start Date"
                rules={[{ required: true, message: 'Please select start date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="deadline" label="Deadline">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Project Status">
                <Select style={{ width: '100%' }}>
                  <Option value="Planning">Planning</Option>
                  <Option value="Active">Active</Option>
                  <Option value="Review">Review</Option>
                  <Option value="Completed">Completed</Option>
                  <Option value="Archived">Archived</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="manager_id" label="Project Manager">
                <Select placeholder="Assign Manager" showSearch optionFilterProp="children" allowClear style={{ width: '100%' }}>
                  {employees.map(emp => (
                    <Option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.designation})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="memberIds" label="Project Team Members">
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
