import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Radio, Typography, Badge, Timeline, Alert, message, Space, Divider } from 'antd';
import { 
  ClockCircleOutlined, 
  EnvironmentOutlined, 
  HomeOutlined, 
  LoginOutlined, 
  LogoutOutlined,
  CalendarOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { AttendanceStatus } from '../../types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export const PunchBoard: React.FC = () => {
  const queryClient = useQueryClient();
  const [time, setTime] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [workMode, setWorkMode] = useState<AttendanceStatus>('Present'); // Present = Office Desk, Work From Home = Remote
  const [remarks, setRemarks] = useState<string>('');

  // 1. Digital Clock effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDateStr(now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch today's status
  const { data: todayRecord, isLoading, refetch: refetchToday } = useQuery({
    queryKey: ['attendanceToday'],
    queryFn: api.getAttendanceToday,
  });

  // 3. Check-In Mutation
  const checkInMutation = useMutation({
    mutationFn: (payload: { status: AttendanceStatus; remarks?: string }) => api.checkIn(payload),
    onSuccess: () => {
      message.success('Check-in recorded successfully!');
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
      setRemarks('');
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to check in.');
    }
  });

  // 4. Check-Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: api.checkOut,
    onSuccess: () => {
      message.success('Check-out recorded successfully! Shift completed.');
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceHistory'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to check out.');
    }
  });

  const handlePunch = () => {
    if (!todayRecord) {
      // Check-in
      checkInMutation.mutate({
        status: workMode,
        remarks: remarks.trim() || undefined
      });
    } else {
      // Check-out
      checkOutMutation.mutate();
    }
  };

  const getStatusBadge = () => {
    if (!todayRecord) return <Badge status="default" text="Not Checked In" />;
    
    switch (todayRecord.status) {
      case 'Present':
        return <Badge status="success" text="In Office Shift" />;
      case 'Work From Home':
        return <Badge status="processing" text="Working Remote (WFH)" />;
      case 'Late':
        return <Badge status="warning" text="Shift Started (Late Arrival)" />;
      case 'Half Day':
        return <Badge status="warning" text="Half Day Shift" />;
      case 'Absent':
        return <Badge status="error" text="Marked Absent" />;
      default:
        return <Badge status="default" text="Checked In" />;
    }
  };

  const getStatusDetails = () => {
    if (!todayRecord) {
      return {
        cardColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        textColor: '#64748B',
        desc: 'Start your workday by punching in.'
      };
    }
    
    if (todayRecord.check_out) {
      return {
        cardColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        textColor: '#065F46',
        desc: `Shift completed. Worked for ${todayRecord.working_hours || 0} hours.`
      };
    }

    if (todayRecord.status === 'Late') {
      return {
        cardColor: '#FFFBEB',
        borderColor: '#FDE68A',
        textColor: '#92400E',
        desc: 'Checked in late. Shift in progress.'
      };
    }

    return {
      cardColor: '#F0FDF4',
      borderColor: '#BBF7D0',
      textColor: '#166534',
      desc: 'Shift is active. Have a productive day!'
    };
  };

  const details = getStatusDetails();

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '12px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        
        {/* PUNCH INTERFACE */}
        <Card
          bordered={false}
          style={{
            borderRadius: 16,
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            textAlign: 'center',
            padding: '24px 12px',
            background: '#FFFFFF'
          }}
        >
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Text style={{ fontSize: 14, color: '#64748B', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {dateStr}
            </Text>
            
            {/* Real-time Clock Display */}
            <Title level={1} style={{ 
              fontSize: '3.5rem', 
              margin: '12px 0', 
              color: '#0F172A', 
              fontFamily: 'Courier New, monospace',
              fontWeight: 700,
              letterSpacing: 2
            }}>
              {time || '00:00:00'}
            </Title>
            
            <div style={{ margin: '8px 0 24px' }}>
              {getStatusBadge()}
            </div>
          </Space>

          {/* Quick Stats Panel if Checked In */}
          {todayRecord && (
            <div style={{ 
              background: details.cardColor, 
              border: `1px solid ${details.borderColor}`,
              borderRadius: 12, 
              padding: '16px 24px', 
              margin: '0 auto 24px', 
              maxWidth: 500,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              textAlign: 'left'
            }}>
              <Text style={{ fontSize: 13, color: details.textColor, fontWeight: 600 }}>
                {details.desc}
              </Text>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <Space direction="vertical" size={0}>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Check-in</Text>
                  <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: 600 }}>
                    {todayRecord.check_in ? new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </Text>
                </Space>
                <Space direction="vertical" size={0}>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Check-out</Text>
                  <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: 600 }}>
                    {todayRecord.check_out ? new Date(todayRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </Text>
                </Space>
                <Space direction="vertical" size={0}>
                  <Text style={{ fontSize: 11, color: '#64748B' }}>Duration</Text>
                  <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: 600 }}>
                    {todayRecord.working_hours ? `${todayRecord.working_hours} hrs` : '--'}
                  </Text>
                </Space>
              </div>
            </div>
          )}

          {/* Interactive controls */}
          {!todayRecord && (
            <div style={{ maxWidth: 500, margin: '0 auto 24px', textAlign: 'left' }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#475569' }}>
                  Select Work Status
                </Text>
                <Radio.Group 
                  value={workMode} 
                  onChange={(e) => setWorkMode(e.target.value)}
                  style={{ width: '100%' }}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="Present" style={{ width: '33.33%', textAlign: 'center' }}>
                    <EnvironmentOutlined /> Office Desk
                  </Radio.Button>
                  <Radio.Button value="Work From Home" style={{ width: '33.33%', textAlign: 'center' }}>
                    <HomeOutlined /> Remote (WFH)
                  </Radio.Button>
                  <Radio.Button value="Half Day" style={{ width: '33.33%', textAlign: 'center' }}>
                    <CalendarOutlined /> Half Day
                  </Radio.Button>
                </Radio.Group>
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, color: '#475569' }}>
                  Remarks / Notes (Optional)
                </Text>
                <TextArea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Mention tasks for the day or reason for WFH/Late check-in..."
                  maxLength={250}
                  style={{ borderRadius: 8 }}
                />
              </div>
            </div>
          )}

          {/* Large Punch Button */}
          <div style={{ marginTop: 12 }}>
            <Button
              type="primary"
              disabled={isLoading || (todayRecord && todayRecord.check_out ? true : false)}
              onClick={handlePunch}
              loading={checkInMutation.isPending || checkOutMutation.isPending}
              icon={!todayRecord ? <LoginOutlined /> : <LogoutOutlined />}
              style={{
                height: 52,
                padding: '0 48px',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 26,
                boxShadow: !todayRecord 
                  ? '0 10px 15px -3px rgba(16, 185, 129, 0.3)' 
                  : '0 10px 15px -3px rgba(239, 68, 68, 0.3)',
                background: !todayRecord ? '#10B981' : '#EF4444',
                borderColor: !todayRecord ? '#10B981' : '#EF4444'
              }}
            >
              {!todayRecord ? 'Clock In Shift' : 'Clock Out Shift'}
            </Button>
            
            {todayRecord && todayRecord.check_out && (
              <Paragraph style={{ color: '#64748B', marginTop: 12, fontSize: 13 }}>
                You have successfully completed your shift for today. Good work!
              </Paragraph>
            )}
          </div>
        </Card>

        {/* TIMELINE / TODAY'S ACTIVITY */}
        <Card 
          title={<span style={{ fontWeight: 600 }}><DashboardOutlined /> Punch Timeline</span>}
          bordered={false}
          style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)' }}
        >
          {todayRecord ? (
            <Timeline mode="left" style={{ marginTop: 16 }}>
              {todayRecord.check_in && (
                <Timeline.Item color="green" label={new Date(todayRecord.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}>
                  <Text strong>Checked In</Text>
                  <div>
                    <Badge count={todayRecord.status} style={{ backgroundColor: todayRecord.status === 'Present' ? '#10B981' : todayRecord.status === 'Work From Home' ? '#3B82F6' : '#F59E0B', fontSize: 11, marginTop: 4 }} />
                  </div>
                  {todayRecord.remarks && (
                    <Paragraph style={{ color: '#64748B', fontSize: 12, marginTop: 6, fontStyle: 'italic', background: '#F8FAFC', padding: 8, borderRadius: 6 }}>
                      "{todayRecord.remarks}"
                    </Paragraph>
                  )}
                </Timeline.Item>
              )}
              {todayRecord.check_out && (
                <Timeline.Item color="red" label={new Date(todayRecord.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}>
                  <Text strong>Checked Out</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Completed shift duration: {todayRecord.working_hours} hours.
                    </Text>
                  </div>
                </Timeline.Item>
              )}
            </Timeline>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8' }}>
              <ClockCircleOutlined style={{ fontSize: 32, marginBottom: 12 }} />
              <Paragraph>No punch activities logged for today yet.</Paragraph>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
