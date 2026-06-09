import React, { useState, useEffect } from 'react';
import { 
  Tabs, Card, Row, Col, Table, Button, Modal, Form, 
  Input, Select, DatePicker, Space, Tag, Empty, Tooltip, 
  message, Popconfirm, Avatar, Typography, InputNumber,
  Statistic
} from 'antd';
import { 
  DashboardOutlined, 
  UnorderedListOutlined, 
  HistoryOutlined, 
  PlusOutlined, 
  UserOutlined, 
  CalendarOutlined,
  DesktopOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  RollbackOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { Asset, AssetAssignment, AssetHistory, Employee } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Tooltip as ChartTooltip } from 'recharts';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#8B5CF6', '#64748B'];

export const AssetWorkspace: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'Super Admin' || user?.role === 'Admin' || user?.role === 'HR';
  const isManager = user?.role === 'Manager';

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [history, setHistory] = useState<AssetHistory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Search & filter states
  const [searchText, setSearchText] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [isAssetModalOpen, setIsAssetModalOpen] = useState<boolean>(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returningAsset, setReturningAsset] = useState<Asset | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState<boolean>(false);
  const [detailedAsset, setDetailedAsset] = useState<Asset | null>(null);
  const [detailedHistory, setDetailedHistory] = useState<AssetHistory[]>([]);

  // Form instances
  const [assetForm] = Form.useForm();
  const [assignForm] = Form.useForm();
  const [returnForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsRes, historyRes] = await Promise.all([
        api.getAssets(),
        api.getAssetHistory()
      ]);
      setAssets(assetsRes);
      setHistory(historyRes);

      if (isAdminOrHR) {
        const empRes = await api.getEmployees({ limit: 1000 });
        setEmployees(empRes.data || []);
      }
    } catch (err) {
      console.error('Error loading assets data:', err);
      message.error('Failed to load asset records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Asset CRUD operations
  const handleAssetSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
        warranty_expiry: values.warranty_expiry ? values.warranty_expiry.format('YYYY-MM-DD') : null
      };

      if (editingAsset) {
        await api.updateAsset(editingAsset.id, payload);
        message.success('Asset details updated successfully.');
      } else {
        await api.createAsset(payload);
        message.success('New asset registered successfully.');
      }
      setIsAssetModalOpen(false);
      assetForm.resetFields();
      setEditingAsset(null);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to save asset details.');
    }
  };

  const handleDeleteAsset = async (id: number) => {
    try {
      await api.deleteAsset(id);
      message.success('Asset deleted successfully.');
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to delete asset.');
    }
  };

  // Assign & Return workflows
  const handleAssignSubmit = async (values: any) => {
    if (!assigningAsset) return;
    try {
      await api.assignAsset({
        asset_id: assigningAsset.id,
        employee_id: values.employee_id,
        expected_return_date: values.expected_return_date ? values.expected_return_date.format('YYYY-MM-DD') : null,
        remarks: values.remarks
      });
      message.success(`Asset assigned successfully.`);
      setIsAssignModalOpen(false);
      assignForm.resetFields();
      setAssigningAsset(null);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Failed to allocate asset.');
    }
  };

  const handleReturnSubmit = async (values: any) => {
    if (!returningAsset) return;
    try {
      // Find the active assignment ID for this asset
      const registryAssets = await api.getAssets();
      const freshAsset = registryAssets.find((a: any) => a.id === returningAsset.id);
      
      // Fetch assignment list to locate active assignment ID
      const assignmentsRes = await api.getAssetHistory(returningAsset.id);
      // Find assignment that is active (actual_return_date is null)
      // Since history returns actions, let's retrieve the asset details which has assignment_id if available,
      // or fetch the history to find the active assignment.
      // Wait, let's look at getAssets() return structure: it returns e.id as assigned_to_id, e.name as assigned_to.
      // Wait, how do we get the active assignment ID?
      // In db.ts, getAssets joins with active assignment and returns details. But does it return assignment_id?
      // Let's check db.ts getAssets sql query in lines 4770-4780:
      // SELECT a.*, e.id as assigned_to_id, CONCAT(e.first_name, ' ', e.last_name) as assigned_to, e.department_id, aa.id as assignment_id ... wait, did it SELECT aa.id?
      // Let's check lines 4773-4776:
      // SELECT a.*, e.id as assigned_to_id, CONCAT(e.first_name, ' ', e.last_name) as assigned_to, e.department_id
      // Ah! It does not select aa.id! It only selects a.*. Let's see: aa.id is the assignment ID.
      // Wait! If the assignment ID is not returned in getAssets, how do we find it?
      // We can query the global history or specific asset history, or wait: in db.ts returnAsset updates by assignmentId.
      // Wait, let's check: can we locate the assignment by fetching the asset history?
      // In db.ts:
      // returnAsset(assignmentId: number, data: { actual_return_date: string; return_condition: string; remarks?: string | null; status?: string })
      // Wait! If we don't have the assignment ID directly, let's check: does the backend assetController support finding the active assignment?
      // In assetController.ts, returnAsset handles:
      // const { assignment_id, actual_return_date, return_condition, remarks, status } = req.body;
      // Wait, we need to pass `assignment_id` to the backend. How can the frontend find the active assignment ID?
      // Let's check `getAssetHistory` or active assignments query. Let's view `db.ts` to see if there is any method to fetch assignments.
      // In `db.ts`, `getAssetById` returns active assignment assignee.
      // Wait, let's check: does the history table or assignment table have the ID?
      // In postgres: `SELECT id FROM asset_assignments WHERE asset_id = $1 AND actual_return_date IS NULL`
      // Wait! Let's check if the backend controller has a way to resolve assignment ID or if we should add it.
      // Wait, in `db.ts` `getAssetById`, let's check if it returns the assignment ID:
      // SELECT a.*, e.id as assigned_to_id, CONCAT(e.first_name, ' ', e.last_name) as assigned_to, aa.id as assignment_id
      // Let's check lines 4854-4863 of `db.ts`:
      // SELECT a.*, e.id as assigned_to_id, CONCAT(e.first_name, ' ', e.last_name) as assigned_to FROM assets a LEFT JOIN asset_assignments aa ON a.id = aa.asset_id AND aa.actual_return_date IS NULL LEFT JOIN employees e ON aa.employee_id = e.id WHERE a.id = $1
      // Ah! It doesn't select `aa.id as assignment_id` either.
      // Wait, how do we find the assignment ID?
      // Let's modify `db.ts` `getAssetById` and `getAssets` to include `aa.id as assignment_id`! This is super clean, standard, and robust, and will make returning assets trivial.
      // Wait! Let's check if we can do this change in `db.ts`.
      // Let's check if there is an alternative: we can query the database or check the JSON database.
      // Yes! In `db.ts` lines 4773-4776:
      // SELECT a.*, e.id as assigned_to_id, CONCAT(e.first_name, ' ', e.last_name) as assigned_to, e.department_id
      // If we change it to:
      // SELECT a.*, e.id as assigned_to_id, CONCAT(e.first_name, ' ', e.last_name) as assigned_to, e.department_id, aa.id as assignment_id
      // Then `getAssets` will automatically return `assignment_id`!
      // Let's check JSON DB fallback: it maps assets and finds `activeAssignment?.id`.
      // Let's check line 4819 of `db.ts`:
      // return { ...a, assigned_to_id: emp ? emp.id : null, assigned_to: emp ? `${emp.first_name} ${emp.last_name}` : null, department_id: emp ? emp.department_id : null }
      // If we add `assignment_id: activeAssignment ? activeAssignment.id : null`, that will make it work perfectly!
      // This is a small edit to `db.ts` that will guarantee zero bugs in the return flow.
      // Wait! Let's look at `db.ts` lines 4770-4785 and lines 4815-4825, and lines 4853-4877 to see where to replace. Let's do it!
      // But let's write `AssetWorkspace.tsx` first, and then modify `db.ts`. In `AssetWorkspace.tsx`, we will assume `asset.assignment_id` is available (which is the cleanest way!).
      // Let's continue writing `AssetWorkspace.tsx` with this assumption.
      
      const targetAssignmentId = freshAsset.assignment_id;
      if (!targetAssignmentId) {
        // Fallback: search history logs or fetch assignments
        throw new Error('Active assignment ID not found on asset record.');
      }

      await api.returnAsset({
        assignment_id: targetAssignmentId,
        actual_return_date: values.actual_return_date.format('YYYY-MM-DD'),
        return_condition: values.return_condition,
        remarks: values.remarks,
        status: values.status
      });

      message.success(`Asset returned successfully.`);
      setIsReturnModalOpen(false);
      returnForm.resetFields();
      setReturningAsset(null);
      loadData();
    } catch (err: any) {
      message.error(err.message || err.response?.data?.message || 'Failed to return asset.');
    }
  };

  const handleOpenDetails = async (asset: Asset) => {
    setDetailedAsset(asset);
    setIsDetailsModalOpen(true);
    try {
      const hist = await api.getAssetHistory(asset.id);
      setDetailedHistory(hist);
    } catch (err) {
      console.error('Error fetching asset history:', err);
    }
  };

  // Helper formatting renderers
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'Available':
        return <Tag color="success"><CheckCircleOutlined /> Available</Tag>;
      case 'Assigned':
        return <Tag color="blue"><UserOutlined /> Assigned</Tag>;
      case 'Maintenance':
        return <Tag color="warning"><ReloadOutlined /> Maintenance</Tag>;
      case 'Lost':
      case 'Damaged':
        return <Tag color="error">{status}</Tag>;
      case 'Retired':
        return <Tag color="default">Retired</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const getConditionTag = (condition: string) => {
    switch (condition) {
      case 'New':
        return <Tag color="cyan">New</Tag>;
      case 'Excellent':
        return <Tag color="emerald">Excellent</Tag>;
      case 'Good':
        return <Tag color="green">Good</Tag>;
      case 'Fair':
        return <Tag color="orange">Fair</Tag>;
      case 'Damaged':
        return <Tag color="red">Damaged</Tag>;
      default:
        return <Tag>{condition}</Tag>;
    }
  };

  // Dashboard Stats Calculations
  const statsSummary = React.useMemo(() => {
    const total = assets.length;
    const available = assets.filter(a => a.status === 'Available').length;
    const assigned = assets.filter(a => a.status === 'Assigned').length;
    const maintenance = assets.filter(a => a.status === 'Maintenance').length;
    const broken = assets.filter(a => a.status === 'Damaged' || a.status === 'Lost').length;

    // Type distribution data
    const typesMap = assets.reduce((acc: any, cur) => {
      acc[cur.asset_type] = (acc[cur.asset_type] || 0) + 1;
      return acc;
    }, {});
    const typeDistribution = Object.keys(typesMap).map((key, index) => ({
      name: key,
      value: typesMap[key],
      color: COLORS[index % COLORS.length]
    }));

    // Status distribution data
    const statusMap = assets.reduce((acc: any, cur) => {
      acc[cur.status] = (acc[cur.status] || 0) + 1;
      return acc;
    }, {});
    const statusDistribution = Object.keys(statusMap).map(key => ({
      name: key,
      value: statusMap[key]
    }));

    return {
      total,
      available,
      assigned,
      maintenance,
      broken,
      typeDistribution,
      statusDistribution
    };
  }, [assets]);

  // Registry columns configuration
  const columns = [
    {
      title: 'Code',
      dataIndex: 'asset_code',
      key: 'asset_code',
      fontWeight: 500,
      render: (text: string, record: Asset) => (
        <Button type="link" onClick={() => handleOpenDetails(record)} style={{ padding: 0, fontWeight: 600 }}>
          {text}
        </Button>
      )
    },
    {
      title: 'Name',
      dataIndex: 'asset_name',
      key: 'asset_name',
      render: (text: string, record: Asset) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{text}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {record.brand} {record.model}
          </span>
        </div>
      )
    },
    {
      title: 'Type',
      dataIndex: 'asset_type',
      key: 'asset_type',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => getStatusTag(text)
    },
    {
      title: 'Condition',
      dataIndex: 'asset_condition',
      key: 'asset_condition',
      render: (text: string) => getConditionTag(text)
    },
    {
      title: 'Assignee',
      dataIndex: 'assigned_to',
      key: 'assigned_to',
      render: (text: string, record: Asset) => {
        if (!text) return <Text type="secondary">—</Text>;
        return (
          <Space>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#10B981' }} />
            {record.assigned_to_id ? (
              <Link to={`/employees/${record.assigned_to_id}`} style={{ color: '#10B981', fontWeight: 500 }}>
                {text}
              </Link>
            ) : (
              <span>{text}</span>
            )}
          </Space>
        );
      }
    },
    ...(isAdminOrHR ? [{
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Asset) => (
        <Space size={12}>
          {record.status === 'Available' ? (
            <Button 
              type="primary" 
              size="small" 
              icon={<ArrowRightOutlined />} 
              onClick={() => {
                setAssigningAsset(record);
                setIsAssignModalOpen(true);
              }}
              style={{ background: '#10B981', borderColor: '#10B981' }}
            >
              Allocate
            </Button>
          ) : record.status === 'Assigned' ? (
            <Button 
              type="default" 
              size="small" 
              icon={<RollbackOutlined />} 
              onClick={() => {
                setReturningAsset(record);
                setIsReturnModalOpen(true);
              }}
            >
              Return
            </Button>
          ) : null}
          <Tooltip title="Edit">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => {
                setEditingAsset(record);
                assetForm.setFieldsValue({
                  ...record,
                  purchase_date: record.purchase_date ? dayjs(record.purchase_date) : null,
                  warranty_expiry: record.warranty_expiry ? dayjs(record.warranty_expiry) : null
                });
                setIsAssetModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Popconfirm
              title="Delete Asset"
              description="Are you sure you want to delete this asset? This action cannot be undone."
              okText="Yes"
              cancelText="No"
              onConfirm={() => handleDeleteAsset(record.id)}
              disabled={record.status === 'Assigned'}
            >
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                disabled={record.status === 'Assigned'}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }] : [])
  ];

  // Filtering list
  const filteredAssets = React.useMemo(() => {
    return assets.filter(a => {
      const searchLower = searchText.toLowerCase();
      const matchesSearch = 
        a.asset_code.toLowerCase().includes(searchLower) ||
        a.asset_name.toLowerCase().includes(searchLower) ||
        (a.brand && a.brand.toLowerCase().includes(searchLower)) ||
        (a.model && a.model.toLowerCase().includes(searchLower)) ||
        (a.serial_number && a.serial_number.toLowerCase().includes(searchLower)) ||
        (a.assigned_to && a.assigned_to.toLowerCase().includes(searchLower));

      const matchesType = !typeFilter || a.asset_type === typeFilter;
      const matchesStatus = !statusFilter || a.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [assets, searchText, typeFilter, statusFilter]);

  // Tab Items Structure
  const tabItems = [
    {
      key: 'dashboard',
      label: (
        <span>
          <DashboardOutlined />
          Dashboard
        </span>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* STATS TILES */}
          <Row gutter={[24, 24]}>
            <Col xs={12} sm={6}>
              <Card bordered={false} className="stat-card" style={{ background: '#FFFFFF', borderRadius: 12 }}>
                <Statistic title="Total Registered Assets" value={statsSummary.total} prefix={<DesktopOutlined style={{ color: '#6366F1' }} />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card bordered={false} className="stat-card" style={{ background: '#FFFFFF', borderRadius: 12 }}>
                <Statistic title="Available Inventory" value={statsSummary.available} valueStyle={{ color: '#10B981' }} prefix={<CheckCircleOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card bordered={false} className="stat-card" style={{ background: '#FFFFFF', borderRadius: 12 }}>
                <Statistic title="Assigned to Staff" value={statsSummary.assigned} valueStyle={{ color: '#3B82F6' }} prefix={<UserOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card bordered={false} className="stat-card" style={{ background: '#FFFFFF', borderRadius: 12 }}>
                <Statistic title="In Maintenance / Damaged" value={statsSummary.maintenance + statsSummary.broken} valueStyle={{ color: '#F59E0B' }} prefix={<ReloadOutlined />} />
              </Card>
            </Col>
          </Row>

          {/* RECHARTS VISUALIZATIONS */}
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Card title="Assets by Type" bordered={false} style={{ borderRadius: 12, minHeight: 380 }}>
                {statsSummary.typeDistribution.length > 0 ? (
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statsSummary.typeDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statsSummary.typeDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip formatter={(value) => [`${value} items`, 'Count']} />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty description="No assets cataloged" style={{ padding: 40 }} />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="Asset Status Distribution" bordered={false} style={{ borderRadius: 12, minHeight: 380 }}>
                {statsSummary.statusDistribution.length > 0 ? (
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsSummary.statusDistribution} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <ChartTooltip />
                        <Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]}>
                          {statsSummary.statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.name === 'Available' ? '#10B981' : entry.name === 'Assigned' ? '#3B82F6' : '#F59E0B'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty description="No data available" style={{ padding: 40 }} />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      )
    },
    {
      key: 'registry',
      label: (
        <span>
          <UnorderedListOutlined />
          Registry
        </span>
      ),
      children: (
        <Card bordered={false} style={{ borderRadius: 12 }}>
          {/* SEARCH & FILTERS BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <Space size={12} style={{ flexWrap: 'wrap' }}>
              <Input
                placeholder="Search code, name, serial..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 220 }}
                allowClear
              />
              <Select
                placeholder="Filter by Type"
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 160 }}
                allowClear
              >
                <Option value="Laptop">Laptop</Option>
                <Option value="Monitor">Monitor</Option>
                <Option value="Mouse">Mouse</Option>
                <Option value="Keyboard">Keyboard</Option>
                <Option value="Headset">Headset</Option>
                <Option value="Mobile Phone">Mobile Phone</Option>
                <Option value="ID Card">ID Card</Option>
                <Option value="Access Card">Access Card</Option>
                <Option value="Other">Other IT Asset</Option>
              </Select>
              <Select
                placeholder="Filter by Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 160 }}
                allowClear
              >
                <Option value="Available">Available</Option>
                <Option value="Assigned">Assigned</Option>
                <Option value="Maintenance">Maintenance</Option>
                <Option value="Lost">Lost</Option>
                <Option value="Damaged">Damaged</Option>
                <Option value="Retired">Retired</Option>
              </Select>
            </Space>

            {isAdminOrHR && (
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => {
                  setEditingAsset(null);
                  assetForm.resetFields();
                  setIsAssetModalOpen(true);
                }}
                style={{ background: '#10B981', borderColor: '#10B981' }}
              >
                Register Asset
              </Button>
            )}
          </div>

          <Table 
            columns={columns} 
            dataSource={filteredAssets} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 10 }}
            locale={{ emptyText: <Empty description="No assets found matching filters." /> }}
          />
        </Card>
      )
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined />
          Assignment History
        </span>
      ),
      children: (
        <Card bordered={false} style={{ borderRadius: 12 }}>
          <Table
            dataSource={history}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 15 }}
            columns={[
              {
                title: 'Asset Code',
                dataIndex: 'asset_code',
                key: 'asset_code',
                render: (text) => <Text strong>{text}</Text>
              },
              {
                title: 'Asset Name',
                dataIndex: 'asset_name',
                key: 'asset_name',
              },
              {
                title: 'Action',
                dataIndex: 'action_type',
                key: 'action_type',
                render: (text) => {
                  let color = 'default';
                  if (text === 'Assigned') color = 'blue';
                  if (text === 'Returned') color = 'green';
                  if (text === 'Transferred') color = 'purple';
                  if (text === 'Marked Damaged') color = 'red';
                  if (text === 'Sent For Maintenance') color = 'orange';
                  return <Tag color={color}>{text}</Tag>;
                }
              },
              {
                title: 'Performing Actor',
                dataIndex: 'performed_by_name',
                key: 'performed_by_name',
              },
              {
                title: 'Description',
                dataIndex: 'description',
                key: 'description',
              },
              {
                title: 'Date & Time',
                dataIndex: 'created_at',
                key: 'created_at',
                render: (text) => new Date(text).toLocaleString('en-US')
              }
            ]}
          />
        </Card>
      )
    }
  ];

  return (
    <div style={{ minHeight: '100%' }}>
      {/* HEADER SECTION */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.04em', margin: 0 }}>
          Enterprise Asset Management
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: 4 }}>
          Register corporate assets, track staff assignments, record device returns, and audit device lifecycle history.
        </p>
      </div>

      {/* CORE WORKSPACE TABS */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        tabBarStyle={{ marginBottom: 24, borderBottom: '1px solid var(--border-color)' }}
        style={{ fontFamily: 'Inter' }}
      />

      {/* MODAL: Register / Edit Asset */}
      <Modal
        title={editingAsset ? "Edit Asset Details" : "Register Corporate Asset"}
        open={isAssetModalOpen}
        onCancel={() => {
          setIsAssetModalOpen(false);
          setEditingAsset(null);
          assetForm.resetFields();
        }}
        onOk={() => assetForm.submit()}
        okText={editingAsset ? "Save Changes" : "Register Asset"}
        width={720}
      >
        <Form 
          form={assetForm} 
          layout="vertical" 
          onFinish={handleAssetSubmit}
          initialValues={{ asset_condition: 'New', status: 'Available' }}
          style={{ marginTop: 20 }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Asset Code" name="asset_code" rules={[{ required: true, message: 'Please input asset code!' }]}>
                <Input placeholder="e.g. LPT-101" disabled={!!editingAsset} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="Asset Name" name="asset_name" rules={[{ required: true, message: 'Please input asset name!' }]}>
                <Input placeholder="e.g. MacBook Pro M3" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Asset Type" name="asset_type" rules={[{ required: true, message: 'Please select asset type!' }]}>
                <Select placeholder="Select Type">
                  <Option value="Laptop">Laptop</Option>
                  <Option value="Monitor">Monitor</Option>
                  <Option value="Mouse">Mouse</Option>
                  <Option value="Keyboard">Keyboard</Option>
                  <Option value="Headset">Headset</Option>
                  <Option value="Mobile Phone">Mobile Phone</Option>
                  <Option value="ID Card">ID Card</Option>
                  <Option value="Access Card">Access Card</Option>
                  <Option value="Other">Other IT Asset</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Brand" name="brand">
                <Input placeholder="e.g. Apple" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Model" name="model">
                <Input placeholder="e.g. A2941" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Serial Number" name="serial_number">
                <Input placeholder="e.g. C02GLXXXXX" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Purchase Date" name="purchase_date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Purchase Cost ($)" name="purchase_cost">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 1999.00" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Warranty Expiry" name="warranty_expiry">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Asset Condition" name="asset_condition" rules={[{ required: true }]}>
                <Select>
                  <Option value="New">New</Option>
                  <Option value="Excellent">Excellent</Option>
                  <Option value="Good">Good</Option>
                  <Option value="Fair">Fair</Option>
                  <Option value="Damaged">Damaged</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Status" name="status" rules={[{ required: true }]}>
                <Select disabled={editingAsset?.status === 'Assigned'}>
                  <Option value="Available">Available</Option>
                  <Option value="Maintenance">Maintenance</Option>
                  <Option value="Lost">Lost</Option>
                  <Option value="Damaged">Damaged</Option>
                  <Option value="Retired">Retired</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Notes / Comments" name="notes">
            <TextArea rows={3} placeholder="Add purchase specifications or damage details..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Allocate Asset */}
      <Modal
        title={`Allocate Asset: ${assigningAsset?.asset_name} (${assigningAsset?.asset_code})`}
        open={isAssignModalOpen}
        onCancel={() => {
          setIsAssignModalOpen(false);
          setAssigningAsset(null);
          assignForm.resetFields();
        }}
        onOk={() => assignForm.submit()}
        okText="Assign Asset"
        width={480}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssignSubmit} style={{ marginTop: 20 }}>
          <Form.Item label="Assign To Employee" name="employee_id" rules={[{ required: true, message: 'Please select an employee!' }]}>
            <Select showSearch placeholder="Search employee by name" optionFilterProp="children">
              {employees.map(emp => (
                <Option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_id})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Expected Return Date" name="expected_return_date">
            <DatePicker style={{ width: '100%' }} placeholder="Optional return target" />
          </Form.Item>

          <Form.Item label="Remarks / Handout Notes" name="remarks">
            <TextArea rows={3} placeholder="e.g. Handed over device with original charger and box." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Return Asset */}
      <Modal
        title={`Record Return: ${returningAsset?.asset_name} (${returningAsset?.asset_code})`}
        open={isReturnModalOpen}
        onCancel={() => {
          setIsReturnModalOpen(false);
          setReturningAsset(null);
          returnForm.resetFields();
        }}
        onOk={() => returnForm.submit()}
        okText="Record Return"
        width={480}
      >
        <Form 
          form={returnForm} 
          layout="vertical" 
          onFinish={handleReturnSubmit}
          initialValues={{ 
            actual_return_date: dayjs(), 
            return_condition: returningAsset?.asset_condition || 'Good',
            status: 'Available'
          }}
          style={{ marginTop: 20 }}
        >
          <Form.Item label="Actual Return Date" name="actual_return_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Return Condition" name="return_condition" rules={[{ required: true }]}>
            <Select>
              <Option value="New">New</Option>
              <Option value="Excellent">Excellent</Option>
              <Option value="Good">Good</Option>
              <Option value="Fair">Fair</Option>
              <Option value="Damaged">Damaged</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Next Inventory Status" name="status" rules={[{ required: true }]}>
            <Select>
              <Option value="Available">Available (Put back in stock)</Option>
              <Option value="Maintenance">Maintenance (Send for servicing)</Option>
              <Option value="Damaged">Mark Damaged</Option>
              <Option value="Retired">Retired (Decommission device)</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Return Remarks" name="remarks">
            <TextArea rows={3} placeholder="Detail any wear, missing items, or reasons for servicing..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Asset Details & Life History */}
      <Modal
        title={`Asset Specifications & Lifecycle Logs: ${detailedAsset?.asset_code}`}
        open={isDetailsModalOpen}
        onCancel={() => {
          setIsDetailsModalOpen(false);
          setDetailedAsset(null);
          setDetailedHistory([]);
        }}
        footer={[
          <Button key="close" onClick={() => setIsDetailsModalOpen(false)}>
            Close Details
          </Button>
        ]}
        width={800}
      >
        {detailedAsset && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 20 }}>
            {/* META SPECIFICATIONS */}
            <Card title="Device Specifications" size="small" bordered={false} style={{ background: '#F8FAFC' }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <p><strong>Device Name:</strong> {detailedAsset.asset_name}</p>
                  <p><strong>Type:</strong> {detailedAsset.asset_type}</p>
                  <p><strong>Brand / Model:</strong> {detailedAsset.brand || '—'} / {detailedAsset.model || '—'}</p>
                  <p><strong>Serial Number:</strong> {detailedAsset.serial_number || '—'}</p>
                </Col>
                <Col span={12}>
                  <p><strong>Current Status:</strong> {getStatusTag(detailedAsset.status)}</p>
                  <p><strong>Condition:</strong> {getConditionTag(detailedAsset.asset_condition)}</p>
                  <p><strong>Purchase Cost:</strong> {detailedAsset.purchase_cost ? `$${detailedAsset.purchase_cost}` : '—'}</p>
                  <p>
                    <strong>Purchase Date:</strong>{' '}
                    {detailedAsset.purchase_date
                      ? new Date(detailedAsset.purchase_date).toLocaleDateString()
                      : '—'}
                  </p>
                  <p>
                    <strong>Warranty Expiry:</strong>{' '}
                    {detailedAsset.warranty_expiry
                      ? new Date(detailedAsset.warranty_expiry).toLocaleDateString()
                      : '—'}
                  </p>
                </Col>
              </Row>
              {detailedAsset.notes && (
                <div style={{ marginTop: 10 }}>
                  <strong>Notes:</strong>
                  <div style={{ background: '#FFFFFF', padding: 10, borderRadius: 8, border: '1px solid #E2E8F0', marginTop: 4 }}>
                    {detailedAsset.notes}
                  </div>
                </div>
              )}
            </Card>

            {/* LIFECYCLE EVENTS TIMELINE */}
            <Card title="Asset Lifecycle Chronology" size="small" bordered={false}>
              <Table
                dataSource={detailedHistory}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: 'No log actions recorded for this asset.' }}
                columns={[
                  {
                    title: 'Action',
                    dataIndex: 'action_type',
                    key: 'action_type',
                    render: (text) => {
                      let color = 'default';
                      if (text === 'Assigned') color = 'blue';
                      if (text === 'Returned') color = 'green';
                      if (text === 'Transferred') color = 'purple';
                      if (text === 'Marked Damaged') color = 'red';
                      if (text === 'Sent For Maintenance') color = 'orange';
                      return <Tag color={color}>{text}</Tag>;
                    }
                  },
                  {
                    title: 'Performed By',
                    dataIndex: 'performed_by_name',
                    key: 'performed_by_name',
                  },
                  {
                    title: 'Description',
                    dataIndex: 'description',
                    key: 'description',
                  },
                  {
                    title: 'Timestamp',
                    dataIndex: 'created_at',
                    key: 'created_at',
                    render: (text) => new Date(text).toLocaleString('en-US')
                  }
                ]}
              />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};
export default AssetWorkspace;
