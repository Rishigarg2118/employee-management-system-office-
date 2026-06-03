import React from 'react';
import { Layout } from 'antd';

export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Layout style={{ 
      minHeight: '100vh', 
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Simple Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            background: 'var(--accent-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 'bold',
            fontSize: '16px'
          }}>
            Ω
          </div>
          <span style={{ 
            fontWeight: 600, 
            fontSize: '18px', 
            letterSpacing: '-0.02em',
            fontFamily: 'var(--font-sans)',
            color: '#000000'
          }}>
            Social Connect
          </span>
        </div>

        {/* Auth Page Content */}
        <div className="fade-in">
          {children}
        </div>

        {/* Footer */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: 'var(--text-secondary)',
          marginTop: '16px'
        }}>
          Protected by enterprise-grade SSO. © 2026 Social Connect Inc.
        </div>
      </div>
    </Layout>
  );
};
