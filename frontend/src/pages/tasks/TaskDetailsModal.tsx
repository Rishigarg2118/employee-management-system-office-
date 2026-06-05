import React, { useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, Tabs, Timeline, Avatar, Card, Space, Spin, message, Popconfirm, Divider } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  UserOutlined, 
  CalendarOutlined, 
  SendOutlined, 
  DeleteOutlined, 
  ClockCircleOutlined,
  MessageOutlined,
  HistoryOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

import api, { API_URL } from '../../services/api';
import { Employee, Department, TaskPriority, TaskStatus, Task } from '../../types';

interface TaskDetailsModalProps {
  taskId: number | null;
  visible: boolean;
  onClose: () => void;
  employees: Employee[];
  departments: Department[];
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  taskId,
  visible,
  onClose,
  employees,
  departments
}) => {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const [form] = Form.useForm();

  // Fetch complete details including comments & activities
  const { data: task, isLoading, refetch } = useQuery({
    queryKey: ['taskDetails', taskId],
    queryFn: () => (taskId ? api.getTaskById(taskId) : Promise.reject('No task ID')),
    enabled: !!taskId && visible
  });

  // Mutate task details
  const updateMutation = useMutation({
    mutationFn: (payload: Partial<Task>) => api.updateTask(taskId!, payload),
    onSuccess: () => {
      message.success('Task updated successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to update task');
    }
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTask(taskId!),
    onSuccess: () => {
      message.success('Task deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to delete task');
    }
  });

  // Comment posting mutation
  const commentMutation = useMutation({
    mutationFn: (content: string) => api.addTaskComment(taskId!, { content }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['taskDetails', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // Update cards comment count
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to add comment');
    }
  });

  // Set initial form values when data is loaded
  React.useEffect(() => {
    if (task) {
      form.setFieldsValue({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date ? dayjs(task.due_date) : null,
        assignee_id: task.assignee_id,
        department_id: task.department_id
      });
    }
  }, [task, form]);

  const handleFieldChange = (changedValues: any) => {
    const payload: Partial<Task> = {};
    
    if (changedValues.status) payload.status = changedValues.status;
    if (changedValues.priority) payload.priority = changedValues.priority;
    if (changedValues.due_date !== undefined) {
      payload.due_date = changedValues.due_date ? changedValues.due_date.format('YYYY-MM-DD') : null;
    }
    if (changedValues.assignee_id !== undefined) payload.assignee_id = changedValues.assignee_id;
    if (changedValues.department_id !== undefined) payload.department_id = changedValues.department_id;

    if (Object.keys(payload).length > 0) {
      updateMutation.mutate(payload);
    }
  };

  const handleSaveTextDetails = () => {
    form.validateFields(['title', 'description']).then((values) => {
      updateMutation.mutate({
        title: values.title,
        description: values.description
      });
    });
  };

  const handlePostComment = () => {
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const getPriorityBadgeColor = (p: TaskPriority) => {
    switch (p) {
      case 'Urgent': return '#EF4444';
      case 'High': return '#F59E0B';
      case 'Medium': return '#3B82F6';
      case 'Low': return '#64748B';
      default: return '#E2E8F0';
    }
  };

  if (!visible) return null;

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1000}
      bodyStyle={{ padding: '24px 12px' }}
      destroyOnClose
      centered
    >
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" />
        </div>
      ) : task ? (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, minHeight: 500 }}>
          
          {/* LEFT PANEL: Task Title, Description, and Quick Settings */}
          <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: 24 }}>
            <Form
              form={form}
              layout="vertical"
              onValuesChange={handleFieldChange}
            >
              <Form.Item
                name="title"
                rules={[{ required: true, message: 'Please enter a title' }]}
                style={{ marginBottom: 12 }}
              >
                <Input.TextArea
                  autoSize={{ minRows: 1, maxRows: 2 }}
                  placeholder="Task Title"
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    border: 'none',
                    boxShadow: 'none',
                    padding: '4px 0',
                    fontFamily: 'Inter',
                    color: '#0F172A',
                    resize: 'none'
                  }}
                />
              </Form.Item>

              <Form.Item name="description" style={{ marginBottom: 20 }}>
                <Input.TextArea
                  placeholder="Add a detailed description for this task..."
                  rows={6}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 13,
                    color: '#334155'
                  }}
                />
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <Button
                  type="primary"
                  onClick={handleSaveTextDetails}
                  loading={updateMutation.isPending}
                  style={{
                    borderRadius: 6,
                    background: '#10B981',
                    borderColor: '#10B981',
                    fontSize: 13,
                    height: 34
                  }}
                >
                  Save Title & Description
                </Button>

                <Popconfirm
                  title="Delete Task"
                  description="Are you sure you want to delete this task? This action cannot be undone."
                  onConfirm={handleDelete}
                  okText="Yes"
                  cancelText="No"
                  okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                >
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    style={{ display: 'flex', alignItems: 'center', height: 34 }}
                  >
                    Delete Task
                  </Button>
                </Popconfirm>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              {/* Task Meta Settings grid */}
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 16 }}>TASK META DATA</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                
                <Form.Item name="status" label="Status">
                  <Select style={{ borderRadius: 6 }}>
                    <Select.Option value="Todo">Todo</Select.Option>
                    <Select.Option value="In Progress">In Progress</Select.Option>
                    <Select.Option value="In Review">In Review</Select.Option>
                    <Select.Option value="Done">Done</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="priority" label="Priority">
                  <Select style={{ borderRadius: 6 }}>
                    <Select.Option value="Low">Low</Select.Option>
                    <Select.Option value="Medium">Medium</Select.Option>
                    <Select.Option value="High">High</Select.Option>
                    <Select.Option value="Urgent">Urgent</Select.Option>
                  </Select>
                </Form.Item>

                <Form.Item name="assignee_id" label="Assignee">
                  <Select
                    placeholder="Unassigned"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    style={{ borderRadius: 6 }}
                  >
                    {employees.map((emp) => (
                      <Select.Option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="department_id" label="Department">
                  <Select
                    placeholder="No Department"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    style={{ borderRadius: 6 }}
                  >
                    {departments.map((dept) => (
                      <Select.Option key={dept.id} value={dept.id}>
                        {dept.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item name="due_date" label="Due Date">
                  <DatePicker style={{ width: '100%', borderRadius: 6 }} format="YYYY-MM-DD" />
                </Form.Item>
              </div>
            </Form>
          </div>

          {/* RIGHT PANEL: Activity timeline & Comments */}
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Tabs
              defaultActiveKey="comments"
              items={[
                {
                  key: 'comments',
                  label: (
                    <span>
                      <MessageOutlined style={{ marginRight: 6 }} />
                      Comments ({task.comments?.length || 0})
                    </span>
                  ),
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
                      
                      {/* Comments stream scrollpane */}
                      <div style={{ flexGrow: 1, overflowY: 'auto', paddingRight: 8, marginBottom: 12 }}>
                        {task.comments && task.comments.length > 0 ? (
                          task.comments.map((comm) => {
                            const authorName = comm.author 
                              ? `${comm.author.first_name} ${comm.author.last_name}`
                              : 'Deleted User';
                            const authorAvatar = comm.author?.avatar_url 
                              ? `${API_URL.replace('/api', '')}/${comm.author.avatar_url}`
                              : undefined;

                            return (
                              <div key={comm.id} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                <Avatar src={authorAvatar} icon={!authorAvatar && <UserOutlined />} size="small" style={{ backgroundColor: '#10B981' }} />
                                <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', flexGrow: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{authorName}</span>
                                    <span style={{ fontSize: 10, color: '#94A3B8' }}>{dayjs(comm.created_at).fromNow()}</span>
                                  </div>
                                  <p style={{ fontSize: 12, color: '#334155', margin: 0, whiteSpace: 'pre-wrap' }}>{comm.content}</p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 12 }}>
                            No comments yet. Start the discussion!
                          </div>
                        )}
                      </div>

                      {/* Add comment entry */}
                      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
                        <Input
                          placeholder="Write a comment..."
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          onPressEnter={handlePostComment}
                          style={{ borderRadius: 6 }}
                        />
                        <Button 
                          type="primary" 
                          icon={<SendOutlined />} 
                          onClick={handlePostComment}
                          loading={commentMutation.isPending}
                          style={{ background: '#10B981', borderColor: '#10B981', borderRadius: 6 }}
                        />
                      </div>
                    </div>
                  )
                },
                {
                  key: 'activity',
                  label: (
                    <span>
                      <HistoryOutlined style={{ marginRight: 6 }} />
                      Activity Timeline
                    </span>
                  ),
                  children: (
                    <div style={{ height: 420, overflowY: 'auto', paddingRight: 8, paddingTop: 8 }}>
                      {task.activities && task.activities.length > 0 ? (
                        <Timeline
                          mode="left"
                          items={task.activities.map((act) => ({
                            color: '#10B981',
                            label: (
                              <span style={{ fontSize: 10, color: '#94A3B8', display: 'block', minWidth: 60 }}>
                                {dayjs(act.created_at).fromNow()}
                              </span>
                            ),
                            children: (
                              <div style={{ fontSize: 12, color: '#475569' }}>
                                <span style={{ fontWeight: 500 }}>{act.description}</span>
                              </div>
                            )
                          }))}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94A3B8', marginTop: 40, fontSize: 12 }}>
                          No activities logged yet.
                        </div>
                      )}
                    </div>
                  )
                }
              ]}
            />
          </div>

        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 40 }}>Task not found</div>
      )}
    </Modal>
  );
};
