import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, Col, Row, Progress, Form, Select, DatePicker, 
  Input, Upload, Button, Steps, Alert, message, Result, Space 
} from 'antd';
import { 
  InboxOutlined, 
  CalendarOutlined, 
  FileTextOutlined, 
  SafetyCertificateOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const { Dragger } = Upload;
const { Option } = Select;

// Weekday calculation helper
function calculateWeekdays(start: dayjs.Dayjs | null, end: dayjs.Dayjs | null): number {
  if (!start || !end) return 0;
  let count = 0;
  let current = start;
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const day = current.day();
    if (day !== 0 && day !== 6) { // Exclude Sunday (0) and Saturday (6)
      count++;
    }
    current = current.add(1, 'day');
  }
  return count;
}

export const LeaveApply: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);

  // Watch fields for live calculations
  const leaveTypeId = Form.useWatch('leave_type_id', form);
  const dateRange = Form.useWatch('date_range', form);

  // Fetch employee leave balances
  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ['leaveBalances', user?.id],
    queryFn: () => api.getLeaveBalances(user!.id),
    enabled: !!user?.id
  });

  // Fetch leave types
  const { data: leaveTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['leaveTypes'],
    queryFn: () => api.getLeaveTypes()
  });

  // Apply Leave Mutation
  const applyLeaveMutation = useMutation({
    mutationFn: (formData: FormData) => api.applyLeave(formData),
    onSuccess: () => {
      message.success('Leave application submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['leaveBalances', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leaveAnalytics'] });
      setCurrentStep(3); // Go to success page
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to submit leave application.');
    }
  });

  if (balancesLoading || typesLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Progress type="circle" percent={45} strokeColor="#10B981" />
      </div>
    );
  }

  // Find currently selected leave type balance
  const selectedBalance = balances?.find(b => b.leave_type_id === leaveTypeId);

  // Calculate live leave days request length
  let requestedDays = 0;
  if (dateRange && dateRange[0] && dateRange[1]) {
    requestedDays = calculateWeekdays(dateRange[0], dateRange[1]);
  }

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['leave_type_id', 'date_range']);
        
        // Validation: Cannot apply if requested days exceed remaining quota
        if (selectedBalance && requestedDays > selectedBalance.remaining_days) {
          form.setFields([
            {
              name: 'date_range',
              errors: [`Insufficient leave balance. You are requesting ${requestedDays} days but only have ${selectedBalance.remaining_days} remaining.`]
            }
          ]);
          return;
        }
        
        setCurrentStep(1);
      } else if (currentStep === 1) {
        await form.validateFields(['reason']);
        setCurrentStep(2);
      }
    } catch (error) {
      console.warn('Validation failed:', error);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    try {
      const values = form.getFieldsValue(true);
      if (!values.leave_type_id || !values.date_range || !values.date_range[0] || !values.date_range[1] || !values.reason) {
        message.error('Please complete all form fields before submitting.');
        return;
      }

      const formData = new FormData();
      formData.append('leave_type_id', values.leave_type_id.toString());
      formData.append('start_date', values.date_range[0].format('YYYY-MM-DD'));
      formData.append('end_date', values.date_range[1].format('YYYY-MM-DD'));
      formData.append('reason', values.reason);
      
      if (fileList.length > 0 && fileList[0].originFileObj) {
        formData.append('attachment', fileList[0].originFileObj);
      }

      applyLeaveMutation.mutate(formData);
    } catch (err: any) {
      console.error('Submit error:', err);
      message.error(err.message || 'An error occurred while preparing your application.');
    }
  };

  const resetWizard = () => {
    form.resetFields();
    setFileList([]);
    setCurrentStep(0);
  };

  // Drag and Drop Upload configuration
  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file: any) => {
      setFileList([{
        uid: file.uid || `-upload-${Date.now()}`,
        name: file.name,
        status: 'done',
        originFileObj: file
      }]);
      return false; // Stop auto-upload to server
    },
    fileList,
    maxCount: 1,
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg'
  };

  const getProgressColor = (code: string) => {
    switch (code) {
      case 'CL': return '#10B981'; // Casual emerald
      case 'SL': return '#F59E0B'; // Sick warning gold
      case 'EL': return '#22C55E'; // Earned success green
      case 'ML': return '#EC4899'; // Maternity pink
      default: return '#10B981';
    }
  };

  return (
    <Row gutter={[24, 24]}>
      {/* LEFT COLUMN: LEAVE BALANCE CENTER CARDS */}
      <Col xs={24} lg={8}>
        <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Leave Balance Center</h3>
        <Row gutter={[16, 16]}>
          {balances?.map((b) => {
            const pct = b.total_days > 0 ? Math.round((b.used_days / b.total_days) * 100) : 0;
            const color = getProgressColor(b.leave_type?.code || 'CL');
            return (
              <Col xs={24} sm={12} lg={24} key={b.leave_type_id}>
                <Card 
                  bordered={false} 
                  style={{ 
                    borderLeft: `4px solid ${color}` 
                  }}
                  bodyStyle={{ padding: '20px 24px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{b.leave_type?.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{b.leave_type?.code} Policy Allocation</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>
                      {b.remaining_days}d Left
                    </span>
                  </div>

                  <Progress 
                    percent={pct} 
                    strokeColor={color} 
                    trailColor="#F1F5F9"
                    showInfo={false} 
                    strokeWidth={6} 
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
                    <span>Used: <strong>{b.used_days} days</strong></span>
                    <span>Total Quota: <strong>{b.total_days} days</strong></span>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Col>

      {/* RIGHT COLUMN: APPLICATION WIZARD FORM */}
      <Col xs={24} lg={16}>
        <h3 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Leave Application System</h3>
        <Card bordered={false} style={{ minHeight: 460 }}>
          {currentStep < 3 && (
            <Steps 
              current={currentStep} 
              size="small"
              style={{ marginBottom: 32 }}
              items={[
                { title: 'Dates & Type', icon: <CalendarOutlined /> },
                { title: 'Reason & Attachments', icon: <FileTextOutlined /> },
                { title: 'Policy Review', icon: <SafetyCertificateOutlined /> }
              ]}
            />
          )}

          <Form form={form} layout="vertical" requiredMark={false}>
            {/* STEP 1: SELECT TYPE & DATES */}
            {currentStep === 0 && (
              <div className="fade-in">
                <Form.Item 
                  name="leave_type_id" 
                  label={<span style={{ fontWeight: 600, fontSize: 13 }}>Select Leave Category</span>}
                  rules={[{ required: true, message: 'Please select a leave category.' }]}
                >
                  <Select placeholder="Choose Leave Type" size="large">
                    {leaveTypes?.map((t) => (
                      <Option key={t.id} value={t.id}>{t.name} ({t.code})</Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item 
                  name="date_range" 
                  label={<span style={{ fontWeight: 600, fontSize: 13 }}>Choose Date Range</span>}
                  rules={[
                    { required: true, message: 'Please choose leave dates.' },
                    {
                      validator: (_, value) => {
                        if (value && value[0] && value[0].isBefore(dayjs().subtract(1, 'month'), 'day')) {
                          return Promise.reject(new Error('Cannot backdate leave requests by more than a month.'));
                        }
                        return Promise.resolve();
                      }
                    }
                  ]}
                >
                  <DatePicker.RangePicker 
                    style={{ width: '100%' }} 
                    size="large" 
                    disabledDate={(current) => {
                      // Optionally prevent selecting weekends as start/end dates or prevent historical
                      return false;
                    }}
                  />
                </Form.Item>

                {requestedDays > 0 && (
                  <Alert
                    message={
                      <div style={{ fontSize: 13 }}>
                        Requested Duration: <strong style={{ color: '#10B981' }}>{requestedDays} Business Day(s)</strong>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>(excludes weekends)</span>
                      </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}
                
                {selectedBalance && (
                  <div style={{ marginTop: 12, padding: '12px 16px', background: '#F8FAFC', borderRadius: 6, fontSize: 13, border: '1px dashed var(--border-color)' }}>
                    Available balance for this category: <strong>{selectedBalance.remaining_days} day(s)</strong>.
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: REASON & UPLOAD */}
            {currentStep === 1 && (
              <div className="fade-in">
                <Form.Item 
                  name="reason" 
                  label={<span style={{ fontWeight: 600, fontSize: 13 }}>Reason for Leave</span>}
                  rules={[
                    { required: true, message: 'Please provide a detailed reason.' },
                    { min: 10, message: 'Reason must be at least 10 characters long to allow quick audit reviews.' }
                  ]}
                >
                  <Input.TextArea 
                    placeholder="Describe the nature of your request..." 
                    rows={4} 
                    maxLength={500} 
                    showCount
                  />
                </Form.Item>

                <Form.Item label={<span style={{ fontWeight: 600, fontSize: 13 }}>Supporting Documentation (Optional)</span>}>
                  <Dragger {...uploadProps} style={{ padding: '24px 0', background: '#FFFFFF', border: '1px dashed var(--border-color)', borderRadius: 8 }}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined style={{ color: '#10B981' }} />
                    </p>
                    <p className="ant-upload-text" style={{ fontSize: 13, fontWeight: 500 }}>
                      Drag and drop file here, or click to browse
                    </p>
                    <p className="ant-upload-hint" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      Supports PDF, DOC, DOCX, XLS, XLSX, PNG, or JPG up to 10MB.
                    </p>
                  </Dragger>
                </Form.Item>
              </div>
            )}

            {/* STEP 3: REVIEW & SUBMIT */}
            {currentStep === 2 && (
              <div className="fade-in" style={{ padding: '8px 0' }}>
                <Alert
                  message={<span style={{ fontWeight: 600 }}>Workflow Policy Review</span>}
                  description={
                    <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                      This leave application will undergo hierarchical approvals. It will be routed to your Manager for review, followed by HR. Once approved at the final HR stage, your balance quota will be deducted.
                    </div>
                  }
                  type="warning"
                  showIcon
                  style={{ marginBottom: 24 }}
                />

                <div style={{ background: '#F8FAFC', padding: 24, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontWeight: 600, fontSize: 14 }}>Application Summary</h4>
                  <Row gutter={[16, 16]} style={{ fontSize: 13 }}>
                    <Col span={12}>
                      <span style={{ color: 'var(--text-secondary)' }}>Leave Type:</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        {leaveTypes?.find(t => t.id === form.getFieldValue('leave_type_id'))?.name}
                      </div>
                    </Col>
                    <Col span={12}>
                      <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        {requestedDays} Business Day(s)
                      </div>
                    </Col>
                    <Col span={24}>
                      <span style={{ color: 'var(--text-secondary)' }}>Date Range:</span>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                        {form.getFieldValue('date_range')[0].format('MMMM D, YYYY')} to {form.getFieldValue('date_range')[1].format('MMMM D, YYYY')}
                      </div>
                    </Col>
                    <Col span={24}>
                      <span style={{ color: 'var(--text-secondary)' }}>Reason:</span>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: 2, whiteSpace: 'pre-wrap' }}>
                        {form.getFieldValue('reason')}
                      </div>
                    </Col>
                    {fileList.length > 0 && (
                      <Col span={24}>
                        <span style={{ color: 'var(--text-secondary)' }}>Attachment:</span>
                        <div style={{ fontWeight: 600, color: '#10B981', marginTop: 2 }}>
                          {fileList[0].name}
                        </div>
                      </Col>
                    )}
                  </Row>
                </div>
              </div>
            )}

            {/* STEP 4: SUCCESS RESULT */}
            {currentStep === 3 && (
              <div className="fade-in">
                <Result
                  status="success"
                  title="Leave Request Logged Successfully"
                  subTitle="Your leave application has been queued and is routed to your department Manager. You can track workflow stages under the Leave Registry tab."
                  extra={[
                    <Button type="primary" key="new" onClick={resetWizard}>
                      Apply For Another Leave
                    </Button>
                  ]}
                />
              </div>
            )}

            {/* ACTION BUTTONS */}
            {currentStep < 3 && (
              <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                {currentStep > 0 && (
                  <Button onClick={handlePrev} size="large">
                    Back
                  </Button>
                )}
                {currentStep < 2 ? (
                  <Button type="primary" onClick={handleNext} size="large">
                    Next Step
                  </Button>
                ) : (
                  <Button 
                    type="primary" 
                    onClick={handleSubmit} 
                    size="large" 
                    loading={applyLeaveMutation.isPending}
                  >
                    Submit Application
                  </Button>
                )}
              </div>
            )}
          </Form>
        </Card>
      </Col>
    </Row>
  );
};
