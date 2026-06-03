import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Alert, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const Login: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSystemEmpty, setIsSystemEmpty] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect to dashboard
    if (isAuthenticated) {
      navigate('/');
    }

    // Check if system is uninitialized
    async function checkSystemState() {
      try {
        const res = await api.getEmployees({ limit: 1 });
        if (res.pagination.total === 0) {
          setIsSystemEmpty(true);
        }
      } catch (err) {
        // If DB is completely empty and setup API is ready, it may error or return 0
        console.warn('System checks empty:', err);
        setIsSystemEmpty(true);
      }
    }
    checkSystemState();
  }, [isAuthenticated, navigate]);

  const onFinish = async (values: any) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await login(values);
      message.success('Welcome back to Social Connect.');
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '32px'
    }}>
      <h2 style={{ 
        fontSize: '24px', 
        fontWeight: 600, 
        textAlign: 'center', 
        marginBottom: '8px',
        letterSpacing: '-0.02em',
        color: '#000000'
      }}>
        Welcome back
      </h2>
      <p style={{ 
        color: 'var(--text-secondary)', 
        fontSize: '14px', 
        textAlign: 'center', 
        marginBottom: '24px' 
      }}>
        Sign in to manage your workplace directory.
      </p>

      {isSystemEmpty && (
        <Alert
          message="Platform Initializer"
          description={
            <span>
              This installation appears unconfigured. Please run the <Link to="/setup" style={{ fontWeight: 600 }}>First-time Setup</Link> to configure the administrator.
            </span>
          }
          type="info"
          showIcon
          style={{ marginBottom: '20px', borderRadius: '6px' }}
        />
      )}

      {errorMsg && (
        <Alert
          message={errorMsg}
          type="error"
          showIcon
          style={{ marginBottom: '20px', borderRadius: '6px' }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
      >
        <Form.Item
          name="email"
          label="Work Email Address"
          rules={[
            { required: true, message: 'Please enter your work email.' },
            { type: 'email', message: 'Please enter a valid email address.' }
          ]}
        >
          <Input 
            prefix={<MailOutlined style={{ color: '#8c8c8c' }} />} 
            placeholder="name@enterprise.io" 
            style={{ height: '40px' }}
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please enter your account password.' }]}
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
            Sign In
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};
