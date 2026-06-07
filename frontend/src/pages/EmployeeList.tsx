import React, { useEffect, useState } from 'react';
import { 
  Table, Input, Select, Button, Space, Avatar, 
  Popconfirm, Drawer, Dropdown, Menu, message, Card, Tooltip, Empty 
} from 'antd';
import { 
  SearchOutlined, 
  FilterOutlined, 
  PlusOutlined, 
  UserOutlined, 
  DeleteOutlined, 
  EditOutlined,
  EyeOutlined,
  EllipsisOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api, SERVER_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Employee, Department, EmployeeStatus } from '../types';

export const EmployeeList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Parse filters from URL query parameters
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const departmentId = searchParams.get('department_id') || undefined;
  const status = searchParams.get('status') || undefined;
  const sortBy = searchParams.get('sort_by') || 'id';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [empRes, deptsRes] = await Promise.all([
          api.getEmployees({
            page,
            limit,
            search,
            department_id: departmentId,
            status,
            sort_by: sortBy,
            sort_order: sortOrder
          }),
          api.getDepartments()
        ]);
        
        setEmployees(empRes.data);
        setTotal(empRes.pagination.total);
        setDepartments(deptsRes);
      } catch (err) {
        message.error('Failed to load employee registry.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [page, limit, search, departmentId, status, sortBy, sortOrder]);

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    const params: any = {
      page: pagination.current.toString(),
      limit: pagination.pageSize.toString(),
    };
    
    if (search) params.search = search;
    if (departmentId) params.department_id = departmentId;
    if (status) params.status = status;

    if (sorter.field) {
      params.sort_by = sorter.field === 'name' ? 'first_name' : sorter.field;
      params.sort_order = sorter.order === 'ascend' ? 'asc' : 'desc';
    }

    setSearchParams(params);
  };

  const handleSearch = (val: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (val) {
      newParams.set('search', val);
    } else {
      newParams.delete('search');
    }
    newParams.set('page', '1'); // Reset to page 1
    setSearchParams(newParams);
  };

  const handleFilterChange = (key: string, value: any) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    newParams.set('page', '1'); // Reset to page 1
    setSearchParams(newParams);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteEmployee(id);
      message.success('Employee record successfully removed.');
      // Refresh
      setSearchParams(searchParams);
    } catch (err) {
      message.error('Failed to delete employee.');
    }
  };

  // Bulk operation triggers
  const handleBulkDelete = async () => {
    try {
      await api.bulkActions({
        ids: selectedRowKeys as number[],
        action: 'delete'
      });
      message.success(`Successfully removed ${selectedRowKeys.length} employee records.`);
      setSelectedRowKeys([]);
      setSearchParams(searchParams);
    } catch (err) {
      message.error('Bulk deletion failed.');
    }
  };

  const handleBulkStatusChange = async (newStatus: EmployeeStatus) => {
    try {
      await api.bulkActions({
        ids: selectedRowKeys as number[],
        action: 'status',
        value: newStatus
      });
      message.success(`Successfully updated ${selectedRowKeys.length} records to ${newStatus}.`);
      setSelectedRowKeys([]);
      setSearchParams(searchParams);
    } catch (err) {
      message.error('Bulk status update failed.');
    }
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys);
    },
    // Don't allow selecting yourself for safety
    getCheckboxProps: (record: Employee) => ({
      disabled: currentUser?.id === record.id,
      name: record.first_name,
    }),
  };

  // Define columns
  const columns = [
    {
      title: 'Employee ID',
      dataIndex: 'employee_id',
      key: 'employee_id',
      sorter: true,
      render: (id: string, record: Employee) => (
        <Link to={`/employees/${record.id}`} style={{ fontFamily: 'monospace', fontWeight: 500, color: 'var(--accent-color)' }}>
          {id}
        </Link>
      )
    },
    {
      title: 'Name',
      key: 'name',
      sorter: true,
      render: (_: any, record: Employee) => {
        const fullName = `${record.first_name} ${record.last_name}`;
        const avatarUrl = record.avatar_url ? `${SERVER_URL}/${record.avatar_url}` : undefined;
        return (
          <Space size={10}>
            <Avatar 
              src={avatarUrl} 
              icon={<UserOutlined />} 
              style={{ backgroundColor: 'var(--hover-color)', color: 'var(--text-secondary)' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{fullName}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.email}</span>
            </div>
          </Space>
        );
      }
    },
    {
      title: 'Department',
      dataIndex: ['department', 'name'],
      key: 'department',
      render: (text: string) => text || '—'
    },
    {
      title: 'Designation',
      dataIndex: 'designation',
      key: 'designation',
      sorter: true
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      render: (status: EmployeeStatus) => {
        let className = 'status-badge status-badge-active';
        let label = 'Active';
        if (status === 'Inactive') {
          className = 'status-badge status-badge-inactive';
          label = 'Inactive';
        } else if (status === 'On Leave') {
          className = 'status-badge status-badge-leave';
          label = 'On Leave';
        } else if (status === 'Probation') {
          className = 'status-badge status-badge-probation';
          label = 'Probation';
        }
        return <span className={className}>{label}</span>;
      }
    },
    {
      title: 'Joining Date',
      dataIndex: 'joining_date',
      key: 'joining_date',
      sorter: true,
      render: (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, record: Employee) => {
        const canEdit = ['Super Admin', 'Admin', 'HR', 'Manager'].includes(currentUser?.role || '');
        const isSelf = currentUser?.id === record.id;
        
        const actionMenuItems = {
          items: [
            {
              key: 'view',
              label: <Link to={`/employees/${record.id}`}>View Profile</Link>,
              icon: <EyeOutlined />
            },
            ...(canEdit ? [
              {
                key: 'edit',
                label: <Link to={`/employees/${record.id}/edit`}>Edit Details</Link>,
                icon: <EditOutlined />
              }
            ] : []),
            ...((currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') && !isSelf ? [
              {
                type: 'divider' as const
              },
              {
                key: 'delete',
                label: (
                  <Popconfirm
                    title="Terminate record?"
                    description="This removes all files and database logs linked to this profile."
                    onConfirm={() => handleDelete(record.id)}
                    okText="Yes, delete"
                    cancelText="No"
                    okButtonProps={{ danger: true }}
                  >
                    <span style={{ color: 'var(--danger-color)' }}>Delete Profile</span>
                  </Popconfirm>
                ),
                icon: <DeleteOutlined style={{ color: 'var(--danger-color)' }} />,
                danger: true
              }
            ] : [])
          ]
        };

        return (
          <Dropdown menu={actionMenuItems} trigger={['click']} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined />} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">
            Employee Registry
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Search, filter, and audit company roles, departments, and onboarding timelines.
          </p>
        </div>
        {['Super Admin', 'Admin', 'HR', 'Manager'].includes(currentUser?.role || '') && (
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => navigate('/employees/new')}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            Add Employee
          </Button>
        )}
      </div>

      {/* FILTERS CARD */}
      <Card bodyStyle={{ padding: '16px 20px' }} style={{ border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="Search by name, email, or employee ID..."
            prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
            defaultValue={search}
            onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
            style={{ width: '100%', maxWidth: '320px', height: '38px' }}
            allowClear
            onChange={(e) => !e.target.value && handleSearch('')}
          />
          
          <Select
            placeholder="Filter Department"
            allowClear
            style={{ width: '180px', height: '38px' }}
            value={departmentId}
            onChange={(val) => handleFilterChange('department_id', val)}
            options={departments.map(d => ({ label: d.name, value: d.id.toString() }))}
          />

          <Select
            placeholder="Filter Status"
            allowClear
            style={{ width: '160px', height: '38px' }}
            value={status}
            onChange={(val) => handleFilterChange('status', val)}
            options={[
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' },
              { label: 'On Leave', value: 'On Leave' },
              { label: 'Probation', value: 'Probation' }
            ]}
          />

          {searchParams.toString() && (
            <Button 
              type="text" 
              onClick={() => setSearchParams({})}
              style={{ fontSize: 13, color: 'var(--text-secondary)' }}
            >
              Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* TABLE WORKSPACE */}
      <Card bodyStyle={{ padding: 0 }} style={{ overflow: 'hidden' }}>
        <Table
          rowSelection={(currentUser?.role === 'Super Admin' || currentUser?.role === 'Admin') ? rowSelection : undefined}
          columns={columns}
          dataSource={employees}
          rowKey="id"
          pagination={{
            current: page,
            pageSize: limit,
            total: total,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '25', '50']
          }}
          loading={loading}
          onChange={handleTableChange}
          locale={{ emptyText: <Empty description="No employees match your search parameters." /> }}
        />
      </Card>

      {/* FLOATING BULK ACTIONS DRAWER (Stripe / Linear style) */}
      <Drawer
        title={null}
        placement="bottom"
        closable={false}
        open={selectedRowKeys.length > 0}
        height={72}
        mask={false}
        style={{
          borderTop: '1px solid var(--border-color)',
          background: '#000000',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 -10px 30px rgba(0, 0, 0, 0.08)'
        }}
        bodyStyle={{
          padding: '0 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#FFFFFF' }}>
            {selectedRowKeys.length} employee{selectedRowKeys.length > 1 ? 's' : ''} selected
          </span>
          <Button 
            type="text" 
            onClick={() => setSelectedRowKeys([])}
            style={{ color: '#8C8C8C', fontSize: '13px', padding: 0 }}
          >
            Clear Selection
          </Button>
        </div>

        <Space size={16}>
          <Select
            placeholder="Change Status"
            style={{ width: '150px' }}
            dropdownStyle={{ background: '#FFFFFF' }}
            onChange={(val) => handleBulkStatusChange(val as EmployeeStatus)}
            value={null as any}
            options={[
              { label: 'Active', value: 'Active' },
              { label: 'Inactive', value: 'Inactive' },
              { label: 'On Leave', value: 'On Leave' },
              { label: 'Probation', value: 'Probation' }
            ]}
          />
          
          <Popconfirm
            title="Terminate records?"
            description={`Are you sure you want to delete these ${selectedRowKeys.length} profiles?`}
            onConfirm={handleBulkDelete}
            okText="Yes, delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button 
              danger 
              type="primary" 
              icon={<DeleteOutlined />}
              style={{ height: '32px', display: 'flex', alignItems: 'center' }}
            >
              Bulk Delete
            </Button>
          </Popconfirm>
        </Space>
      </Drawer>
    </div>
  );
};
export default EmployeeList;
