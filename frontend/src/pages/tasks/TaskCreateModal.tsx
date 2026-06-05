import React from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../services/api';
import { Employee, Department, TaskPriority } from '../../types';

interface TaskCreateModalProps {
  visible: boolean;
  onClose: () => void;
  employees: Employee[];
  departments: Department[];
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  visible,
  onClose,
  employees,
  departments
}) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: any) => api.createTask(payload),
    onSuccess: () => {
      message.success('Task created successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      form.resetFields();
      onClose();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create task');
    }
  });

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const payload = {
        title: values.title,
        description: values.description,
        priority: values.priority,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
        assignee_id: values.assignee_id || null,
        department_id: values.department_id || null
      };
      createMutation.mutate(payload);
    });
  };

  return (
    <Modal
      title="Create New Task"
      open={visible}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      footer={[
        <Button key="cancel" onClick={onClose} style={{ borderRadius: 6 }}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={createMutation.isPending}
          onClick={handleSubmit}
          style={{ borderRadius: 6, background: '#10B981', borderColor: '#10B981' }}
        >
          Create Task
        </Button>
      ]}
      width={600}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ priority: 'Medium' }} style={{ marginTop: 16 }}>
        <Form.Item
          name="title"
          label="Task Title"
          rules={[{ required: true, message: 'Please enter a title' }]}
        >
          <Input placeholder="Enter task title" style={{ borderRadius: 6 }} />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="Enter task description" rows={4} style={{ borderRadius: 6 }} />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
            <Select style={{ borderRadius: 6 }}>
              <Select.Option value="Low">Low</Select.Option>
              <Select.Option value="Medium">Medium</Select.Option>
              <Select.Option value="High">High</Select.Option>
              <Select.Option value="Urgent">Urgent</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="due_date" label="Due Date">
            <DatePicker style={{ width: '100%', borderRadius: 6 }} format="YYYY-MM-DD" />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Form.Item name="assignee_id" label="Assignee">
            <Select placeholder="Select assignee" showSearch optionFilterProp="children" style={{ borderRadius: 6 }}>
              {employees.map((emp) => (
                <Select.Option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.designation})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="department_id" label="Department">
            <Select placeholder="Select department" showSearch optionFilterProp="children" style={{ borderRadius: 6 }}>
              {departments.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>
                  {dept.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};
