import React, { useEffect, useState } from 'react';
import { 
  Row, Col, Card, Avatar, Button, Modal, Form, 
  Input, Select, Space, Spin, message, Empty, Popconfirm, Progress, Divider, Tooltip
} from 'antd';
import { 
  AppstoreOutlined, 
  PlusOutlined, 
  UserOutlined, 
  EditOutlined, 
  DeleteOutlined,
  SearchOutlined,
  TeamOutlined,
  SolutionOutlined,
  BarChartOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { api, SERVER_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Department, Employee } from '../types';

export const Departments: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const [deptsRes, empRes] = await Promise.all([
        api.getDepartments(),
        api.getEmployees({ limit: 1000 }) // Fetch all for manager selection
      ]);
      setDepartments(deptsRes);
      setEmployees(empRes.data);
    } catch (err) {
      message.error('Failed to load department registry.');
    } finally {
      setLoading(false);
    }
  };

  const [editingDept, setEditingDept] = useState<Department | null>(null);

  const handleEditClick = (dept: Department) => {
    setEditingDept(dept);
    form.setFieldsValue({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      manager_id: dept.manager?.id || dept.manager_id || null
    });
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingDept(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async (id: number) => {
    try {
      await api.deleteDepartment(id);
      message.success('Department deleted successfully.');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to delete department.');
    }
  };

  useEffect(() => {
    loadData();

    // Check query params to auto-open creation modal
    if (searchParams.get('openCreate') === 'true') {
      handleAddClick();
      // Clean query parameter
      setSearchParams({});
    }
  }, [searchParams]);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingDept) {
        await api.updateDepartment(editingDept.id, values);
        message.success('Department successfully updated.');
      } else {
        await api.createDepartment(values);
        message.success('Department successfully registered.');
      }
      setIsModalOpen(false);
      form.resetFields();
      setEditingDept(null);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to process department details.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin';

  // Stats Computations
  const totalDepts = departments.length;
  const totalHeadcount = departments.reduce((acc, curr) => acc + (curr.employee_count || 0), 0);
  const deptsWithManager = departments.filter(d => !!d.manager).length;
  const managerRate = totalDepts > 0 ? Math.round((deptsWithManager / totalDepts) * 100) : 0;
  const avgDeptSize = totalDepts > 0 ? (totalHeadcount / totalDepts).toFixed(1) : '0';

  // Filters logic
  const filteredDepartments = departments.filter(dept => {
    const matchesSearch = dept.name.toLowerCase().includes(searchText.toLowerCase()) || 
                          dept.code.toLowerCase().includes(searchText.toLowerCase());
    
    if (filterType === 'has_manager') {
      return matchesSearch && !!dept.manager;
    }
    if (filterType === 'no_manager') {
      return matchesSearch && !dept.manager;
    }
    if (filterType === 'large') {
      return matchesSearch && (dept.employee_count || 0) > 5;
    }
    if (filterType === 'small') {
      return matchesSearch && (dept.employee_count || 0) <= 5;
    }
    return matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">
            Departments
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            Manage corporate divisions, track headcounts, and assign department managers.
          </p>
        </div>
        {isAdmin && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAddClick}
            style={{ display: 'flex', alignItems: 'center', height: '40px', borderRadius: '6px', fontWeight: 500 }}
          >
            Add Department
          </Button>
        )}
      </div>

      {/* STATISTICS PANEL */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Total Divisions</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{totalDepts}</div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                <AppstoreOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Total Headcount</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{totalHeadcount} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>FTE</span></div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ECFDF5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                <TeamOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Manager Assign Rate</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{managerRate}%</div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                <SolutionOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} bodyStyle={{ padding: '20px' }} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>Avg. Department Size</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{avgDeptSize} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>staff</span></div>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#F0F9FF', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                <BarChartOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* SEARCH AND FILTER BAR */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '16px', 
        flexWrap: 'wrap', 
        background: 'var(--bg-card)', 
        padding: '16px 20px', 
        borderRadius: '12px', 
        border: '1px solid var(--border-color)', 
        boxShadow: '0 1px 2px rgba(0,0,0,0.01)' 
      }}>
        <Input 
          placeholder="Search by department name or code..." 
          prefix={<SearchOutlined style={{ color: 'var(--text-secondary)' }} />} 
          style={{ flex: '1 1 300px', maxWidth: '400px', height: '38px', borderRadius: '6px' }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><FilterOutlined /> Filter:</span>
          <Select 
            defaultValue="all" 
            style={{ width: '180px', height: '38px' }}
            onChange={(val) => setFilterType(val)}
            options={[
              { label: 'All Divisions', value: 'all' },
              { label: 'Has Manager', value: 'has_manager' },
              { label: 'No Manager Assigned', value: 'no_manager' },
              { label: 'Large (> 5 Employees)', value: 'large' },
              { label: 'Small (≤ 5 Employees)', value: 'small' }
            ]}
          />
        </div>
      </div>

      {/* DEPARTMENTS CARD GRID */}
      {filteredDepartments.length > 0 ? (
        <Row gutter={[24, 24]}>
          {filteredDepartments.map((dept) => {
            const hasManager = !!dept.manager;
            const managerName = hasManager ? `${dept.manager?.first_name} ${dept.manager?.last_name}` : 'Unassigned';
            
            return (
              <Col xs={24} sm={12} lg={8} key={dept.id} style={{ display: 'flex' }}>
                <Card 
                  bordered={false}
                  hoverable
                  style={{ 
                    height: '100%', 
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)', 
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}
                >
                  <div>
                    {/* Top row: Code badge and Admin controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '11px', 
                        background: 'var(--hover-color)', 
                        padding: '3px 8px', 
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        fontWeight: 600,
                        color: 'var(--text-primary)'
                      }}>
                        {dept.code}
                      </span>
                      
                      {isAdmin && (
                        <Space size="small">
                          <Tooltip title="Edit Department">
                            <Button 
                              type="text" 
                              size="small" 
                              icon={<EditOutlined style={{ color: 'var(--text-secondary)', fontSize: '14px' }} />} 
                              onClick={() => handleEditClick(dept)} 
                              style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%' }}
                            />
                          </Tooltip>
                          <Popconfirm
                            title="Delete Department"
                            description="Are you sure you want to delete this department? Employees inside will be unassigned."
                            onConfirm={() => handleDeleteConfirm(dept.id)}
                            okText="Yes"
                            cancelText="No"
                            okButtonProps={{ danger: true }}
                          >
                            <Tooltip title="Delete Department">
                              <Button 
                                type="text" 
                                size="small" 
                                icon={<DeleteOutlined style={{ color: '#EF4444', fontSize: '14px' }} />} 
                                style={{ padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%' }}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </Space>
                      )}
                    </div>

                    {/* Department Title */}
                    <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.3 }}>
                      {dept.name}
                    </h3>
                    <p style={{ 
                      color: 'var(--text-secondary)', 
                      fontSize: '13px', 
                      minHeight: '38px', 
                      marginBottom: '20px', 
                      lineHeight: '1.45',
                      overflow: 'hidden', 
                      display: '-webkit-box', 
                      WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical' 
                    }}>
                      {dept.description || 'No division description available.'}
                    </p>
                  </div>

                  <div>
                    <Divider style={{ margin: '12px 0' }} />
                    
                    {/* FTE Count and progress bar indicator */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Department Headcount</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{dept.employee_count || 0} FTE</span>
                    </div>
                    {/* Progress bar visual indicator relative to 15 FTE scale */}
                    <Progress 
                      percent={Math.min(Math.round(((dept.employee_count || 0) / 15) * 100), 100)} 
                      showInfo={false} 
                      size="small" 
                      strokeColor={(dept.employee_count || 0) > 5 ? '#10B981' : '#6366F1'}
                      style={{ marginBottom: '16px' }}
                    />
                    
                    {/* Manager footer section */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--hover-color)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <Avatar 
                        src={dept.manager?.avatar_url ? `${SERVER_URL}/${dept.manager.avatar_url}` : undefined} 
                        icon={<UserOutlined />} 
                        size="default"
                        style={{ backgroundColor: '#E2E8F0', color: '#64748B' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manager / Head</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: hasManager ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{managerName}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Empty description="No departments found matching the criteria." />
      )}

      {/* CREATE/EDIT DEPARTMENT MODAL */}
      <Modal
        title={editingDept ? 'Edit Department Details' : 'Add Department'}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); setEditingDept(null); }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="Department Name"
            rules={[{ required: true, message: 'Please enter department name.' }]}
          >
            <Input placeholder="Engineering" style={{ height: '40px' }} />
          </Form.Item>

          <Form.Item
            name="code"
            label="Department Code"
            rules={[
              { required: true, message: 'Please enter department code.' },
              { max: 10, message: 'Code must be 10 characters or less.' }
            ]}
          >
            <Input placeholder="ENG" style={{ height: '40px', fontFamily: 'monospace' }} disabled={!!editingDept} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description / Purpose Summary"
          >
            <Input.TextArea placeholder="Describe the focus area, objectives, and responsibilities of this division..." rows={3} />
          </Form.Item>

          <Form.Item
            name="manager_id"
            label="Assign Manager / Head of Department"
          >
            <Select
              placeholder="Assign a department manager..."
              allowClear
              style={{ height: '40px' }}
              options={employees.map(e => ({ label: `${e.first_name} ${e.last_name} (${e.designation})`, value: e.id }))}
            />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: 0, marginTop: '24px' }}>
            <Space>
              <Button onClick={() => { setIsModalOpen(false); form.resetFields(); setEditingDept(null); }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                {editingDept ? 'Save Changes' : 'Register Department'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default Departments;
