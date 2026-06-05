import React, { useEffect, useState } from 'react';
import { 
  Row, Col, Card, Tag, Button, Modal, Form, 
  Input, Select, Space, Spin, message, Empty 
} from 'antd';
import { 
  BulbOutlined, 
  PlusOutlined, 
  TagOutlined 
} from '@ant-design/icons';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Skill } from '../types';

export const Skills: React.FC = () => {
  const { user: currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getSkills();
      setSkills(data);
    } catch (err) {
      message.error('Failed to load skills repository.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (values: any) => {
    setSubmitting(true);
    try {
      await api.createSkill(values);
      message.success('Skill successfully added to global catalog.');
      setIsModalOpen(false);
      form.resetFields();
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to add skill.');
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

  // Group skills by category
  const categories = Array.from(new Set(skills.map(s => s.category)));

  const isEditable = ['Super Admin', 'Admin', 'HR', 'Manager'].includes(currentUser?.role || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">
            Skills Repository
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Browse endorsed skills catalog or configure new technical core competencies.
          </p>
        </div>
        {isEditable && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            Add Competency
          </Button>
        )}
      </div>

      {/* SKILLS DISPLAY AREA */}
      {skills.length > 0 ? (
        <Row gutter={[24, 24]}>
          {categories.map((category) => {
            const categorySkills = skills.filter(s => s.category === category);
            return (
              <Col xs={24} md={12} key={category}>
                <Card 
                  title={
                    <Space>
                      <TagOutlined style={{ color: 'var(--text-secondary)' }} />
                      <span>{category}</span>
                    </Space>
                  }
                  extra={<Tag color="blue">{categorySkills.length} Skills</Tag>}
                  style={{ height: '100%' }}
                >
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {categorySkills.map(skill => (
                      <Tag 
                        key={skill.id} 
                        style={{ 
                          fontSize: '13px', 
                          padding: '6px 12px', 
                          background: 'var(--hover-color)', 
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          margin: 0
                        }}
                      >
                        {skill.name}
                      </Tag>
                    ))}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        <Empty description="No technical competencies registered." />
      )}

      {/* CREATE SKILL MODAL */}
      <Modal
        title="Add Global Competency"
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          requiredMark={false}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="Skill Name"
            rules={[{ required: true, message: 'Please enter skill name.' }]}
          >
            <Input placeholder="TypeScript" style={{ height: '40px' }} />
          </Form.Item>

          <Form.Item
            name="category"
            label="Skill Category"
            rules={[{ required: true, message: 'Please specify category.' }]}
          >
            <Select
              placeholder="Select or enter category"
              style={{ height: '40px' }}
              options={[
                { label: 'Frontend Development', value: 'Frontend' },
                { label: 'Backend Development', value: 'Backend' },
                { label: 'Mobile App Development', value: 'Mobile' },
                { label: 'DevOps & Systems', value: 'DevOps' },
                { label: 'Product Design (UI/UX)', value: 'Design' },
                { label: 'Corporate Management', value: 'Management' },
                { label: 'Finance & Compliance', value: 'Finance' },
                { label: 'Human Resources', value: 'HR' }
              ]}
              // Allow users to write custom categories in select
              dropdownRender={(menu) => (
                <>
                  {menu}
                </>
              )}
            />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: 0, marginTop: '24px' }}>
            <Space>
              <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>Register Competency</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default Skills;
