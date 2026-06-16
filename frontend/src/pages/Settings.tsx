import React from 'react';
import { Card, Descriptions, Tag, Space, Alert, Typography, Divider } from 'antd';
import { 
  SettingOutlined, 
  SafetyCertificateOutlined, 
  DatabaseOutlined,
  CheckCircleOutlined,
  BgColorsOutlined,
  BulbOutlined,
  LayoutOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { Title, Paragraph, Text } = Typography;

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px' }}>
      {/* HEADER SECTION */}
      <div>
        <h1 className="page-title">
          System Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Configure enterprise settings, view authorization policies, and check system environment health.
        </p>
      </div>

      {/* APPEARANCE & THEME SELECTOR CARD */}
      <Card title={<Space><BgColorsOutlined /><span>Appearance & Branding</span></Space>}>
        <Paragraph>
          Select your preferred workspace visual theme. Changes will apply immediately across all modules.
        </Paragraph>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
          
          {/* MODERN ENTERPRISE PANEL */}
          <div 
            onClick={() => setTheme('modern')}
            style={{
              border: theme === 'modern' ? '2px solid #ea580c' : '1px solid var(--border-glass, #e2e8f0)',
              borderRadius: '16px',
              padding: '20px',
              cursor: 'pointer',
              background: theme === 'modern' ? 'rgba(234, 88, 12, 0.04)' : 'rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: theme === 'modern' ? '0 10px 25px -5px rgba(234, 88, 12, 0.15)' : 'var(--shadow-premium)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {theme === 'modern' && (
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#ea580c',
                boxShadow: '0 0 10px #ea580c'
              }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ea580c 0%, #d97706 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BulbOutlined style={{ fontSize: 18 }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Modern Enterprise</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PREMIUM GLASSMORPHIC</span>
              </div>
            </div>
            <Paragraph style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Flagship aesthetic with soft gradients, ambient mesh glows, interactive transparencies, and geometric Outfit typography.
            </Paragraph>
          </div>

          {/* CLASSIC MINIMALIST PANEL */}
          <div 
            onClick={() => setTheme('classic')}
            style={{
              border: theme === 'classic' ? '2px solid #2563eb' : '1px solid var(--border-glass, #e2e8f0)',
              borderRadius: '16px',
              padding: '20px',
              cursor: 'pointer',
              background: theme === 'classic' ? 'rgba(37, 99, 235, 0.04)' : 'rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: theme === 'classic' ? '0 10px 25px -5px rgba(37, 99, 235, 0.15)' : 'var(--shadow-premium)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {theme === 'classic' && (
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#2563eb',
                boxShadow: '0 0 10px #2563eb'
              }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                padding: '8px',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <LayoutOutlined style={{ fontSize: 18 }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Classic / Minimalist</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>INDIGO & SLATE</span>
              </div>
            </div>
            <Paragraph style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Sleek, high-contrast, flat layout featuring clean borders, solid white workspace panels, and corporate DM Sans typography.
            </Paragraph>
          </div>

        </div>
      </Card>

      {/* SECURITY PROFILE CARD */}
      <Card title={<Space><SafetyCertificateOutlined /><span>User Session & Role Authorization</span></Space>}>
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="Authorized User">
            {user ? `${user.first_name} ${user.last_name}` : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Registered Email">
            {user?.email}
          </Descriptions.Item>
          <Descriptions.Item label="Designation">
            {user?.designation}
          </Descriptions.Item>
          <Descriptions.Item label="Authorized Role">
            <Tag color={
              user?.role === 'Super Admin' ? 'purple' :
              user?.role === 'Admin' ? 'red' :
              user?.role === 'HR' ? 'magenta' :
              user?.role === 'Manager' ? 'orange' :
              user?.role === 'Employee' ? 'blue' : 'green'
            }>
              {user?.role} Access
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Session Timeout">
            24 Hours (JWT Token Expiry)
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* DATABASE & SYSTEM ENVIRONMENT CARD */}
      <Card title={<Space><DatabaseOutlined /><span>System Architecture Health</span></Space>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Alert
            message="Dual-Mode Database Core Enabled"
            description="The HRMS backend is running with automatic database selection. If PostgreSQL becomes offline, the system self-heals by running operations on database.json. Connection parameters are managed dynamically in .env configurations."
            type="success"
            showIcon
            icon={<CheckCircleOutlined style={{ color: 'var(--success-color)' }} />}
            style={{ borderRadius: '6px' }}
          />

          <Divider style={{ margin: '12px 0' }} />

          <Descriptions column={1} size="small">
            <Descriptions.Item label={<Text strong>API Port</Text>}>
              <code>5000</code>
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>Database Storage Mode</Text>}>
              <Tag color="cyan">Fallback JSON Core / PostgreSQL Ready</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>Local Storage Endpoint</Text>}>
              <code>/backend/database.json</code>
            </Descriptions.Item>
            <Descriptions.Item label={<Text strong>Encryption Core</Text>}>
              <code>BcryptJS (10 Rounds salt)</code>
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Card>
    </div>
  );
};
export default Settings;
