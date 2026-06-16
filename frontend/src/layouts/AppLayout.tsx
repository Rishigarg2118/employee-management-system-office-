import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Input, Dropdown, Badge, Avatar, Space, Drawer, List, Typography, Divider } from 'antd';
import { 
  DashboardOutlined, 
  UserOutlined, 
  AppstoreOutlined, 
  BulbOutlined, 
  FileTextOutlined, 
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  PlusOutlined,
  LogoutOutlined,
  SearchOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CheckSquareOutlined,
  ProjectOutlined,
  TeamOutlined,
  BarChartOutlined,
  HistoryOutlined,
  DesktopOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api, { API_URL } from '../services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlobalSearch } from '../components/GlobalSearch';

const { Header, Sider, Content } = Layout;

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isClassic = theme === 'classic';
  const navigate = useNavigate();
  const location = useLocation();

  const [notifDrawerVisible, setNotifDrawerVisible] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const queryClient = useQueryClient();

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Global Heartbeat and User Activity Monitoring
  useEffect(() => {
    if (!user) return;

    let clickCount = 0;
    let keyCount = 0;

    const handleTrackClick = () => { clickCount++; };
    const handleTrackKey = () => { keyCount++; };

    document.addEventListener('click', handleTrackClick);
    document.addEventListener('keydown', handleTrackKey);

    const sendPing = async () => {
      try {
        const attendance = await api.getAttendanceToday();
        if (attendance && !attendance.check_out) {
          const onBreak = localStorage.getItem('on_break') === 'true';
          const status = onBreak ? 'Break' : (clickCount + keyCount > 0 ? 'Active' : 'Idle');
          
          await api.submitHeartbeat({
            status,
            mouseClicks: clickCount,
            keyboardPresses: keyCount,
            activeWindow: document.title || 'Web Browser'
          });

          // Reset counters after successful ping
          clickCount = 0;
          keyCount = 0;
        }
      } catch (err) {
        // Silently catch error if backend returns 400 (not checked in)
      }
    };

    // Ping every 30 seconds
    const interval = setInterval(sendPing, 30000);

    return () => {
      document.removeEventListener('click', handleTrackClick);
      document.removeEventListener('keydown', handleTrackKey);
      clearInterval(interval);
    };
  }, [user]);

  // Query notifications
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      return await api.getNotifications();
    },
    enabled: !!user,
    refetchInterval: 60000 // Poll every 60s
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // Mutation to mark notification as read
  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.markNotificationAsRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  // Mutation to mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.markAllNotificationsAsRead();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else {
      navigate(key);
    }
    setMobileMenuVisible(false);
  };

  const getActiveKey = () => {
    const path = location.pathname;
    if (path === '/' || path.startsWith('/dashboard')) return '/';
    if (path.startsWith('/employees')) return '/employees';
    if (path.startsWith('/departments')) return '/departments';
    if (path.startsWith('/skills')) return '/skills';
    if (path.startsWith('/documents')) return '/documents';
    if (path.startsWith('/leaves')) return '/leaves';
    if (path.startsWith('/attendance')) return '/attendance';
    if (path.startsWith('/tasks')) return '/tasks';
    if (path.startsWith('/projects')) return '/projects';
    if (path.startsWith('/teams')) return '/teams';
    if (path.startsWith('/reports')) return '/reports';
    if (path.startsWith('/audit-logs')) return '/audit-logs';
    if (path.startsWith('/assets')) return '/assets';
    if (path.startsWith('/settings')) return '/settings';
    return '/';
  };
  const isTabAllowed = (key: string, role?: string): boolean => {
    if (!role) return false;
    if (role === 'Super Admin' || role === 'Admin') {
      return true;
    }
    if (role === 'HR') {
      return ['/', '/employees', '/skills', '/documents', '/leaves', '/attendance', '/reports', '/assets'].includes(key);
    }
    if (role === 'Manager') {
      return ['/', '/projects', '/teams', '/tasks', '/attendance', '/leaves', '/assets'].includes(key);
    }
    if (role === 'Employee') {
      return ['/', '/tasks', '/attendance', '/leaves', '/projects', '/assets'].includes(key);
    }
    if (role === 'Intern') {
      return ['/', '/tasks', '/attendance', '/leaves', '/assets'].includes(key);
    }
    return false;
  };

  // Build menu items
  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/employees', icon: <UserOutlined />, label: 'Employees' },
    { key: '/departments', icon: <AppstoreOutlined />, label: 'Departments' },
    { key: '/teams', icon: <TeamOutlined />, label: 'Teams' },
    { key: '/projects', icon: <ProjectOutlined />, label: 'Projects' },
    { key: '/skills', icon: <BulbOutlined />, label: 'Skills' },
    { key: '/documents', icon: <FileTextOutlined />, label: 'Documents' },
    { key: '/assets', icon: <DesktopOutlined />, label: 'Assets' },
    { key: '/leaves', icon: <CalendarOutlined />, label: 'Leaves' },
    { key: '/attendance', icon: <ClockCircleOutlined />, label: 'Attendance' },
    { key: '/tasks', icon: <CheckSquareOutlined />, label: 'Tasks' },
    { key: '/reports', icon: <BarChartOutlined />, label: 'Reports' },
    { key: '/audit-logs', icon: <HistoryOutlined />, label: 'Audit Trail' },
    { key: '/settings', icon: <SettingOutlined />, label: 'Settings' }
  ];

  const filteredMenuItems = menuItems.filter(item => isTabAllowed(item.key, user?.role));

  // User profile dropdown actions
  const profileMenu = {
    items: [
      {
        key: 'profile',
        label: <Link to={user ? `/employees/${user.id}` : '#'}>My Profile</Link>,
        icon: <UserOutlined />
      },
      {
        type: 'divider' as const
      },
      {
        key: 'logout',
        label: 'Logout',
        icon: <LogoutOutlined />,
        danger: true
      }
    ],
    onClick: handleMenuClick
  };

  // Quick actions dropdown actions
  const quickActionsMenu = {
    items: [
      {
        key: 'new-employee',
        label: <Link to="/employees/new">Add Employee</Link>,
        icon: <UserOutlined />,
        roles: ['Super Admin', 'Admin', 'HR', 'Manager']
      },
      {
        key: 'new-dept',
        label: <span onClick={() => navigate('/departments?openCreate=true')}>Add Department</span>,
        icon: <AppstoreOutlined />,
        roles: ['Super Admin', 'Admin']
      },
      {
        key: 'apply-leave',
        label: <Link to="/leaves?tab=apply">Apply for Leave</Link>,
        icon: <CalendarOutlined />,
        roles: ['Super Admin', 'Admin', 'HR', 'Manager', 'Employee', 'Intern']
      }
    ].filter(action => action.roles.includes(user?.role || ''))
  };

  const avatarUrl = user?.avatar_url ? `${API_URL.replace('/api', '')}/${user.avatar_url}` : undefined;
  const userFullName = user ? `${user.first_name} ${user.last_name}` : 'Enterprise User';

  const siderContent = (
    <>
      <div style={{
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        borderBottom: isClassic ? '1px solid var(--border)' : '1px solid var(--border-glass)',
        gap: 12
      }}>
        <div style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          background: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: 14
        }}>
          Ω
        </div>
        {(!collapsed || isMobile) && (
          <span style={{
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: '-0.02em',
            color: isClassic ? 'var(--text-primary)' : '#FFFFFF',
            fontFamily: 'var(--font-head)'
          }}>
            Social Connect
          </span>
        )}
      </div>
      
      <Menu
        theme={isClassic ? 'light' : 'dark'}
        mode="inline"
        selectedKeys={[getActiveKey()]}
        onClick={({ key }) => {
          navigate(key);
          setMobileMenuVisible(false);
        }}
        style={{ borderRight: 0, marginTop: 16, background: 'transparent' }}
        items={filteredMenuItems}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent' }}>
      {/* MOBILE DRAWER SIDEBAR */}
      {isMobile ? (
        <Drawer
          placement="left"
          onClose={() => setMobileMenuVisible(false)}
          open={mobileMenuVisible}
          bodyStyle={{ 
            padding: 0, 
            background: isClassic ? '#ffffff' : 'rgba(15, 23, 42, 0.88)', 
            backdropFilter: isClassic ? 'none' : 'blur(20px)', 
            WebkitBackdropFilter: isClassic ? 'none' : 'blur(20px)' 
          }}
          headerStyle={{ display: 'none' }}
          width={240}
        >
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {siderContent}
          </div>
        </Drawer>
      ) : (
        /* DESKTOP SIDEBAR */
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={240}
          theme={isClassic ? 'light' : 'dark'}
          style={{
            borderRight: isClassic ? '1px solid var(--border)' : '1px solid var(--border-glass)',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            height: '100vh',
            background: isClassic ? '#ffffff' : 'rgba(15, 23, 42, 0.88)',
            backdropFilter: isClassic ? 'none' : 'blur(20px)',
            WebkitBackdropFilter: isClassic ? 'none' : 'blur(20px)',
            overflowY: 'auto'
          }}
        >
          {siderContent}
        </Sider>
      )}

      <Layout style={{ 
        marginLeft: isMobile ? 0 : (collapsed ? 80 : 240), 
        transition: 'all 0.2s',
        background: 'transparent'
      }}>
        {/* TOP HEADER */}
        <Header style={{
          padding: '0 24px',
          background: isClassic ? '#ffffff' : 'var(--surface-glass)',
          backdropFilter: isClassic ? 'none' : 'blur(20px)',
          WebkitBackdropFilter: isClassic ? 'none' : 'blur(20px)',
          borderBottom: isClassic ? '1px solid var(--border)' : '1px solid var(--border-glass)',
          boxShadow: scrolled 
            ? (isClassic ? '0 4px 12px rgba(0, 0, 0, 0.05)' : '0 10px 30px -10px rgba(15, 23, 42, 0.08)') 
            : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          height: 64,
          transition: 'box-shadow 0.3s ease'
        }}>
          <Space size={16}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => {
                if (isMobile) {
                  setMobileMenuVisible(true);
                } else {
                  setCollapsed(!collapsed);
                }
              }}
              style={{ fontSize: '16px', width: 40, height: 40 }}
            />
            {!isMobile && <GlobalSearch />}
          </Space>

          <Space size={isMobile ? 8 : 20}>
            {/* Quick Action Button */}
            {!isMobile && (
              <Dropdown menu={quickActionsMenu} placement="bottomRight" trigger={['click']}>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  style={{ 
                    height: 36, 
                    display: 'flex', 
                    alignItems: 'center',
                    background: 'var(--primary)',
                    borderColor: 'var(--primary)',
                    borderRadius: 6
                  }}
                >
                  Quick Action
                </Button>
              </Dropdown>
            )}

            {/* Notifications */}
            <Badge count={unreadCount} overflowCount={9} color="var(--primary)">
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setNotifDrawerVisible(true)}
              />
            </Badge>

            {/* Theme Toggle Button */}
            <Button
              type="text"
              icon={isClassic ? <BulbOutlined style={{ fontSize: 18 }} /> : <BulbOutlined style={{ fontSize: 18, color: '#f59e0b' }} />}
              onClick={toggleTheme}
              style={{ 
                width: 36, 
                height: 36, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                transition: 'all 0.3s ease'
              }}
              title={isClassic ? "Switch to Modern Enterprise Theme" : "Switch to Classic/Minimalist Theme"}
            />

            {/* User Dropdown */}
            <Dropdown menu={profileMenu} placement="bottomRight" trigger={['click']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <Avatar 
                  src={avatarUrl} 
                  icon={!avatarUrl && <UserOutlined />} 
                  style={{ backgroundColor: 'var(--primary)' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {userFullName}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {user?.role}
                  </span>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* CONTENT CANVAS */}
        <Content 
          className="responsive-content-padding"
          style={{
            background: 'transparent',
            minHeight: 'calc(100vh - 64px)'
          }}
        >
          <div className="fade-in">
            {children}
          </div>
        </Content>
      </Layout>
      
      {/* Notifications Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Button 
                type="link" 
                onClick={() => markAllReadMutation.mutate()} 
                style={{ padding: 0, fontSize: 13, color: 'var(--primary)' }}
              >
                Mark all as read
              </Button>
            )}
          </div>
        }
        placement="right"
        onClose={() => setNotifDrawerVisible(false)}
        open={notifDrawerVisible}
        width={360}
      >
        <List
          dataSource={notifications}
          locale={{ emptyText: 'No notifications yet' }}
          renderItem={(item: any) => (
            <List.Item
              style={{
                padding: '12px 16px',
                background: item.is_read ? 'transparent' : 'rgba(234, 88, 12, 0.04)',
                borderBottom: '1px solid #F1F5F9',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (!item.is_read) {
                  markReadMutation.mutate(item.id);
                }
              }}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Typography.Text strong={!item.is_read} style={{ fontSize: 14 }}>
                      {item.title}
                    </Typography.Text>
                    {!item.is_read && <Badge status="processing" color="var(--primary)" />}
                  </div>
                }
                description={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {item.message}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                    </Typography.Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </Layout>
  );
};
