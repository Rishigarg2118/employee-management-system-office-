import React from 'react';
import { Card, Descriptions, Tag, Space, Alert, Typography, Divider } from 'antd';
import { 
  SettingOutlined, 
  SafetyCertificateOutlined, 
  DatabaseOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Paragraph, Text } = Typography;

export const Settings: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px' }}>
      {/* HEADER SECTION */}
      <div>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 600, 
          letterSpacing: '-0.03em', 
          color: '#000000',
          marginBottom: '4px'
        }}>
          System Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Configure enterprise settings, view authorization policies, and check system environment health.
        </p>
      </div>

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
