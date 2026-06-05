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
            color: '#15803D', 
            background: '#DCFCE7', 
            border: '1px solid #DCFCE7',
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
            color: '#B91C1C', 
            background: '#FEE2E2', 
            border: '1px solid #FEE2E2',
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
            color: '#64748B', 
            background: '#F1F5F9', 
            border: '1px solid #E2E8F0',
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
            color: '#64748B', 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px'
          }}>
            {title}
          </span>
          <span style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            color: '#0F172A',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '12px'
          }}>
            {value}
          </span>
          <Space size={8} style={{ display: 'flex', alignItems: 'center' }}>
            {getTrendElement()}
            <span style={{ fontSize: '12px', color: '#64748B' }}>
              {label}
            </span>
          </Space>
        </div>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          borderRadius: '8px', 
          background: '#F1F5F9', 
          border: '1px solid #E2E8F0',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#64748B',
          fontSize: '18px'
        }}>
          {icon}
        </div>
      </div>
    </Card>
  );
};
