import React from 'react';
import { Card, Avatar, Tooltip, Badge, Dropdown, MenuProps, Space, Button } from 'antd';
import { 
  MessageOutlined, 
  CalendarOutlined, 
  UserOutlined,
  MoreOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Task, TaskStatus, TaskPriority } from '../../types';
import { API_URL } from '../../services/api';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (taskId: number) => void;
  onStatusChange: (taskId: number, newStatus: TaskStatus) => void;
}

const COLUMNS: { key: TaskStatus; label: string; bg: string; dotColor: string }[] = [
  { key: 'Todo', label: 'To Do', bg: '#F1F5F9', dotColor: '#64748B' },
  { key: 'In Progress', label: 'In Progress', bg: '#EFF6FF', dotColor: '#3B82F6' },
  { key: 'In Review', label: 'In Review', bg: '#FEF3C7', dotColor: '#F59E0B' },
  { key: 'Done', label: 'Completed', bg: '#ECFDF5', dotColor: '#10B981' }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  onTaskClick,
  onStatusChange
}) => {
  
  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', taskId.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (taskIdStr) {
      const taskId = parseInt(taskIdStr, 10);
      onStatusChange(taskId, targetStatus);
    }
  };

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case 'Urgent': return '#EF4444';
      case 'High': return '#F59E0B';
      case 'Medium': return '#3B82F6';
      case 'Low': return '#94A3B8';
      default: return '#E2E8F0';
    }
  };

  const isOverdue = (dueDate: string | null | undefined, status: TaskStatus) => {
    if (!dueDate || status === 'Done') return false;
    return dayjs(dueDate).isBefore(dayjs(), 'day');
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'Todo': return <ClockCircleOutlined style={{ color: '#64748B' }} />;
      case 'In Progress': return <PlayCircleOutlined style={{ color: '#3B82F6' }} />;
      case 'In Review': return <FileSearchOutlined style={{ color: '#F59E0B' }} />;
      case 'Done': return <CheckCircleOutlined style={{ color: '#10B981' }} />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      overflowX: 'auto',
      gap: 20,
      alignItems: 'start',
      fontFamily: 'Inter',
      minHeight: '650px',
      paddingBottom: 16,
      width: '100%',
      WebkitOverflowScrolling: 'touch'
    }}>
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.key);
        
        return (
          <div
            key={column.key}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.key)}
            style={{
              background: '#F8FAFC',
              borderRadius: 12,
              padding: 16,
              border: '1px solid #E2E8F0',
              minHeight: 600,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 1px 2px 0 rgba(0,0,0,0.02)',
              width: 280,
              flexShrink: 0
            }}
          >
            {/* COLUMN HEADER */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 8,
              borderBottom: '1px solid #E2E8F0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {getStatusIcon(column.key)}
                <span style={{ fontWeight: 600, fontSize: 14, color: '#1E293B' }}>{column.label}</span>
                <span style={{
                  background: '#E2E8F0',
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '1px 6px',
                  borderRadius: 10,
                  marginLeft: 4
                }}>
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* TASK CARDS PORT */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              flexGrow: 1,
              overflowY: 'auto'
            }}>
              {columnTasks.map((task) => {
                const assigneeName = task.assignee 
                  ? `${task.assignee.first_name} ${task.assignee.last_name}`
                  : 'Unassigned';
                const assigneeAvatar = task.assignee?.avatar_url 
                  ? `${API_URL.replace('/api', '')}/${task.assignee.avatar_url}`
                  : undefined;
                
                const taskOverdue = isOverdue(task.due_date, task.status);

                // Quick move dropdown menu items
                const statusMenuProps: MenuProps = {
                  items: COLUMNS
                    .filter((c) => c.key !== task.status)
                    .map((c) => ({
                      key: c.key,
                      label: `Move to ${c.label}`,
                      icon: <ArrowRightOutlined />
                    })),
                  onClick: ({ key }) => onStatusChange(task.id, key as TaskStatus)
                };

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task.id)}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: 10,
                      border: '1px solid #E2E8F0',
                      borderLeft: `4px solid ${getPriorityColor(task.priority)}`,
                      padding: 14,
                      cursor: 'grab',
                      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    className="task-card-hover"
                    onClick={() => onTaskClick(task.id)}
                  >
                    
                    {/* CARD HEADER: Title & More Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 8
                    }}>
                      <h4 style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#0F172A',
                        lineHeight: 1.4,
                        margin: 0,
                        flexGrow: 1
                      }}>
                        {task.title}
                      </h4>
                      
                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown menu={statusMenuProps} trigger={['click']} placement="bottomRight">
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<MoreOutlined style={{ fontSize: 16 }} />} 
                            style={{ padding: 0, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          />
                        </Dropdown>
                      </div>
                    </div>

                    {/* CARD DESCRIPTION PREVIEW */}
                    {task.description && (
                      <p style={{
                        fontSize: 12,
                        color: '#64748B',
                        margin: '0 0 12px 0',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.4
                      }}>
                        {task.description}
                      </p>
                    )}

                    {/* CARD FOOTER: Due Date & Comments & Assignee */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        
                        {/* Due Date Indicator */}
                        {task.due_date && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            color: taskOverdue ? '#EF4444' : '#64748B',
                            fontWeight: taskOverdue ? 600 : 400
                          }}>
                            <CalendarOutlined style={{ fontSize: 11 }} />
                            <span>{dayjs(task.due_date).format('MMM D')}</span>
                          </div>
                        )}

                        {/* Comments Badge count */}
                        {task.comments && task.comments.length > 0 && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            color: '#64748B'
                          }}>
                            <MessageOutlined style={{ fontSize: 11 }} />
                            <span>{task.comments.length}</span>
                          </div>
                        )}
                      </div>

                      {/* Assignee Avatar */}
                      <Tooltip title={assigneeName}>
                        <Avatar
                          src={assigneeAvatar}
                          icon={!assigneeAvatar && <UserOutlined />}
                          size="small"
                          style={{
                            backgroundColor: '#10B981',
                            border: '1px solid #FFFFFF'
                          }}
                        />
                      </Tooltip>
                    </div>

                  </div>
                );
              })}

              {columnTasks.length === 0 && (
                <div style={{
                  border: '1px dashed #E2E8F0',
                  borderRadius: 10,
                  padding: '24px 0',
                  textAlign: 'center',
                  color: '#94A3B8',
                  fontSize: 12,
                  marginTop: 8
                }}>
                  Drop tasks here
                </div>
              )}
            </div>

          </div>
        );
      })}
    </div>
  );
};
