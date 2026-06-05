import React, { useEffect, useState } from 'react';
import { 
  Steps, Form, Input, Button, Select, DatePicker, 
  Upload, Space, Row, Col, Card, Avatar, List, message, Spin, Empty 
} from 'antd';
import { 
  UserOutlined, 
  MailOutlined, 
  PhoneOutlined, 
  CalendarOutlined,
  UploadOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { api, API_URL } from '../services/api';
import { EmployeeStatus, EmployeeRole, Department, Skill, SkillProficiency } from '../types';

const { Dragger } = Upload;

export const EmployeeWizard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [skillsList, setSkillsList] = useState<Skill[]>([]);
  
  // Forms for each step
  const [personalForm] = Form.useForm();
  const [employmentForm] = Form.useForm();
  const [deptForm] = Form.useForm();

  // Wizard data states
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  
  // Skills list state for Step 4
  const [selectedSkills, setSelectedSkills] = useState<Array<{ skill_id: number; proficiency_level: SkillProficiency }>>([]);
  
  // Documents state for Step 5
  const [documentFiles, setDocumentFiles] = useState<File[]>([]);

  useEffect(() => {
    async function loadConfigData() {
      try {
        const [deptsRes, skillsRes] = await Promise.all([
          api.getDepartments(),
          api.getSkills()
        ]);
        setDepartments(deptsRes);
        setSkillsList(skillsRes);

        // If in Edit Mode, fetch existing details
        if (isEditMode && id) {
          setLoading(true);
          const emp = await api.getEmployeeById(parseInt(id));
          
          // Pre-fill Personal Info
          personalForm.setFieldsValue({
            first_name: emp.first_name,
            last_name: emp.last_name,
            email: emp.email,
            phone: emp.phone,
            address: emp.address,
            bio: emp.bio
          });

          // Pre-fill Employment Details
          employmentForm.setFieldsValue({
            employee_id: emp.employee_id,
            designation: emp.designation,
            joining_date: emp.joining_date ? dayjs(emp.joining_date) : null,
            role: emp.role,
            status: emp.status
          });

          // Pre-fill Department
          deptForm.setFieldsValue({
            department_id: emp.department_id
          });

          // Pre-fill Skills
          if (emp.skills) {
            setSelectedSkills(emp.skills.map(s => ({
              skill_id: s.id,
              proficiency_level: s.proficiency_level
            })));
          }

          if (emp.avatar_url) {
            setAvatarPreview(`${API_URL.replace('/api', '')}/${emp.avatar_url}`);
          }
          setLoading(false);
        }
      } catch (err) {
        message.error('Failed to load form config resources.');
      }
    }
    loadConfigData();
  }, [id, isEditMode]);

  const handleNext = async () => {
    try {
      // Validate current step form
      if (currentStep === 0) {
        await personalForm.validateFields();
      } else if (currentStep === 1) {
        await employmentForm.validateFields();
      } else if (currentStep === 2) {
        await deptForm.validateFields();
      }
      setCurrentStep(prev => prev + 1);
    } catch (err) {
      // Validation error, form handles displaying messages
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // Compile Wizard Payload into a FormData object
      const personalData = personalForm.getFieldsValue();
      const employmentData = employmentForm.getFieldsValue();
      const deptData = deptForm.getFieldsValue();

      const formData = new FormData();
      
      // Personal fields
      formData.append('first_name', personalData.first_name);
      formData.append('last_name', personalData.last_name);
      formData.append('email', personalData.email);
      if (personalData.phone) formData.append('phone', personalData.phone);
      if (personalData.address) formData.append('address', personalData.address);
      if (personalData.bio) formData.append('bio', personalData.bio);

      // Employment fields
      formData.append('employee_id', employmentData.employee_id);
      formData.append('designation', employmentData.designation);
      formData.append('joining_date', employmentData.joining_date.format('YYYY-MM-DD'));
      formData.append('role', employmentData.role);
      formData.append('status', employmentData.status);

      // Department
      if (deptData.department_id) {
        formData.append('department_id', deptData.department_id.toString());
      }

      // Avatar
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      // Skills array
      formData.append('skills', JSON.stringify(selectedSkills));

      let resultEmployeeId = parseInt(id || '0');

      if (isEditMode && id) {
        // In Express, we utilize POST /api/employees/:id for file-backed updates
        await api.updateEmployee(parseInt(id), formData);
        message.success('Employee record successfully updated.');
      } else {
        const newEmp = await api.createEmployee(formData);
        resultEmployeeId = newEmp.id;
        message.success('Employee record successfully registered.');
      }

      // Upload files if any on step 5 (only if creating a new employee or editing)
      if (documentFiles.length > 0 && resultEmployeeId) {
        for (const file of documentFiles) {
          await api.uploadDocument(resultEmployeeId, file);
        }
      }

      navigate(`/employees/${resultEmployeeId}`);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Error processing onboarding registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (info: any) => {
    const file = info.file.originFileObj;
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addSkillSelection = () => {
    setSelectedSkills(prev => [...prev, { skill_id: skillsList[0]?.id, proficiency_level: 'Intermediate' }]);
  };

  const updateSkillSelection = (index: number, key: string, value: any) => {
    const updated = [...selectedSkills];
    updated[index] = { ...updated[index], [key]: value };
    setSelectedSkills(updated);
  };

  const removeSkillSelection = (index: number) => {
    setSelectedSkills(prev => prev.filter((_, i) => i !== index));
  };

  // Steps configuration
  const steps = [
    { title: 'Personal Info' },
    { title: 'Employment Details' },
    { title: 'Department' },
    { title: 'Skills' },
    { title: 'Documents' }
  ];

  if (loading && currentStep === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px', margin: '0 auto' }}>
      {/* HEADER NAVIGATION */}
      <div>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(isEditMode ? `/employees/${id}` : '/employees')}
          style={{ display: 'flex', alignItems: 'center', padding: 0, color: 'var(--text-secondary)' }}
        >
          Cancel and return
        </Button>
        <h1 className="page-title" style={{ marginTop: '12px' }}>
          {isEditMode ? 'Edit Employee Profile' : 'Onboard Employee'}
        </h1>
      </div>

      {/* STEPS INDICATOR */}
      <Steps current={currentStep} items={steps} size="small" style={{ marginBottom: '8px' }} />

      {/* STEP FORMS WRAPPER */}
      <Card bodyStyle={{ padding: '32px' }}>
        
        {/* STEP 1: PERSONAL INFORMATION */}
        <div style={{ display: currentStep === 0 ? 'block' : 'none' }} className="fade-in">
          <Form form={personalForm} layout="vertical" requiredMark={false} preserve={true}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>Personal Details</h3>
            
            {/* Avatar Upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <Avatar 
                src={avatarPreview} 
                icon={<UserOutlined />} 
                size={80} 
                style={{ backgroundColor: 'var(--accent-color)' }}
              />
              <Upload 
                showUploadList={false} 
                onChange={handleAvatarChange}
                beforeUpload={() => false}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />}>Change Avatar</Button>
              </Upload>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="first_name"
                  label="First Name"
                  rules={[{ required: true, message: 'First name is required' }]}
                >
                  <Input placeholder="Sarah" style={{ height: '40px' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="last_name"
                  label="Last Name"
                  rules={[{ required: true, message: 'Last name is required' }]}
                >
                  <Input placeholder="Jenkins" style={{ height: '40px' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="email"
              label="Work Email Address"
              rules={[
                { required: true, message: 'Email address is required' },
                { type: 'email', message: 'Enter a valid email address' }
              ]}
            >
              <Input prefix={<MailOutlined style={{ color: '#8c8c8c' }} />} placeholder="sarah.j@enterprise.io" style={{ height: '40px' }} />
            </Form.Item>

            <Form.Item name="phone" label="Primary Phone Number">
              <Input prefix={<PhoneOutlined style={{ color: '#8c8c8c' }} />} placeholder="+1 (555) 123-4567" style={{ height: '40px' }} />
            </Form.Item>

            <Form.Item name="bio" label="Employee Biography / Bio Summary">
              <Input.TextArea placeholder="Summarize focus, past experiences, and general highlights..." rows={4} />
            </Form.Item>

            <Form.Item name="address" label="Residential Address">
              <Input.TextArea placeholder="Street, City, State, ZIP..." rows={2} />
            </Form.Item>
          </Form>
        </div>

        {/* STEP 2: EMPLOYMENT INFORMATION */}
        <div style={{ display: currentStep === 1 ? 'block' : 'none' }} className="fade-in">
          <Form form={employmentForm} layout="vertical" requiredMark={false} preserve={true}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>Employment Profile</h3>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="employee_id"
                  label="Employee ID (Code)"
                  rules={[{ required: true, message: 'Employee ID is required' }]}
                >
                  <Input placeholder="EMP-001" style={{ height: '40px', fontFamily: 'monospace' }} disabled={isEditMode} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="designation"
                  label="Designation / Role Title"
                  rules={[{ required: true, message: 'Designation is required' }]}
                >
                  <Input placeholder="Senior Frontend Architect" style={{ height: '40px' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="joining_date"
                  label="Joining / Hire Date"
                  rules={[{ required: true, message: 'Joining date is required' }]}
                >
                  <DatePicker style={{ width: '100%', height: '40px' }} placeholder="Select date" format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="role"
                  label="System Role Authorization"
                  rules={[{ required: true, message: 'Access role is required' }]}
                  initialValue="Employee"
                >
                  <Select
                    style={{ height: '40px' }}
                    options={[
                      { label: 'Super Admin Access', value: 'Super Admin' },
                      { label: 'Administrator Access', value: 'Admin' },
                      { label: 'HR Access', value: 'HR' },
                      { label: 'Manager Access', value: 'Manager' },
                      { label: 'Employee Access', value: 'Employee' },
                      { label: 'Intern Access', value: 'Intern' }
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="status"
              label="Employee Status"
              rules={[{ required: true, message: 'Status is required' }]}
              initialValue="Active"
            >
              <Select
                style={{ height: '40px' }}
                options={[
                  { label: 'Active', value: 'Active' },
                  { label: 'Inactive / Deactivated', value: 'Inactive' },
                  { label: 'On Leave', value: 'On Leave' },
                  { label: 'Probationary', value: 'Probation' }
                ]}
              />
            </Form.Item>
          </Form>
        </div>

        {/* STEP 3: DEPARTMENT ASSIGNMENT */}
        <div style={{ display: currentStep === 2 ? 'block' : 'none' }} className="fade-in">
          <Form form={deptForm} layout="vertical" requiredMark={false} preserve={true}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>Department Assignment</h3>
            
            <Form.Item
              name="department_id"
              label="Select Corporate Division"
              rules={[{ required: true, message: 'Please assign a department.' }]}
            >
              <Select
                placeholder="Assign division..."
                style={{ height: '40px' }}
                options={departments.map(d => ({ label: `${d.name} (${d.code})`, value: d.id }))}
              />
            </Form.Item>
          </Form>
        </div>

        {/* STEP 4: SKILLS ASSIGNMENT */}
        <div style={{ display: currentStep === 3 ? 'block' : 'none' }} className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 500, margin: 0 }}>Endorse Technical Core Competencies</h3>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addSkillSelection}>Add Skill</Button>
            </div>

            {selectedSkills.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedSkills.map((sel, idx) => (
                  <Row gutter={16} key={idx} align="middle">
                    <Col span={10}>
                      <Select
                        placeholder="Choose skill..."
                        style={{ width: '100%', height: '38px' }}
                        value={sel.skill_id}
                        onChange={(val) => updateSkillSelection(idx, 'skill_id', val)}
                        options={skillsList.map(s => ({ label: `${s.name} (${s.category})`, value: s.id }))}
                      />
                    </Col>
                    <Col span={10}>
                      <Select
                        placeholder="Proficiency..."
                        style={{ width: '100%', height: '38px' }}
                        value={sel.proficiency_level}
                        onChange={(val) => updateSkillSelection(idx, 'proficiency_level', val)}
                        options={[
                          { label: 'Beginner', value: 'Beginner' },
                          { label: 'Intermediate', value: 'Intermediate' },
                          { label: 'Expert', value: 'Expert' }
                        ]}
                      />
                    </Col>
                    <Col span={4}>
                      <Button 
                        danger 
                        type="text" 
                        icon={<PlusOutlined style={{ transform: 'rotate(45deg)' }} />} 
                        onClick={() => removeSkillSelection(idx)}
                      />
                    </Col>
                  </Row>
                ))}
              </div>
            ) : (
              <Empty description="No skill endorsements assigned yet. Click Add Skill to configure." />
            )}
        </div>

        {/* STEP 5: DOCUMENTS UPLOAD */}
        <div style={{ display: currentStep === 4 ? 'block' : 'none' }} className="fade-in">
            <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>Documents and Certifications Upload</h3>

            <Dragger
              multiple
              beforeUpload={(file) => {
                setDocumentFiles(prev => [...prev, file]);
                return false; // Prevent auto upload
              }}
              fileList={[]} // Controlled internally
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: 'var(--accent-color)' }} />
              </p>
              <p className="ant-upload-text">Drag and drop file reports or resumes here</p>
              <p className="ant-upload-hint">Supported file extension: PDF, Word, Excel, Images. Max 10MB limit.</p>
            </Dragger>

            {documentFiles.length > 0 && (
              <List
                header={<div style={{ fontWeight: 500 }}>Files queued for upload ({documentFiles.length})</div>}
                bordered
                dataSource={documentFiles}
                style={{ marginTop: '24px', borderRadius: '6px' }}
                renderItem={(file, idx) => (
                  <List.Item
                    actions={[
                      <Button 
                        danger 
                        type="text" 
                        icon={<PlusOutlined style={{ transform: 'rotate(45deg)' }} />}
                        onClick={() => setDocumentFiles(prev => prev.filter((_, i) => i !== idx))}
                      />
                    ]}
                  >
                    <Space>
                      <span>{file.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </Space>
                  </List.Item>
                )}
              />
            )}
        </div>

        {/* WIZARD ACTIONS BAR */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '40px', borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
          {currentStep > 0 && (
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBack}
              disabled={loading}
            >
              Previous
            </Button>
          )}
          
          {currentStep < steps.length - 1 ? (
            <Button 
              type="primary" 
              onClick={handleNext}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              Continue <ArrowRightOutlined />
            </Button>
          ) : (
            <Button 
              type="primary" 
              icon={<CheckOutlined />} 
              onClick={handleFinish}
              loading={loading}
              style={{ display: 'flex', alignItems: 'center', background: '#000000', borderColor: '#000000' }}
            >
              {isEditMode ? 'Save Changes' : 'Complete Onboarding'}
            </Button>
          )}
        </div>

      </Card>
    </div>
  );
};
export default EmployeeWizard;
