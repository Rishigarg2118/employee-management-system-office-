import React, { useEffect, useState, useRef } from 'react';
import { 
  Row, Col, Card, Avatar, Tabs, Tag, List, Button,
  Timeline, Upload, Spin, Space, Select, Modal, Form, Input, message, Empty, Popconfirm 
} from 'antd';
import { 
  UserOutlined, 
  MailOutlined, 
  PhoneOutlined, 
  EnvironmentOutlined,
  CalendarOutlined,
  UploadOutlined,
  DeleteOutlined,
  PlusOutlined,
  BulbOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, API_URL, SERVER_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { EmployeeDetails, Skill, SkillProficiency } from '../types';

export const EmployeeProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeDetails | null>(null);
  const [skillsList, setSkillsList] = useState<Skill[]>([]);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [submittingSkill, setSubmittingSkill] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [skillForm] = Form.useForm();

  const loadEmployeeDetails = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.getEmployeeById(parseInt(id));
      setEmployee(data);
      const allSkills = await api.getSkills();
      setSkillsList(allSkills);
    } catch (err) {
      message.error('Failed to load employee details.');
      navigate('/employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeeDetails();
  }, [id]);

  if (loading || !employee) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  const avatarUrl = employee.avatar_url ? `${API_URL.replace('/api', '')}/${employee.avatar_url}` : undefined;
  const fullName = `${employee.first_name} ${employee.last_name}`;

  // Formatting helpers
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FilePdfOutlined style={{ color: '#EF4444', fontSize: '24px' }} />;
    if (fileType.includes('word') || fileType.includes('officedocument.word')) return <FileWordOutlined style={{ color: '#3B82F6', fontSize: '24px' }} />;
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('officedocument.spreadsheet')) return <FileExcelOutlined style={{ color: '#10B981', fontSize: '24px' }} />;
    return <FileOutlined style={{ color: '#6B7280', fontSize: '24px' }} />;
  };

  // Skill handles
  const handleAddSkill = async (values: { skill_id: number; proficiency_level: SkillProficiency }) => {
    setSubmittingSkill(true);
    try {
      await api.updateEmployeeFields(employee.id, {
        // Appends the skill to the employee roster
        skills: [
          ...employee.skills.map(s => ({ skill_id: s.id, proficiency_level: s.proficiency_level })),
          { skill_id: values.skill_id, proficiency_level: values.proficiency_level }
        ] as any
      });
      message.success('Skill assigned successfully.');
      setShowSkillModal(false);
      skillForm.resetFields();
      loadEmployeeDetails();
    } catch (err) {
      message.error('Failed to add skill.');
    } finally {
      setSubmittingSkill(false);
    }
  };

  const handleRemoveSkill = async (skillId: number) => {
    try {
      await api.updateEmployeeFields(employee.id, {
        skills: employee.skills
          .filter(s => s.id !== skillId)
          .map(s => ({ skill_id: s.id, proficiency_level: s.proficiency_level })) as any
      });
      message.success('Skill endorsement removed.');
      loadEmployeeDetails();
    } catch (err) {
      message.error('Failed to remove skill.');
    }
  };

  // Document upload triggers
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      message.error('File size exceeds 10MB threshold.');
      return;
    }

    setUploadingDoc(true);
    try {
      await api.uploadDocument(employee.id, file);
      message.success('Document uploaded successfully.');
      loadEmployeeDetails();
    } catch (err) {
      message.error('Failed to upload file.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocumentDelete = async (docId: number) => {
    try {
      await api.deleteDocument(docId);
      message.success('Document deleted.');
      loadEmployeeDetails();
    } catch (err) {
      message.error('Failed to delete document.');
    }
  };

  // Skill colors mapping
  const getSkillProficiencyTag = (proficiency: SkillProficiency) => {
    let color = '';
    let bgColor = '';
    let borderColor = '';
    if (proficiency === 'Expert') {
      color = '#1E40AF'; bgColor = '#EFF6FF'; borderColor = '#DBEAFE';
    } else if (proficiency === 'Intermediate') {
      color = '#166534'; bgColor = '#F0FDF4'; borderColor = '#DCFCE7';
    } else {
      color = '#374151'; bgColor = '#F8FAFC'; borderColor = '#E2E8F0';
    }
    return (
      <Tag style={{ color, backgroundColor: bgColor, borderColor, margin: 0 }}>
        {proficiency}
      </Tag>
    );
  };

  const isEditable = ['Super Admin', 'Admin', 'HR', 'Manager'].includes(currentUser?.role || '') || currentUser?.id === employee.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* BACK NAVIGATION */}
      <div>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/employees')}
          style={{ display: 'flex', alignItems: 'center', padding: 0, color: 'var(--text-secondary)' }}
        >
          Back to Directory
        </Button>
      </div>

      {/* OVERVIEW PANEL */}
      <Card bodyStyle={{ padding: '32px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'center', justifyContent: 'between' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
            <Avatar 
              src={avatarUrl} 
              icon={<UserOutlined />} 
              size={96}
              style={{ backgroundColor: 'var(--accent-color)', border: '2px solid var(--border-color)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 0 }}>
                  {fullName}
                </h1>
                <span className={`status-badge status-badge-${employee.status.toLowerCase().replace(' ', '')}`}>
                  {employee.status}
                </span>
              </div>
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {employee.designation} • {employee.department?.name || 'Unassigned'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Employee ID: <code style={{ fontSize: '12px', color: 'var(--accent-color)' }}>{employee.employee_id}</code>
              </span>
            </div>
          </div>
          {isEditable && (
            <Button 
              type="primary" 
              onClick={() => navigate(`/employees/${employee.id}/edit`)}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              Edit Profile
            </Button>
          )}
        </div>
      </Card>

      {/* DETAIL TABS WORKSPACE */}
      <Tabs defaultActiveKey="1" className="fade-in">
        {/* Tab 1: Profile Overview */}
        <Tabs.TabPane tab="Overview" key="1">
          <Row gutter={[24, 24]}>
            <Col xs={24} lg={16}>
              <Card title="Biography & Focus" style={{ height: '100%' }}>
                <p style={{ fontSize: '15px', color: '#333333', whiteSpace: 'pre-line' }}>
                  {employee.bio || `${employee.first_name} is a valued member of the ${employee.department?.name || 'company'} team, currently contributing as a ${employee.designation}. No detailed biography has been added yet.`}
                </p>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title="Employment Milestones" style={{ height: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CalendarOutlined style={{ color: 'var(--text-secondary)', fontSize: '16px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Joining Date</span>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>
                        {new Date(employee.joining_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircleOutlined style={{ color: 'var(--text-secondary)', fontSize: '16px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Access Authorization</span>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{employee.role} Access</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </Tabs.TabPane>

        {/* Tab 2: Contact Info */}
        <Tabs.TabPane tab="Contact Details" key="2">
          <Card>
            <Row gutter={[32, 24]}>
              <Col xs={24} md={12}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <MailOutlined style={{ color: 'var(--text-secondary)', fontSize: '20px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Work Email Address</span>
                      <a href={`mailto:${employee.email}`} style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {employee.email}
                      </a>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <PhoneOutlined style={{ color: 'var(--text-secondary)', fontSize: '20px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Primary Contact Phone</span>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{employee.phone || '—'}</span>
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <EnvironmentOutlined style={{ color: 'var(--text-secondary)', fontSize: '20px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Residential Address</span>
                    <span style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'pre-line' }}>{employee.address || '—'}</span>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Tabs.TabPane>

        {/* Tab 3: Endorsements & Skills */}
        <Tabs.TabPane tab="Skills Catalog" key="3">
          <Card 
            title="Competencies & Skill Endorsements" 
            extra={isEditable && (
              <Button 
                type="text" 
                icon={<PlusOutlined />} 
                onClick={() => setShowSkillModal(true)}
                style={{ fontSize: 13, color: 'var(--accent-color)', padding: 0 }}
              >
                Add Skill
              </Button>
            )}
          >
            {employee.skills.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Group by category */}
                {Array.from(new Set(employee.skills.map(s => s.category))).map(category => (
                  <div key={category} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
                      {category}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {employee.skills.filter(s => s.category === category).map(skill => (
                        <div 
                          key={skill.id} 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            background: 'var(--hover-color)', 
                            border: '1px solid var(--border-color)',
                            padding: '6px 12px', 
                            borderRadius: '6px'
                          }}
                        >
                          <span style={{ fontWeight: 500, fontSize: '13px' }}>{skill.name}</span>
                          {getSkillProficiencyTag(skill.proficiency_level)}
                          {isEditable && (
                            <Popconfirm
                              title="Delete skill assignment?"
                              onConfirm={() => handleRemoveSkill(skill.id)}
                              okText="Delete"
                              cancelText="Cancel"
                              okButtonProps={{ danger: true }}
                            >
                              <DeleteOutlined style={{ color: '#8C8C8C', cursor: 'pointer', fontSize: '11px', marginLeft: '4px' }} />
                            </Popconfirm>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description="No specific skills endorsed on this profile yet."
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>
        </Tabs.TabPane>

        {/* Tab 4: File Cabinet */}
        <Tabs.TabPane tab="File Cabinet" key="4">
          <Card 
            title="Documents & Credentials" 
            extra={isEditable && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleDocumentUpload} 
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
                <Button 
                  type="text" 
                  icon={<UploadOutlined />} 
                  loading={uploadingDoc}
                  onClick={triggerFileSelect}
                  style={{ fontSize: 13, color: 'var(--accent-color)', padding: 0 }}
                >
                  Upload File
                </Button>
              </>
            )}
          >
            {employee.documents.length > 0 ? (
              <Row gutter={[16, 16]}>
                {employee.documents.map(doc => (
                  <Col xs={24} sm={12} md={8} key={doc.id}>
                    <div style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'var(--transition-smooth)',
                      position: 'relative'
                    }}>
                      {getFileIcon(doc.file_type)}
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                        <a 
                          href={`${SERVER_URL}/${doc.file_path}`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {doc.name}
                        </a>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {formatFileSize(doc.file_size)}
                        </span>
                      </div>
                      {isEditable && (
                        <Popconfirm
                          title="Permanently remove file?"
                          onConfirm={() => handleDocumentDelete(doc.id)}
                          okButtonProps={{ danger: true }}
                        >
                          <Button 
                            type="text" 
                            danger 
                            icon={<DeleteOutlined />} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              padding: 0
                            }} 
                          />
                        </Popconfirm>
                      )}
                    </div>
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description="No documents uploaded to this file cabinet."
                style={{ padding: '24px 0' }}
              />
            )}
          </Card>
        </Tabs.TabPane>

        {/* Tab 5: Timeline Activities */}
        <Tabs.TabPane tab="Career Timeline" key="5">
          <Card title="Onboarding & Promotion History">
            {employee.timeline.length > 0 ? (
              <Timeline style={{ marginTop: '16px' }}>
                {employee.timeline.map((act) => {
                  const dateString = new Date(act.created_at || '').toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  return (
                    <Timeline.Item key={act.id} color="var(--accent-color)">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {act.description}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {dateString}
                        </span>
                      </div>
                    </Timeline.Item>
                  );
                })}
              </Timeline>
            ) : (
              <Empty description="No timeline events recorded." />
            )}
          </Card>
        </Tabs.TabPane>
      </Tabs>

      {/* SKILL ADD MODAL */}
      <Modal
        title="Endorse Competency Skill"
        open={showSkillModal}
        onCancel={() => { setShowSkillModal(false); skillForm.resetFields(); }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={skillForm}
          layout="vertical"
          onFinish={handleAddSkill}
          requiredMark={false}
          style={{marginTop: 16}}
        >
          <Form.Item
            name="skill_id"
            label="Select Skill"
            rules={[{ required: true, message: 'Please select a skill.' }]}
          >
            <Select
              placeholder="Search or select a skill"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={skillsList
                .filter(s => !employee.skills.some(es => es.id === s.id))
                .map(s => ({ label: `${s.name} (${s.category})`, value: s.id }))
              }
            />
          </Form.Item>

          <Form.Item
            name="proficiency_level"
            label="Proficiency Level"
            rules={[{ required: true, message: 'Select proficiency level.' }]}
            initialValue="Intermediate"
          >
            <Select
              options={[
                { label: 'Beginner', value: 'Beginner' },
                { label: 'Intermediate', value: 'Intermediate' },
                { label: 'Expert', value: 'Expert' }
              ]}
            />
          </Form.Item>

          <Form.Item style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: 0, marginTop: '24px' }}>
            <Space>
              <Button onClick={() => setShowSkillModal(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={submittingSkill}>Add Skill</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default EmployeeProfile;
