import React, { useState } from 'react';
import { Button, Select, Space, Card, Spin, Row, Col, Typography, Empty, Badge } from 'antd';
import { PlusOutlined, FilterOutlined, SyncOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { KanbanBoard } from './KanbanBoard';
import { TaskDetailsModal } from './TaskDetailsModal';
import { TaskCreateModal } from './TaskCreateModal';
import { TaskStatus, TaskPriority } from '../../types';

const { Title, Paragraph } = Typography;

export const TaskWorkspace: React.FC = () => {
  const queryClient = useQueryClient();
  
  // Filter States
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | undefined>(undefined);
  const [selectedAssignee, setSelectedAssignee] = useState<number | undefined>(undefined);

  // Modal Visibility States
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [createVisible, setCreateVisible] = useState(false);

  // Queries
  const { data: departments = [], isLoading: isLoadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.getDepartments()
  });

  const { data: employeesData, isLoading: isLoadingEmps } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.getEmployees({ limit: 1000 })
  });

  const employees = employeesData?.data || [];

  // Query for tasks with current filter states
  const { data: tasks = [], isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks', selectedDept, selectedPriority, selectedAssignee],
    queryFn: () => api.getTasks({
      departmentId: selectedDept,
      priority: selectedPriority,
      assigneeId: selectedAssignee
    })
  });

  // Mutation to update task status
  const updateStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) => 
      api.updateTask(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      // If the detail modal is open for this task, invalidate it too
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: ['taskDetails', selectedTaskId] });
      }
    }
  });

  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    updateStatusMutation.mutate({ taskId, status });
  };

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setDetailsVisible(true);
  };

  const handleClearFilters = () => {
    setSelectedDept(undefined);
    setSelectedPriority(undefined);
    setSelectedAssignee(undefined);
  };

  const isFilterActive = selectedDept !== undefined || selectedPriority !== undefined || selectedAssignee !== undefined;

  return (
    <div style={{ minHeight: '100%' }}>
      {/* HEADER SECTION */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Workspace Kanban
          </h1>
          <p className="body-text" style={{ margin: '4px 0 0 0' }}>
            Coordinate tasks, check progress, assign work cards, log notes, and review deliverables in real-time.
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateVisible(true)}
          style={{
            height: 40,
            borderRadius: 8,
            background: '#10B981',
            borderColor: '#10B981',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center'
          }}
        >
          Create Task
        </Button>
      </div>

      {/* FILTER PANEL */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }} bodyStyle={{ padding: '16px 20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <Space size={16} wrap>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontSize: 13 }}>
              <FilterOutlined />
              <span>Filters:</span>
            </div>

            {/* Department Filter */}
            <Select
              placeholder="All Departments"
              value={selectedDept}
              onChange={setSelectedDept}
              allowClear
              style={{ width: 180 }}
              loading={isLoadingDepts}
            >
              {departments.map((dept) => (
                <Select.Option key={dept.id} value={dept.id}>{dept.name}</Select.Option>
              ))}
            </Select>

            {/* Priority Filter */}
            <Select
              placeholder="All Priorities"
              value={selectedPriority}
              onChange={setSelectedPriority}
              allowClear
              style={{ width: 150 }}
            >
              <Select.Option value="Low">Low</Select.Option>
              <Select.Option value="Medium">Medium</Select.Option>
              <Select.Option value="High">High</Select.Option>
              <Select.Option value="Urgent">Urgent</Select.Option>
            </Select>

            {/* Assignee Filter */}
            <Select
              placeholder="All Assignees"
              value={selectedAssignee}
              onChange={setSelectedAssignee}
              allowClear
              showSearch
              optionFilterProp="children"
              style={{ width: 200 }}
              loading={isLoadingEmps}
            >
              {employees.map((emp) => (
                <Select.Option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</Select.Option>
              ))}
            </Select>

            {isFilterActive && (
              <Button type="text" onClick={handleClearFilters} style={{ color: '#EF4444', fontSize: 13 }}>
                Clear Filters
              </Button>
            )}
          </Space>

          <Button 
            type="text" 
            icon={<SyncOutlined spin={isLoadingTasks} />} 
            onClick={() => refetchTasks()}
            style={{ color: '#64748B' }}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* KANBAN BOARD */}
      {isLoadingTasks || isLoadingDepts || isLoadingEmps ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip="Loading task boards..." />
        </div>
      ) : (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* CREATE MODAL */}
      <TaskCreateModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        employees={employees}
        departments={departments}
      />

      {/* DETAIL MODAL */}
      <TaskDetailsModal
        taskId={selectedTaskId}
        visible={detailsVisible}
        onClose={() => {
          setDetailsVisible(false);
          setSelectedTaskId(null);
        }}
        employees={employees}
        departments={departments}
      />
    </div>
  );
};

export default TaskWorkspace;
