import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Table, Tag, Button, Drawer, Space, Steps, 
  Timeline, Input, Card, Badge, Avatar, Alert, message, Form, Empty, Typography, Row, Col 
} from 'antd';
import { 
  CheckOutlined, 
  CloseOutlined, 
  EyeOutlined, 
  CloseCircleOutlined,
  CalendarOutlined,
  DownloadOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { LeaveRequest, LeaveStatus } from '../../types';

const { Text } = Typography;

export const LeaveList: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [form] = Form.useForm();

  // Fetch leave requests registry
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['leaveRequests'],
    queryFn: () => api.getLeaveRequests()
  });

  // Cancel leave request mutation
  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.cancelLeave(id),
    onSuccess: () => {
      message.success('Leave request has been successfully cancelled.');
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['leaveAnalytics'] });
      setDrawerVisible(false);
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to cancel leave request.');
    }
  });

  // Approve/Reject workflow mutation
  const workflowMutation = useMutation({
    mutationFn: (variables: { id: number; payload: { stage: 'Manager Review' | 'HR Review'; status: 'Approved' | 'Rejected'; remarks?: string } }) => 
      api.approveLeaveWorkflow(variables.id, variables.payload),
    onSuccess: (data) => {
      message.success(`Workflow decision processed successfully: Request is now ${data.status}.`);
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['leaveAnalytics'] });
      setDrawerVisible(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to dispatch workflow decision.');
    }
  });

  const handleOpenDetail = (record: LeaveRequest, review: boolean = false) => {
    setSelectedRequest(record);
    setReviewMode(review);
    setDrawerVisible(true);
  };

  const handleCancelRequest = (id: number) => {
    cancelMutation.mutate(id);
  };

  const handleReviewSubmit = (status: 'Approved' | 'Rejected') => {
    if (!selectedRequest) return;
    
    // Determine stage based on current request status
    let stage: 'Manager Review' | 'HR Review' = 'Manager Review';
    if (selectedRequest.status === 'Manager Approved') {
      stage = 'HR Review';
    }

    const remarks = form.getFieldValue('remarks');

    workflowMutation.mutate({
      id: selectedRequest.id,
      payload: {
        stage,
        status,
        remarks
      }
    });
  };

  const getStatusTag = (status: LeaveStatus) => {
    switch (status) {
      case 'Pending':
        return <Tag color="warning">Pending Manager</Tag>;
      case 'Under Review':
        return <Tag color="warning">Under Review</Tag>;
      case 'Manager Approved':
        return <Tag color="processing">Approved by Manager</Tag>;
      case 'Approved':
        return <Tag color="success">Approved</Tag>;
      case 'Rejected':
        return <Tag color="error">Rejected</Tag>;
      case 'Cancelled':
        return <Tag color="default">Cancelled</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // Build grid columns
  const columns = [
    {
      title: 'Applicant',
      key: 'employee',
      render: (_: any, record: LeaveRequest) => {
        if (user?.role === 'Employee' || user?.role === 'Intern') return null; // No need to repeat own name
        const avatarLetter = record.employee?.first_name ? record.employee.first_name.charAt(0) : 'E';
        return (
          <Space>
            <Avatar size="small" style={{ backgroundColor: '#10B981' }}>{avatarLetter}</Avatar>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.employee?.first_name} {record.employee?.last_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{record.employee?.designation}</div>
            </div>
          </Space>
        );
      },
      responsive: ['md'] as any
    },
    {
      title: 'Leave Category',
      dataIndex: ['leave_type', 'name'],
      key: 'leave_type',
      render: (text: string) => <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text}</span>
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: any, record: LeaveRequest) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.total_days} Day(s)</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {record.start_date.split('T')[0]} to {record.end_date.split('T')[0]}
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: LeaveStatus) => getStatusTag(status)
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: LeaveRequest) => {
        const isOwner = record.employee_id === user?.id;
        const isPending = ['Pending', 'Under Review'].includes(record.status);
        const isManagerApproved = record.status === 'Manager Approved';
        
        // Check if current user can review this request
        let canReview = false;
        if (user?.role === 'Super Admin' || user?.role === 'Admin') {
          // Admin/Super Admin can review anything that is not terminal
          canReview = ['Pending', 'Under Review', 'Manager Approved'].includes(record.status);
        } else if (user?.role === 'HR') {
          // HR can review requests that are manager approved (HR Review stage)
          canReview = isManagerApproved;
        } else if (user?.role === 'Manager') {
          // Manager can review pending department requests
          const isDeptMember = record.employee?.department_id === user?.department_id;
          canReview = isPending && isDeptMember && !isOwner;
        }

        return (
          <Space size={8}>
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handleOpenDetail(record, false)}
            />
            {canReview && (
              <Button 
                type="primary" 
                size="small"
                icon={<CheckOutlined />}
                style={{ fontSize: 12 }}
                onClick={() => handleOpenDetail(record, true)}
              >
                Review
              </Button>
            )}
            {isOwner && (isPending || isManagerApproved) && (
              <Button 
                type="text" 
                danger 
                icon={<CloseCircleOutlined />}
                onClick={() => handleCancelRequest(record.id)}
              />
            )}
          </Space>
        );
      }
    }
  ];

  // If user is employee or intern, filter out the applicant column
  const filteredColumns = (user?.role === 'Employee' || user?.role === 'Intern') 
    ? columns.filter(c => c.key !== 'employee')
    : columns;

  // Determine current step index for the steps visualizer
  const getStepStatusIndex = (status: LeaveStatus) => {
    switch (status) {
      case 'Pending':
      case 'Under Review':
        return 1; // manager stage
      case 'Manager Approved':
        return 2; // HR stage
      case 'Approved':
        return 3; // Finished
      case 'Rejected':
        return -1; // rejected terminal
      case 'Cancelled':
        return -1; // cancelled terminal
      default:
        return 0;
    }
  };

  return (
    <div>
      <Card bordered={false}>
        <Table 
          columns={filteredColumns} 
          dataSource={requests} 
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* DETAIL & WORKFLOW DECISION DRAWER */}
      <Drawer
        title={reviewMode ? "Review Leave Application" : "Leave Application Details"}
        placement="right"
        width={560}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        destroyOnClose
        style={{ fontFamily: 'Inter' }}
      >
        {selectedRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
            {/* WORKFLOW TRACKER STEPS */}
            <div>
              <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, marginBottom: 16 }}>Approval Workflow</h4>
              {selectedRequest.status === 'Rejected' ? (
                <Alert 
                  message="Request Rejected" 
                  description="This leave request has been rejected and closed." 
                  type="error" 
                  showIcon 
                />
              ) : selectedRequest.status === 'Cancelled' ? (
                <Alert 
                  message="Request Cancelled" 
                  description="This request was cancelled by the employee." 
                  type="info" 
                  showIcon 
                />
              ) : (
                <Steps
                  size="small"
                  current={getStepStatusIndex(selectedRequest.status)}
                  items={[
                    { title: 'Applied', description: 'Employee' },
                    { title: 'Manager Review', description: 'Department' },
                    { title: 'HR Review', description: 'Final sign-off' }
                  ]}
                />
              )}
            </div>

            {/* REQUEST DATA DETAILS */}
            <div style={{ background: '#F8FAFC', padding: 20, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 16px 0', fontWeight: 600, fontSize: 14 }}>Leave Summary</h4>
              <Row gutter={[16, 16]} style={{ fontSize: 13 }}>
                <Col span={12}>
                  <span style={{ color: 'var(--text-secondary)' }}>Employee Name:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    {selectedRequest.employee?.first_name} {selectedRequest.employee?.last_name}
                  </div>
                </Col>
                <Col span={12}>
                  <span style={{ color: 'var(--text-secondary)' }}>Leave Type:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    {selectedRequest.leave_type?.name}
                  </div>
                </Col>
                <Col span={12}>
                  <span style={{ color: 'var(--text-secondary)' }}>Date Range:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    {selectedRequest.start_date.split('T')[0]} to {selectedRequest.end_date.split('T')[0]}
                  </div>
                </Col>
                <Col span={12}>
                  <span style={{ color: 'var(--text-secondary)' }}>Duration:</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                    {selectedRequest.total_days} Day(s)
                  </div>
                </Col>
                <Col span={24}>
                  <span style={{ color: 'var(--text-secondary)' }}>Reason:</span>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginTop: 2, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                    {selectedRequest.reason}
                  </div>
                </Col>
                {selectedRequest.attachment_path && (
                  <Col span={24}>
                    <span style={{ color: 'var(--text-secondary)' }}>Attachments:</span>
                    <div style={{ marginTop: 4 }}>
                      <Button 
                        type="dashed" 
                        size="small" 
                        icon={<DownloadOutlined />}
                        href={`http://localhost:5000/${selectedRequest.attachment_path}`}
                        target="_blank"
                        style={{ fontSize: 12 }}
                      >
                        Download Attached Document
                      </Button>
                    </div>
                  </Col>
                )}
              </Row>
            </div>

            {/* AUDIT TRAIL TIMELINE FEED */}
            <div>
              <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13, marginBottom: 16 }}>Audit Trail Timeline</h4>
              {selectedRequest.approvals && selectedRequest.approvals.length > 0 ? (
                <Timeline
                  mode="left"
                  items={selectedRequest.approvals.map((app) => ({
                    color: app.status === 'Approved' ? 'green' : 'red',
                    children: (
                      <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {app.stage} - {app.status}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                          Action by {app.approver?.first_name} {app.approver?.last_name} ({app.approver?.designation})
                        </div>
                        {app.remarks && (
                          <div style={{ background: '#FFFFFF', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border-color)', marginTop: 4, display: 'inline-block', color: 'var(--text-primary)', fontSize: 11, fontStyle: 'italic' }}>
                            "{app.remarks}"
                          </div>
                        )}
                        <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginTop: 4 }}>
                          {new Date(app.created_at || '').toLocaleString()}
                        </div>
                      </div>
                    )
                  }))}
                />
              ) : (
                <Empty description="No approvals logged yet (pending review)." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>

            {/* ACTION FOR REVIEW (IF REVIEW MODE) */}
            {reviewMode && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 20, marginTop: 'auto' }}>
                <Form form={form} layout="vertical">
                  <Form.Item 
                    name="remarks" 
                    label={<span style={{ fontWeight: 600, fontSize: 12 }}>Reviewer Remarks</span>}
                    rules={[{ required: true, message: 'Please enter a review remark.' }]}
                  >
                    <Input.TextArea placeholder="Enter remarks to communicate decisions..." rows={3} />
                  </Form.Item>
                  <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                    <Button 
                      danger 
                      icon={<CloseOutlined />} 
                      onClick={() => handleReviewSubmit('Rejected')}
                      loading={workflowMutation.isPending}
                    >
                      Reject Application
                    </Button>
                    <Button 
                      type="primary" 
                      icon={<CheckOutlined />} 
                      onClick={() => handleReviewSubmit('Approved')}
                      loading={workflowMutation.isPending}
                    >
                      Approve Application
                    </Button>
                  </Space>
                </Form>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
