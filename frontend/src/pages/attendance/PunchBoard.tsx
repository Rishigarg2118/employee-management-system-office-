import React, { useState, useEffect } from 'react';
import { useTelemetryAgent } from '../../hooks/useTelemetryAgent';
import { Card, Button, Input, Radio, Typography, Badge, Timeline, Alert, message, Space, Divider, Row, Col, Progress } from 'antd';
import { 
  ClockCircleOutlined, 
  EnvironmentOutlined, 
  HomeOutlined, 
  LoginOutlined, 
  LogoutOutlined,
  CalendarOutlined,
  DashboardOutlined,
  CoffeeOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  FieldTimeOutlined,
  UserDeleteOutlined
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
  

  // Dynamic timer states
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [onBreak, setOnBreak] = useState<boolean>(localStorage.getItem('on_break') === 'true');

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

  // Telemetry Agent — mounts automatically when checked in, sends heartbeat every 30s
  useTelemetryAgent(!!todayRecord && !todayRecord?.check_out, !!todayRecord?.check_out);

  // 3. Fetch today's productivity details
  const { data: productivityData, refetch: refetchProductivity } = useQuery({
    queryKey: ['productivityToday', todayRecord?.id],
    queryFn: () => api.getProductivityDetails({ date: new Date().toISOString().split('T')[0] }),
    enabled: !!todayRecord && !todayRecord.check_out,
    refetchInterval: 15000 // Refresh stats every 15 seconds
  });

  // 4. Live elapsed timer
  useEffect(() => {
    if (!todayRecord || todayRecord.check_out) {
      setElapsedTime('00:00:00');
      return;
    }

    const interval = setInterval(() => {
      const checkInTime = new Date(todayRecord.check_in!).getTime();
      const now = new Date().getTime();
      const diffMs = now - checkInTime;

      const hrs = Math.floor(diffMs / 3600000);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const secs = Math.floor((diffMs % 60000) / 1000);

      const fHrs = hrs < 10 ? '0' + hrs : hrs;
      const fMins = mins < 10 ? '0' + mins : mins;
      const fSecs = secs < 10 ? '0' + secs : secs;

      setElapsedTime(`${fHrs}:${fMins}:${fSecs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [todayRecord]);

  // 5. Check-In Mutation
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

  // 6. Check-Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: api.checkOut,
    onSuccess: () => {
      message.success('Check-out recorded successfully! Shift completed.');
      localStorage.removeItem('on_break');
      setOnBreak(false);
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

  const toggleBreak = async () => {
    if (!todayRecord) return;
    const nextBreakState = !onBreak;
    localStorage.setItem('on_break', String(nextBreakState));
    setOnBreak(nextBreakState);

    try {
      await api.submitHeartbeat({
        status: nextBreakState ? 'Break' : 'Active',
        mouseClicks: 0,
        keyboardPresses: 0,
        activeWindow: 'Workspace Break Panel'
      });
      message.success(nextBreakState ? 'Break started successfully.' : 'Work session resumed.');
      refetchProductivity();
    } catch (err) {
      message.error('Failed to update break status on the server.');
    }
  };

  const getStatusBadge = () => {
    if (!todayRecord) return <Badge status="default" text="Not Checked In" />;
    if (todayRecord.check_out) return <Badge status="default" text="Shift Completed" />;
    if (onBreak) return <Badge status="warning" text="On Break" />;
    
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

    if (onBreak) {
      return {
        cardColor: '#FEF3C7',
        borderColor: '#FDE68A',
        textColor: '#92400E',
        desc: 'You are currently on break. Timer is suspended.'
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
  const summary = productivityData?.summary || {
    activeHours: 0,
    idleHours: 0,
    breakHours: 0,
    productivityScore: 100
  };

  return (
    <div style={{ maxWidth: 850, margin: '0 auto', padding: '12px 0' }}>
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
            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {dateStr}
            </Text>
            
            {/* Real-time Clock Display or Live Session Timer */}
            {todayRecord && !todayRecord.check_out ? (
              <div>
                <Title level={1} style={{ 
                  fontSize: '3.5rem', 
                  margin: '8px 0', 
                  color: onBreak ? '#D97706' : '#10B981', 
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 700,
                  letterSpacing: 2
                }}>
                  {elapsedTime}
                </Title>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  Active Work Session Time
                </Text>
              </div>
            ) : (
              <div>
                <Title level={1} style={{ 
                  fontSize: '3.5rem', 
                  margin: '8px 0', 
                  color: '#0F172A', 
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 700,
                  letterSpacing: 2
                }}>
                  {time || '00:00:00'}
                </Title>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                  Current Local Time
                </Text>
              </div>
            )}
            
            <div style={{ margin: '12px 0 20px' }}>
              {getStatusBadge()}
            </div>
          </Space>

          {/* Live Hours & Target Compliance Grid */}
          {todayRecord && (
            <div style={{ maxWidth: 700, margin: '0 auto 24px', textAlign: 'left' }}>
              <Divider style={{ margin: '16px 0' }} />
              
              <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                {/* Target Compliance Progress */}
                <Col xs={24} md={10}>
                  <Card size="small" style={{ borderRadius: 12, border: '1px solid #E2E8F0', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
                    <Space align="center" size={16}>
                      <Progress 
                        type="circle" 
                        percent={Math.min(100, Math.round(((() => {
                          if (!todayRecord || todayRecord.check_out) {
                            return todayRecord?.working_hours ? parseFloat(String(todayRecord.working_hours)) : 0;
                          }
                          const parts = elapsedTime.split(':').map(Number);
                          if (parts.length !== 3) return 0;
                          return parts[0] + parts[1]/60 + parts[2]/3600;
                        })() / 8) * 100))} 
                        size={80} 
                        strokeColor={onBreak ? '#F59E0B' : '#10B981'}
                      />
                      <div>
                        <Text strong style={{ display: 'block', fontSize: 14 }}>Daily Compliance</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>Target: 8h shift</Text>
                        <div style={{ marginTop: 4 }}>
                          <Badge status={onBreak ? "warning" : todayRecord.check_out ? "default" : "success"} text={onBreak ? "Break" : todayRecord.check_out ? "Completed" : "Active"} />
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Col>

                {/* Status description */}
                <Col xs={24} md={14}>
                  <div style={{ 
                    background: details.cardColor, 
                    border: `1px solid ${details.borderColor}`,
                    borderRadius: 12, 
                    padding: '20px 24px', 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 8
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
                        <Text style={{ fontSize: 11, color: '#64748B' }}>Reported Hours</Text>
                        <Text style={{ fontSize: 14, color: '#0F172A', fontWeight: 600 }}>
                          {todayRecord.working_hours ? `${todayRecord.working_hours} hrs` : '--'}
                        </Text>
                      </Space>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Working Hours Stats Grid */}
              <Text strong style={{ display: 'block', marginBottom: 12, color: '#475569' }}>
                Shift Hours & Telemetry Ledger
              </Text>
              
              <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ background: '#F8FAFC', borderRadius: 8, textAlign: 'center', border: '1px solid #E2E8F0' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>WEEKLY WORKING HOURS</Text>
                    <Title level={4} style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>
                      {((() => {
                        if (!queryClient.getQueryData(['attendanceHistory'])) return '0.00';
                        const history: any = queryClient.getQueryData(['attendanceHistory']);
                        const oneWeekAgo = new Date();
                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                        let sum = 0;
                        if (Array.isArray(history)) {
                          history.forEach((rec: any) => {
                            if (new Date(rec.date) >= oneWeekAgo) sum += parseFloat(String(rec.working_hours || 0));
                          });
                        }
                        return sum.toFixed(2);
                      })())}h
                    </Title>
                  </Card>
                </Col>
                
                <Col xs={12} sm={8}>
                  <Card size="small" style={{ background: '#F8FAFC', borderRadius: 8, textAlign: 'center', border: '1px solid #E2E8F0' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>MONTHLY WORKING HOURS</Text>
                    <Title level={4} style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>
                      {((() => {
                        if (!queryClient.getQueryData(['attendanceHistory'])) return '0.00';
                        const history: any = queryClient.getQueryData(['attendanceHistory']);
                        const oneMonthAgo = new Date();
                        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
                        let sum = 0;
                        if (Array.isArray(history)) {
                          history.forEach((rec: any) => {
                            if (new Date(rec.date) >= oneMonthAgo) sum += parseFloat(String(rec.working_hours || 0));
                          });
                        }
                        return sum.toFixed(2);
                      })())}h
                    </Title>
                  </Card>
                </Col>

                <Col xs={12} sm={8}>
                  <Card size="small" style={{ background: '#F8FAFC', borderRadius: 8, textAlign: 'center', border: '1px solid #E2E8F0' }}>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>ACCUMULATED OVERTIME</Text>
                    <Title level={4} style={{ margin: '4px 0 0', fontSize: 18, color: '#10B981', fontWeight: 700 }}>
                      {((() => {
                        if (!queryClient.getQueryData(['attendanceHistory'])) return '0.00';
                        const history: any = queryClient.getQueryData(['attendanceHistory']);
                        let sum = 0;
                        if (Array.isArray(history)) {
                          history.forEach((rec: any) => {
                            const hrs = parseFloat(String(rec.working_hours || 0));
                            if (hrs > 8) sum += (hrs - 8);
                          });
                        }
                        return sum.toFixed(2);
                      })())}h
                    </Title>
                  </Card>
                </Col>
              </Row>

              {/* Productivity Breakdown Row */}
              {!todayRecord.check_out && (
                <Row gutter={[12, 12]}>
                  <Col xs={8}>
                    <Card size="small" style={{ background: '#F0FDF4', borderRadius: 8, textAlign: 'center', border: '1px solid #DCFCE7' }}>
                      <Title level={5} style={{ margin: 0, fontSize: 14, color: '#15803D' }}>{summary.activeHours.toFixed(2)}h</Title>
                      <Text type="secondary" style={{ fontSize: 10 }}>Active Time</Text>
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small" style={{ background: '#FEF2F2', borderRadius: 8, textAlign: 'center', border: '1px solid #FEE2E2' }}>
                      <Title level={5} style={{ margin: 0, fontSize: 14, color: '#991B1B' }}>{summary.idleHours.toFixed(2)}h</Title>
                      <Text type="secondary" style={{ fontSize: 10 }}>Idle Time</Text>
                    </Card>
                  </Col>
                  <Col xs={8}>
                    <Card size="small" style={{ background: '#FFFBEB', borderRadius: 8, textAlign: 'center', border: '1px solid #FEF3C7' }}>
                      <Title level={5} style={{ margin: 0, fontSize: 14, color: '#92400E' }}>{summary.breakHours.toFixed(2)}h</Title>
                      <Text type="secondary" style={{ fontSize: 10 }}>Break Time</Text>
                    </Card>
                  </Col>
                </Row>
              )}
              
              <Divider style={{ margin: '16px 0' }} />
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

          {/* Large Punch Button & Break Actions */}
          <div style={{ marginTop: 12 }}>
            <Space size={16}>
              <Button
                type="primary"
                disabled={isLoading || (todayRecord && todayRecord.check_out ? true : false)}
                onClick={handlePunch}
                loading={checkInMutation.isPending || checkOutMutation.isPending}
                icon={!todayRecord ? <LoginOutlined /> : <LogoutOutlined />}
                style={{
                  height: 50,
                  padding: '0 36px',
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 25,
                  boxShadow: !todayRecord 
                    ? '0 6px 12px -3px rgba(16, 185, 129, 0.2)' 
                    : '0 6px 12px -3px rgba(239, 68, 68, 0.2)',
                  background: !todayRecord ? '#10B981' : '#EF4444',
                  borderColor: !todayRecord ? '#10B981' : '#EF4444'
                }}
              >
                {!todayRecord ? 'Clock In Shift' : 'Clock Out Shift'}
              </Button>

              {todayRecord && !todayRecord.check_out && (
                <Button
                  onClick={toggleBreak}
                  icon={onBreak ? <PlayCircleOutlined /> : <CoffeeOutlined />}
                  style={{
                    height: 50,
                    padding: '0 36px',
                    fontSize: 15,
                    fontWeight: 600,
                    borderRadius: 25,
                    color: onBreak ? '#10B981' : '#F59E0B',
                    borderColor: onBreak ? '#10B981' : '#F59E0B',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                  }}
                >
                  {onBreak ? 'Resume Work' : 'Go on Break'}
                </Button>
              )}
            </Space>
            
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
