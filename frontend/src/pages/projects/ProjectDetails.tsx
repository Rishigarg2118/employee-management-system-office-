import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, Button, Tag, Space, Avatar, Tooltip, Progress, Row, Col, 
  Statistic, Typography, Breadcrumb, Spin, Card as AntCard, Empty, message 
} from 'antd';
import { 
  ArrowLeftOutlined, ProjectOutlined, CalendarOutlined, UserOutlined, 
  TeamOutlined, PlusOutlined, CheckSquareOutlined, ClockCircleOutlined,
  PlayCircleOutlined, SmileOutlined
} from '@ant-design/icons';
import api, { SERVER_URL } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Project, Task, TaskStatus } from '../../types';
import { KanbanBoard } from '../tasks/KanbanBoard';
import { TaskDetailsModal } from '../tasks/TaskDetailsModal';
import { TaskCreateModal } from '../tasks/TaskCreateModal';

const { Title, Text, Paragraph } = Typography;

export const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const projectId = id ? parseInt(id) : 0;
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Modal states
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  // Queries
  const { data: project, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: () => api.getProjectById(projectId),
    enabled: projectId > 0
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<Task[]>({
    queryKey: ['projectTasks', projectId],
    queryFn: () => api.getTasks({ projectId }),
    enabled: projectId > 0
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.getDepartments()
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.getEmployees({ limit: 1000 })
  });
  const employees = employeesData?.data || [];

  // Mutations
  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) => 
      api.updateTask(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] });
      if (selectedTaskId) {
        queryClient.invalidateQueries({ queryKey: ['taskDetails', selectedTaskId] });
      }
      message.success('Task status updated.');
    }
  });

  if (isLoadingProject) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="Loading project details..." />
      </div>
    );
  }

  if (!project) {
    return (
      <Card bordered={false} style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
        <Empty description="Project not found." />
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')} style={{ marginTop: 16 }}>
          Back to Projects
        </Button>
      </Card>
    );
  }

  // Calculate task statistics
  const totalTasks = tasks.length;
  const todoTasks = tasks.filter(t => t.status === 'Todo').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const inReviewTasks = tasks.filter(t => t.status === 'In Review').length;
  const doneTasks = tasks.filter(t => t.status === 'Done').length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // Handle task status transition on drop/move
  const handleStatusChange = (taskId: number, status: TaskStatus) => {
    updateTaskStatusMutation.mutate({ taskId, status });
  };

  const handleTaskClick = (taskId: number) => {
    setSelectedTaskId(taskId);
    setDetailsVisible(true);
  };

  const renderStatusTag = (status: string) => {
    let color = 'blue';
    if (status === 'Active') color = 'green';
    else if (status === 'Review') color = 'orange';
    else if (status === 'Completed') color = 'emerald';
    else if (status === 'Archived') color = 'gray';

    const customStyle = color === 'emerald' ? { color: '#10B981', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' } : {};
    return (
      <Tag color={color === 'emerald' ? undefined : color} style={{ ...customStyle, fontSize: 13, padding: '2px 10px', borderRadius: 4 }}>
        {status}
      </Tag>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb style={{ fontSize: 13 }}>
        <Breadcrumb.Item><Link to="/projects">Projects</Link></Breadcrumb.Item>
        <Breadcrumb.Item>{project.name}</Breadcrumb.Item>
      </Breadcrumb>

      {/* Main Header Panel */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <Space direction="vertical" size={12} style={{ maxWidth: '70%' }}>
            <Space size={12}>
              <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>{project.name}</Title>
              {renderStatusTag(project.status)}
            </Space>
            <Paragraph style={{ margin: 0, color: '#475569', fontSize: 14 }}>
              {project.description || 'No description provided for this project.'}
            </Paragraph>
            
            {/* Timeline info */}
            <Space size={20} style={{ marginTop: 8, flexWrap: 'wrap' }}>
              <Space size={6} style={{ fontSize: 13, color: '#64748B' }}>
                <CalendarOutlined />
                <span>Start: <strong>{project.start_date}</strong></span>
              </Space>
              <Space size={6} style={{ fontSize: 13, color: '#64748B' }}>
                <CalendarOutlined />
                <span>Deadline: <strong>{project.deadline || 'No Deadline'}</strong></span>
              </Space>
              <Space size={6} style={{ fontSize: 13, color: '#64748B' }}>
                <TeamOutlined />
                <span>Team Size: <strong>{project.members?.length || 0} staff</strong></span>
              </Space>
            </Space>
          </Space>

          {/* Project Manager Details card */}
          <div style={{ 
            padding: '16px 20px', 
            background: '#F8FAFC', 
            borderRadius: 8, 
            border: '1px solid #E2E8F0',
            minWidth: 260
          }}>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Project Manager
            </Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <Avatar 
                src={project.manager?.avatar_url ? `${SERVER_URL}/${project.manager.avatar_url}` : undefined}
                icon={!project.manager?.avatar_url && <UserOutlined />}
                size="large"
                style={{ backgroundColor: '#10B981' }}
              />
              <div>
                {project.manager ? (
                  <>
                    <Text strong style={{ display: 'block', fontSize: 13, color: '#0F172A' }}>
                      {project.manager.first_name} {project.manager.last_name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {project.manager.designation}
                    </Text>
                  </>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>Unassigned</Text>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Row containing Stats & Team Members list */}
      <Row gutter={[20, 20]}>
        {/* Project Progress stats */}
        <Col xs={24} lg={14}>
          <Card 
            title={<Space><CheckSquareOutlined /><span>Project Progress</span></Space>}
            bordered={false} 
            style={{ borderRadius: 12, height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong style={{ color: '#475569' }}>Overall Completion</Text>
                  <Text strong style={{ color: '#10B981' }}>{progressPercent}%</Text>
                </div>
                <Progress percent={progressPercent} strokeColor="#10B981" showInfo={false} strokeWidth={10} />
              </div>

              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title={<Text type="secondary" style={{ fontSize: 12 }}>To Do</Text>} 
                    value={todoTasks} 
                    valueStyle={{ fontWeight: 700, color: '#64748B', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title={<Text type="secondary" style={{ fontSize: 12 }}>In Progress</Text>} 
                    value={inProgressTasks} 
                    valueStyle={{ fontWeight: 700, color: '#3B82F6', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title={<Text type="secondary" style={{ fontSize: 12 }}>In Review</Text>} 
                    value={inReviewTasks} 
                    valueStyle={{ fontWeight: 700, color: '#F59E0B', fontSize: 20 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Done</Text>} 
                    value={doneTasks} 
                    valueStyle={{ fontWeight: 700, color: '#10B981', fontSize: 20 }}
                  />
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        {/* Team Members List */}
        <Col xs={24} lg={10}>
          <Card 
            title={<Space><TeamOutlined /><span>Team Allocated ({project.members?.length || 0})</span></Space>}
            bordered={false} 
            style={{ borderRadius: 12, height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 120, overflowY: 'auto' }}>
              {project.members && project.members.length > 0 ? (
                project.members.map(member => (
                  <Tooltip key={member.id} title={`${member.first_name} ${member.last_name} - ${member.designation}`}>
                    <Avatar 
                      src={member.avatar_url ? `${SERVER_URL}/${member.avatar_url}` : undefined}
                      icon={!member.avatar_url && <UserOutlined />}
                      size="large"
                      style={{ 
                        border: '2px solid #FFFFFF', 
                        backgroundColor: '#3B82F6',
                        cursor: 'pointer' 
                      }}
                      onClick={() => navigate(`/employees/${member.id}`)}
                    />
                  </Tooltip>
                ))
              ) : (
                <Empty description="No team members allocated." image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Task Kanban board header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 700, color: '#0F172A' }}>Tasks board</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Manage sprints, dependencies, status pipelines, and review logs for this project.
          </Text>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setCreateVisible(true)}
          style={{ height: 38, background: '#10B981', borderColor: '#10B981', borderRadius: 6 }}
        >
          Add Task
        </Button>
      </div>

      {/* Kanban Board Container */}
      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: '24px 20px' }}>
        {isLoadingTasks ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
            <Spin tip="Loading project task boards..." />
          </div>
        ) : (
          <KanbanBoard 
            tasks={tasks}
            onTaskClick={handleTaskClick}
            onStatusChange={handleStatusChange}
          />
        )}
      </Card>

      {/* Creation Modal */}
      <TaskCreateModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        employees={employees}
        departments={departments}
        projectId={project.id}
      />

      {/* Task Details Modal */}
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
