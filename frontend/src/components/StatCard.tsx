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
            color: 'var(--success-color)', 
            background: '#F0FDF4', 
            border: '1px solid #DCFCE7',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
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
            color: 'var(--danger-color)', 
            background: '#FEF2F2', 
            border: '1px solid #FEE2E2',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
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
            color: 'var(--text-secondary)', 
            background: 'var(--hover-color)', 
            border: '1px solid var(--border-color)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 500,
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
    <Card style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: '8px' }} bodyStyle={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 500, 
            color: 'var(--text-secondary)', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px'
          }}>
            {title}
          </span>
          <span style={{ 
            fontSize: '32px', 
            fontWeight: 600, 
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '12px'
          }}>
            {value}
          </span>
          <Space size={6} style={{ display: 'flex', alignItems: 'center' }}>
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
          background: 'var(--hover-color)', 
          border: '1px solid var(--border-color)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: '18px'
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
};
