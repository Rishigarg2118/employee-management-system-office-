import React from 'react';
import { Card, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'flat';
  percentage: string;
  label: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, percentage, label }) => {
  const getTrendElement = () => {
    switch (trend) {
      case 'up':
        return (
          <span style={{ 
            color: 'var(--success)', 
            background: 'var(--success-glow)', 
            border: '1px solid rgba(16, 185, 129, 0.15)',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            <ArrowUpOutlined style={{ fontSize: '10px' }} />
            {percentage}
          </span>
        );
      case 'down':
        return (
          <span style={{ 
            color: 'var(--danger)', 
            background: 'var(--danger-glow)', 
            border: '1px solid rgba(220, 38, 38, 0.15)',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            <ArrowDownOutlined style={{ fontSize: '10px' }} />
            {percentage}
          </span>
        );
      case 'flat':
      default:
        return (
          <span style={{ 
            color: 'var(--text-muted)', 
            background: 'var(--border-glass)', 
            border: '1px solid var(--border-glass)',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px'
          }}>
            <MinusOutlined style={{ fontSize: '10px' }} />
            {percentage}
          </span>
        );
    }
  };

  return (
    <Card style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 600, 
            color: 'var(--text-secondary)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px'
          }}>
            {title}
          </span>
          <span style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '12px'
          }}>
            {value}
          </span>
          <Space size={8} style={{ display: 'flex', alignItems: 'center' }}>
            {getTrendElement()}
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {label}
            </span>
          </Space>
        </div>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '8px', 
          background: 'var(--primary-glow)', 
          border: '1px solid var(--border-glass)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--primary)',
          fontSize: '18px'
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
};
