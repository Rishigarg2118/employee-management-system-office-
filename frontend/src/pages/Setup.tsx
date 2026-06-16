import React, { useState } from 'react';
import { Form, Input, Button, Alert, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export const Setup: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const onFinish = async (values: any) => {
    if (values.password !== values.confirm_password) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await api.setup({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        password: values.password
      });
      message.success('System configured successfully! Please sign in with your administrator credentials.');
      navigate('/login');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Platform initialization failed. Verify server connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'transparent',
      border: 'none',
      padding: 0
    }}>
      <h2 style={{ 
        fontFamily: 'var(--font-head)',
        fontSize: '24px', 
        fontWeight: 600, 
        textAlign: 'center', 
        marginBottom: '8px',
        letterSpacing: '-0.02em',
        color: 'var(--text-primary)'
      }}>
        Configure HRMS
      </h2>
      <p style={{ 
        color: 'var(--text-secondary)', 
        fontSize: '14px', 
        textAlign: 'center', 
        marginBottom: '24px' 
      }}>
        Initialize your tenant with a primary Administrator account.
      </p>

      {errorMsg && (
        <Alert
          message={errorMsg}
          type="error"
          showIcon
          style={{ marginBottom: '20px', borderRadius: '6px' }}
        />
      )}

      <Form
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
      >
        <div style={{ display: 'flex', gap: '16px' }}>
          <Form.Item
            name="first_name"
            label="First Name"
            rules={[{ required: true, message: 'Required' }]}
            style={{ flex: 1 }}
          >
            <Input 
              prefix={<UserOutlined style={{ color: '#8c8c8c' }} />} 
              placeholder="Sarah" 
              style={{ height: '40px' }}
            />
          </Form.Item>

          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[{ required: true, message: 'Required' }]}
            style={{ flex: 1 }}
          >
            <Input 
              placeholder="Jenkins" 
              style={{ height: '40px' }}
            />
          </Form.Item>
        </div>

        <Form.Item
          name="email"
          label="Root Email Address"
          rules={[
            { required: true, message: 'Required' },
            { type: 'email', message: 'Enter a valid email' }
          ]}
        >
          <Input 
            prefix={<MailOutlined style={{ color: '#8c8c8c' }} />} 
            placeholder="sarah.j@enterprise.io" 
            style={{ height: '40px' }}
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Administrator Password"
          rules={[
            { required: true, message: 'Required' },
            { min: 6, message: 'Password must be at least 6 characters' }
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
            placeholder="••••••••"
            style={{ height: '40px' }}
          />
        </Form.Item>

        <Form.Item
          name="confirm_password"
          label="Confirm Password"
          rules={[{ required: true, message: 'Required' }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#8c8c8c' }} />}
            placeholder="••••••••"
            style={{ height: '40px' }}
          />
        </Form.Item>

        <Form.Item style={{ marginTop: '32px', marginBottom: 0 }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading} 
            block
            style={{ height: '42px', fontSize: '14px' }}
          >
            Initialize Workspace
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};
