import React, { useEffect, useState } from 'react';
import { 
  Row, Col, Card, Avatar, Button, Modal, Form, 
  Input, Select, Space, Spin, message, Empty, Popconfirm 
} from 'antd';
import { 
  AppstoreOutlined, 
  PlusOutlined, 
  UserOutlined, 
  EnvironmentOutlined,
  CalendarOutlined,
  EditOutlined,
  DeleteOutlined
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">
            Departments
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Manage corporate divisions, track headcounts, and assign managers.
          </p>
        </div>
        {isAdmin && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleAddClick}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            Add Department
          </Button>
        )}
      </div>

      {/* DEPARTMENTS CARD GRID */}
      {departments.length > 0 ? (
        <Row gutter={[24, 24]}>
          {departments.map((dept) => {
            const hasManager = !!dept.manager;
            const managerName = hasManager ? `${dept.manager?.first_name} ${dept.manager?.last_name}` : 'Unassigned';
            
            return (
              <Col xs={24} md={12} xl={8} key={dept.id}>
                <Card 
                  style={{ height: '100%' }}
                  bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'between' }}
                  actions={isAdmin ? [
                    <EditOutlined key="edit" onClick={() => handleEditClick(dept)} />,
                    <Popconfirm
                      title="Delete Department"
                      description="Are you sure you want to delete this department? Employees inside this department will be unassigned."
                      onConfirm={() => handleDeleteConfirm(dept.id)}
                      okText="Yes"
                      cancelText="No"
                      okButtonProps={{ danger: true }}
                    >
                      <DeleteOutlined key="delete" style={{ color: '#EF4444' }} />
                    </Popconfirm>
                  ] : undefined}
                >
                  <div>
                    {/* Icon and Code */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '6px', 
                        background: 'var(--hover-color)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--text-secondary)',
                        fontSize: '16px'
                      }}>
                        <AppstoreOutlined />
                      </div>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontSize: '12px', 
                        background: 'var(--hover-color)', 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        fontWeight: 500
                      }}>
                        {dept.code}
                      </span>
                    </div>

                    {/* Department Title */}
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      {dept.name}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', minHeight: '40px', marginBottom: '24px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {dept.description || 'No division description available.'}
                    </p>
                  </div>

                  {/* FTE Info and Manager Footer */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Department Headcount</span>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{dept.employee_count} FTE</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar 
                        src={dept.manager?.avatar_url ? `${SERVER_URL}/${dept.manager.avatar_url}` : undefined} 
                        icon={<UserOutlined />} 
                        size="small"
                        style={{ backgroundColor: 'var(--hover-color)', color: 'var(--text-secondary)' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Manager</span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{managerName}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Empty description="No corporate departments registered." />
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
