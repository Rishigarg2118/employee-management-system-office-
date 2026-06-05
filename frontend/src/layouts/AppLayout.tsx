import React, { useState } from 'react';
import { Layout, Menu, Button, Input, Dropdown, Badge, Avatar, Space } from 'antd';
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
  CheckSquareOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../services/api';

const { Header, Sider, Content } = Layout;

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else {
      navigate(key);
    }
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
    if (path.startsWith('/settings')) return '/settings';
    return '/';
  };

  const isTabAllowed = (key: string, role?: string): boolean => {
    if (!role) return false;
    if (role === 'Super Admin' || role === 'Admin') {
      return true;
    }
    if (role === 'HR') {
      return ['/', '/employees', '/skills', '/documents', '/leaves', '/attendance', '/tasks'].includes(key);
    }
    if (role === 'Manager' || role === 'Employee') {
      return ['/', '/employees', '/leaves', '/attendance', '/tasks'].includes(key);
    }
    if (role === 'Intern') {
      return ['/', '/employees', '/leaves', '/attendance'].includes(key);
    }
    return false;
  };

  // Build menu items
  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
    { key: '/employees', icon: <UserOutlined />, label: 'Employees' },
    { key: '/departments', icon: <AppstoreOutlined />, label: 'Departments' },
    { key: '/skills', icon: <BulbOutlined />, label: 'Skills' },
    { key: '/documents', icon: <FileTextOutlined />, label: 'Documents' },
    { key: '/leaves', icon: <CalendarOutlined />, label: 'Leaves' },
    { key: '/attendance', icon: <ClockCircleOutlined />, label: 'Attendance' },
    { key: '/tasks', icon: <CheckSquareOutlined />, label: 'Tasks' },
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

  return (
    <Layout style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* LEFT SIDEBAR */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={240}
        theme="dark"
        style={{
          borderRight: '1px solid #1E293B',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          height: '100vh',
          background: '#0F172A'
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          borderBottom: '1px solid #1E293B',
          gap: 12
        }}>
          <div style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: 14
          }}>
            Ω
          </div>
          {!collapsed && (
            <span style={{
              fontWeight: 600,
              fontSize: 16,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
              fontFamily: 'var(--font-sans)'
            }}>
              Social Connect
            </span>
          )}
        </div>
        
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[getActiveKey()]}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 16, background: 'transparent' }}
          items={filteredMenuItems}
        />
      </Sider>

      <Layout style={{ 
        marginLeft: collapsed ? 80 : 240, 
        transition: 'all 0.2s',
        background: '#F8FAFC'
      }}>
        {/* TOP HEADER */}
        <Header style={{
          padding: '0 24px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          height: 64
        }}>
          <Space size={16}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: '16px', width: 40, height: 40 }}
            />
            <Input
              placeholder="Search anything..."
              prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
              style={{
                width: 280,
                height: 36,
                background: 'var(--hover-color)',
                border: 'none',
                borderRadius: 6
              }}
              onPressEnter={(e) => navigate(`/employees?search=${(e.target as HTMLInputElement).value}`)}
            />
          </Space>

          <Space size={20}>
            {/* Quick Action Button */}
            <Dropdown menu={quickActionsMenu} placement="bottomRight" trigger={['click']}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                style={{ 
                  height: 36, 
                  display: 'flex', 
                  alignItems: 'center',
                  background: '#10B981',
                  borderColor: '#10B981',
                  borderRadius: 6
                }}
              >
                Quick Action
              </Button>
            </Dropdown>

            {/* Notifications */}
            <Badge dot color="#10B981">
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </Badge>

            {/* User Dropdown */}
            <Dropdown menu={profileMenu} placement="bottomRight" trigger={['click']}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <Avatar 
                  src={avatarUrl} 
                  icon={!avatarUrl && <UserOutlined />} 
                  style={{ backgroundColor: '#10B981' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>
                    {userFullName}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    {user?.role}
                  </span>
                </div>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {/* CONTENT CANVAS */}
        <Content style={{
          padding: '32px 40px',
          background: '#F8FAFC',
          minHeight: 'calc(100vh - 64px)'
        }}>
          <div className="fade-in">
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};
