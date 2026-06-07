import React, { useEffect, useState } from 'react';
import { Table, Input, Space, Button, Popconfirm, Avatar, Spin, message, Card, Empty } from 'antd';
import { 
  SearchOutlined, 
  UserOutlined, 
  FilePdfOutlined, 
  FileWordOutlined, 
  FileExcelOutlined, 
  FileOutlined,
  DeleteOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api, API_URL, SERVER_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Employee, Document } from '../types';

export const Documents: React.FC = () => {
  const { user: currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [globalDocs, setGlobalDocs] = useState<Array<Document & { owner: Employee }>>([]);
  const [search, setSearch] = useState('');

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // 1. Fetch all employees
      const empRes = await api.getEmployees({ limit: 1000 });
      const employees = empRes.data;

      // 2. Fetch documents for each employee in parallel
      const docsPromises = employees.map(async (emp) => {
        try {
          const docs = await api.getEmployeeDocuments(emp.id);
          return docs.map(d => ({ ...d, owner: emp }));
        } catch (e) {
          return [];
        }
      });

      const results = await Promise.all(docsPromises);
      const flattened = results.flat();
      setGlobalDocs(flattened);
    } catch (err) {
      message.error('Failed to load corporate file directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteDocument(id);
      message.success('Document deleted successfully.');
      loadDocuments();
    } catch (err) {
      message.error('Failed to delete document.');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FilePdfOutlined style={{ color: '#EF4444', fontSize: '20px' }} />;
    if (fileType.includes('word') || fileType.includes('officedocument.word')) return <FileWordOutlined style={{ color: '#3B82F6', fontSize: '20px' }} />;
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('officedocument.spreadsheet')) return <FileExcelOutlined style={{ color: '#10B981', fontSize: '20px' }} />;
    return <FileOutlined style={{ color: '#6B7280', fontSize: '20px' }} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" />
      </div>
    );
  }

  // Filter local document rows by search string
  const filteredDocs = globalDocs.filter(doc => 
    doc.name.toLowerCase().includes(search.trim().toLowerCase()) ||
    `${doc.owner.first_name} ${doc.owner.last_name}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const columns = [
    {
      title: 'Document Name',
      key: 'name',
      render: (_: any, record: any) => (
        <Space size={10}>
          {getFileIcon(record.file_type)}
          <a 
            href={`${API_URL.replace('/api', '')}/${record.file_path}`} 
            target="_blank" 
            rel="noreferrer"
            style={{ fontWeight: 500, color: 'var(--text-primary)' }}
          >
            {record.name}
          </a>
        </Space>
      )
    },
    {
      title: 'File Size',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => formatFileSize(size)
    },
    {
      title: 'Uploaded By / Owner',
      key: 'owner',
      render: (_: any, record: any) => {
        const fullName = `${record.owner.first_name} ${record.owner.last_name}`;
        return (
          <Space size={8}>
            <Avatar 
              src={record.owner.avatar_url ? `${SERVER_URL}/${record.owner.avatar_url}` : undefined} 
              icon={<UserOutlined />} 
              size="small"
              style={{ backgroundColor: 'var(--hover-color)', color: 'var(--text-secondary)' }}
            />
            <Link to={`/employees/${record.owner.id}`} style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
              {fullName}
            </Link>
          </Space>
        );
      }
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      render: (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, record: any) => {
        const isEditable = ['Super Admin', 'Admin', 'HR', 'Manager'].includes(currentUser?.role || '') || currentUser?.id === record.owner.id;
        
        return (
          <Space size={8}>
            <Button 
              type="text" 
              icon={<DownloadOutlined />} 
              onClick={() => window.open(`${API_URL.replace('/api', '')}/${record.file_path}`, '_blank')}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            />
            {isEditable && (
              <Popconfirm
                title="Permanently delete document?"
                onConfirm={() => handleDelete(record.id)}
                okButtonProps={{ danger: true }}
              >
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                />
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* HEADER SECTION */}
      <div>
        <h1 className="page-title">
          File Cabinet
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Global corporate repository containing employee offer letters, CVs, portfolios, and certification files.
        </p>
      </div>

      {/* SEARCH BAR */}
      <Card bodyStyle={{ padding: '16px 20px' }}>
        <Input
          placeholder="Search by file name or document owner..."
          prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '360px', height: '38px' }}
          allowClear
        />
      </Card>

      {/* DATA GRID */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredDocs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="No corporate files match your search." /> }}
        />
      </Card>
    </div>
  );
};
export default Documents;
