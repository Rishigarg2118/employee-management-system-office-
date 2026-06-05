import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Card, Select, Badge, Spin, Row, Col, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Text } = Typography;

export const LeaveCalendar: React.FC = () => {
  const [departmentId, setDepartmentId] = useState<number | undefined>(undefined);

  // Fetch departments for filtering
  const { data: departments, isLoading: deptsLoading } = useQuery({
    queryKey: ['departmentsForCalendar'],
    queryFn: () => api.getDepartments()
  });

  // Fetch calendar events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['leaveCalendar', departmentId],
    queryFn: () => api.getLeaveCalendar(departmentId ? { departmentId } : {})
  });

  if (deptsLoading || eventsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" tip="Compiling Roster Schedule..." />
      </div>
    );
  }

  // Render events inside date cell
  const dateCellRender = (value: dayjs.Dayjs) => {
    const dateStr = value.format('YYYY-MM-DD');
    
    // Find all events overlapping with this date
    const dayEvents = (events || []).filter(e => {
      const start = dayjs(e.start).format('YYYY-MM-DD');
      const end = dayjs(e.end).format('YYYY-MM-DD');
      return dateStr >= start && dateStr <= end;
    });

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 60, overflow: 'hidden' }}>
        {dayEvents.map(item => (
          <li key={item.id} style={{ margin: '1px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <Badge 
              color={item.color} 
              text={
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {item.extendedProps?.employeeName || 'Leave'}
                </span>
              } 
            />
          </li>
        ))}
      </ul>
    );
  };

  const cellRender = (current: dayjs.Dayjs, info: { type: string }) => {
    if (info.type === 'date') return dateCellRender(current);
    return null;
  };

  return (
    <div>
      {/* FILTER & LEGEND TOOLBAR */}
      <Card 
        bordered={false} 
        style={{ 
          marginBottom: 24 
        }}
        bodyStyle={{ padding: '16px 24px' }}
      >
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Space size={12} align="center">
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>Department Filter:</span>
              <Select
                placeholder="All Departments"
                allowClear
                style={{ width: 220 }}
                size="middle"
                value={departmentId}
                onChange={(val) => setDepartmentId(val)}
              >
                {departments?.map(d => (
                  <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
                ))}
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
            <Space size={16}>
              <Badge color="#22C55E" text={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Approved Leaves</span>} />
              <Badge color="#F59E0B" text={<span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Pending Review</span>} />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* INTERACTIVE CALENDAR BOARD */}
      <Card 
        bordered={false} 
        bodyStyle={{ padding: '24px' }}
      >
        <Calendar 
          cellRender={cellRender} 
          style={{ fontFamily: 'Inter' }}
        />
      </Card>
    </div>
  );
};
