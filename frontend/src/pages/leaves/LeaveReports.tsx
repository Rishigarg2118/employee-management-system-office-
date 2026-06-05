import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Table, Card, Form, Select, DatePicker, 
  Button, Row, Col, Space, Input, Badge, message, Empty 
} from 'antd';
import { 
  SearchOutlined, 
  DownloadOutlined, 
  ReloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;

export const LeaveReports: React.FC = () => {
  const [form] = Form.useForm();
  const [filters, setFilters] = useState<any>({});

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departmentsForReports'],
    queryFn: () => api.getDepartments()
  });

  // Fetch leave types
  const { data: leaveTypes } = useQuery({
    queryKey: ['leaveTypesForReports'],
    queryFn: () => api.getLeaveTypes()
  });

  // Fetch employees for autocomplete select filter
  const { data: employeesData } = useQuery({
    queryKey: ['employeesForReports'],
    queryFn: () => api.getEmployees({ limit: 100 })
  });

  const employeesList = employeesData?.data || [];

  // Fetch reports data
  const { data: reports, isLoading } = useQuery({
    queryKey: ['leaveReports', filters],
    queryFn: () => api.getLeaveReports(filters)
  });

  const handleSearch = (values: any) => {
    const queryParams: any = {};
    if (values.departmentId) queryParams.departmentId = values.departmentId;
    if (values.employeeId) queryParams.employeeId = values.employeeId;
    if (values.leaveTypeId) queryParams.leaveTypeId = values.leaveTypeId;
    
    if (values.date_range && values.date_range[0] && values.date_range[1]) {
      queryParams.startDate = values.date_range[0].format('YYYY-MM-DD');
      queryParams.endDate = values.date_range[1].format('YYYY-MM-DD');
    }

    setFilters(queryParams);
  };

  const handleReset = () => {
    form.resetFields();
    setFilters({});
  };

  // Real CSV Exporter
  const handleExportCSV = () => {
    if (!reports || reports.length === 0) {
      message.warning('No records found in this query to export.');
      return;
    }

    const headers = ['Employee Name', 'Employee ID', 'Department', 'Leave Type', 'Start Date', 'End Date', 'Total Days', 'Reason', 'Status', 'Applied On'];
    
    const rows = reports.map(r => [
      r.employeeName,
      r.employeeId,
      r.department,
      r.leaveType,
      r.startDate,
      r.endDate,
      r.totalDays,
      `"${r.reason.replace(/"/g, '""')}"`,
      r.status,
      r.appliedOn
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SocialConnect_Leave_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success(`Successfully exported ${reports.length} record(s).`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved': return <Badge status="success" text="Approved" />;
      case 'Pending': return <Badge status="warning" text="Pending" />;
      case 'Manager Approved': return <Badge status="processing" text="Manager Approved" />;
      case 'Rejected': return <Badge status="error" text="Rejected" />;
      case 'Cancelled': return <Badge status="default" text="Cancelled" />;
      default: return <Badge status="default" text={status} />;
    }
  };

  const columns = [
    {
      title: 'Employee Name',
      dataIndex: 'employeeName',
      key: 'employeeName',
      sorter: (a: any, b: any) => a.employeeName.localeCompare(b.employeeName),
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>ID: {record.employeeId}</div>
        </div>
      )
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      sorter: (a: any, b: any) => a.department.localeCompare(b.department)
    },
    {
      title: 'Leave Category',
      dataIndex: 'leaveType',
      key: 'leaveType'
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_: any, record: any) => (
        <div>
          <div>{record.startDate} to {record.endDate}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Duration: {record.totalDays} business day(s)</div>
        </div>
      )
    },
    {
      title: 'Applied On',
      dataIndex: 'appliedOn',
      key: 'appliedOn',
      sorter: (a: any, b: any) => a.appliedOn.localeCompare(b.appliedOn)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusBadge(status)
    }
  ];

  return (
    <div>
      {/* REPORTS PARAMETERS BOX */}
      <Card 
        bordered={false} 
        style={{ marginBottom: 24 }}
        title={<span style={{ fontWeight: 600, fontSize: 15 }}>Reports Query Board</span>}
      >
        <Form form={form} layout="vertical" onFinish={handleSearch}>
          <Row gutter={[24, 8]}>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="departmentId" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Department</span>}>
                <Select placeholder="All Departments" allowClear>
                  {departments?.map(d => (
                    <Option key={d.id} value={d.id}>{d.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="employeeId" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Employee Name</span>}>
                <Select placeholder="All Employees" allowClear showSearch optionFilterProp="children">
                  {employeesList.map(e => (
                    <Option key={e.id} value={e.id}>{e.first_name} {e.last_name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="leaveTypeId" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Leave Category</span>}>
                <Select placeholder="All Leave Types" allowClear>
                  {leaveTypes?.map(t => (
                    <Option key={t.id} value={t.id}>{t.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item name="date_range" label={<span style={{ fontSize: 12, fontWeight: 500 }}>Date Range</span>}>
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16, marginTop: 8 }} align="middle" justify="space-between">
            <Col>
              <Button 
                type="primary" 
                onClick={handleExportCSV}
                icon={<DownloadOutlined />}
                disabled={!reports || reports.length === 0}
              >
                Export CSV Report
              </Button>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  Reset Filters
                </Button>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  Generate Report
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>

      {/* REPORT LISTING TABLE */}
      <Card 
        bordered={false} 
      >
        <Table 
          columns={columns} 
          dataSource={reports} 
          loading={isLoading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No report logs matching query." />
          }}
        />
      </Card>
    </div>
  );
};
