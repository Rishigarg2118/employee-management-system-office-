import React, { useState } from 'react';
import { Table, Card, Select, DatePicker, Button, Typography, Space, Row, Col, Divider, message } from 'antd';
import { DownloadOutlined, SearchOutlined, BarChartOutlined, PrinterOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { Attendance } from '../../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;

export const AttendanceReports: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<number | undefined>(undefined);
  const [presetPeriod, setPresetPeriod] = useState<string>('custom');
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [dateRangeVal, setDateRangeVal] = useState<any>(null);

  // 1. Fetch departments
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: api.getDepartments
  });

  // 2. Fetch report data
  const { data: reportData, isLoading } = useQuery<Attendance[]>({
    queryKey: ['attendanceReport', selectedDept, startDate, endDate],
    queryFn: () => api.getAttendanceReport({
      departmentId: selectedDept,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    })
  });

  // Handle Preset Period Switch
  const handlePresetChange = (preset: string) => {
    setPresetPeriod(preset);
    let start: string | undefined = undefined;
    let end: string | undefined = undefined;

    if (preset === 'today') {
      const today = dayjs().format('YYYY-MM-DD');
      start = today;
      end = today;
      setDateRangeVal([dayjs(), dayjs()]);
    } else if (preset === 'weekly') {
      start = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
      end = dayjs().format('YYYY-MM-DD');
      setDateRangeVal([dayjs().subtract(7, 'day'), dayjs()]);
    } else if (preset === 'monthly') {
      start = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
      end = dayjs().format('YYYY-MM-DD');
      setDateRangeVal([dayjs().subtract(30, 'day'), dayjs()]);
    } else {
      start = undefined;
      end = undefined;
      setDateRangeVal(null);
    }

    setStartDate(start);
    setEndDate(end);
  };

  // 3. Export CSV handler
  const handleExportCSV = () => {
    if (!reportData || reportData.length === 0) {
      message.warning('No report data available to export.');
      return;
    }

    const headers = [
      'Date', 
      'Employee ID', 
      'Full Name', 
      'Department', 
      'Designation', 
      'Status', 
      'Clock In', 
      'Clock Out', 
      'Hours Worked', 
      'Audit Remarks'
    ];

    const rows = reportData.map(log => {
      const emp = (log.employee || {}) as any;
      const dept = departments?.find((d: any) => d.id === emp.department_id);
      
      const checkInStr = log.check_in ? dayjs(log.check_in).format('hh:mm A') : 'N/A';
      const checkOutStr = log.check_out ? dayjs(log.check_out).format('hh:mm A') : 'N/A';
      const hoursStr = log.working_hours ? `${log.working_hours}` : '0';
      const remarkStr = log.remarks || 'None';

      return [
        log.date,
        emp.employee_id || 'N/A',
        `${emp.first_name || ''} ${emp.last_name || ''}`,
        dept?.name || 'N/A',
        emp.designation || 'N/A',
        log.status,
        checkInStr,
        checkOutStr,
        hoursStr,
        remarkStr
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Enterprise_Attendance_Report_${dayjs().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Report successfully exported as CSV!');
  };

  const columns = [
    {
      title: 'Employee ID',
      key: 'employeeId',
      render: (_: any, record: any) => record.employee?.employee_id || 'N/A'
    },
    {
      title: 'Full Name',
      key: 'fullName',
      render: (_: any, record: any) => record.employee ? `${record.employee.first_name} ${record.employee.last_name}` : 'N/A',
      sorter: (a: any, b: any) => {
        const nameA = `${a.employee?.first_name || ''} ${a.employee?.last_name || ''}`;
        const nameB = `${b.employee?.first_name || ''} ${b.employee?.last_name || ''}`;
        return nameA.localeCompare(nameB);
      }
    },
    {
      title: 'Department',
      key: 'dept',
      render: (_: any, record: any) => {
        const dept = departments?.find((d: any) => d.id === record.employee?.department_id);
        return dept ? dept.name : 'N/A';
      }
    },
    {
      title: 'Shift Date',
      dataIndex: 'date',
      key: 'date',
      render: (text: string) => <span>{dayjs(text).format('YYYY-MM-DD')}</span>,
      sorter: (a: Attendance, b: Attendance) => a.date.localeCompare(b.date)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span style={{ fontWeight: 600 }}>
          {status}
        </span>
      ),
      filters: [
        { text: 'Present', value: 'Present' },
        { text: 'Late', value: 'Late' },
        { text: 'WFH', value: 'Work From Home' },
        { text: 'Half Day', value: 'Half Day' },
        { text: 'Absent', value: 'Absent' }
      ],
      onFilter: (value: any, record: Attendance) => record.status === value
    },
    {
      title: 'Clock In',
      dataIndex: 'check_in',
      key: 'check_in',
      render: (time: string) => time ? dayjs(time).format('hh:mm A') : '--:--'
    },
    {
      title: 'Clock Out',
      dataIndex: 'check_out',
      key: 'check_out',
      render: (time: string) => time ? dayjs(time).format('hh:mm A') : '--:--'
    },
    {
      title: 'Shift Hours',
      dataIndex: 'working_hours',
      key: 'working_hours',
      render: (hours: number) => hours ? <span style={{ fontWeight: 600 }}>{hours} hrs</span> : '--'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* EXPORT OPTIONS PANEL */}
      <Card 
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
      >
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} lg={18}>
            <Space size={12} wrap>
              {/* Preset Period Selector */}
              <Select
                value={presetPeriod}
                onChange={handlePresetChange}
                style={{ width: 150 }}
                placeholder="Select Period"
              >
                <Option value="custom">Custom Date Range</Option>
                <Option value="today">Today (Daily)</Option>
                <Option value="weekly">Last 7 Days (Weekly)</Option>
                <Option value="monthly">Last 30 Days (Monthly)</Option>
              </Select>

              <Select
                placeholder="All Departments"
                style={{ width: 180 }}
                allowClear
                value={selectedDept}
                onChange={(val) => setSelectedDept(val)}
              >
                {departments?.map((dept: any) => (
                  <Option key={dept.id} value={dept.id}>{dept.name}</Option>
                ))}
              </Select>

              <DatePicker.RangePicker
                value={dateRangeVal}
                disabled={presetPeriod !== 'custom'}
                onChange={(dates) => {
                  setDateRangeVal(dates);
                  if (dates) {
                    setStartDate(dates[0]?.format('YYYY-MM-DD'));
                    setEndDate(dates[1]?.format('YYYY-MM-DD'));
                  } else {
                    setStartDate(undefined);
                    setEndDate(undefined);
                  }
                }}
                style={{ borderRadius: 8 }}
              />
            </Space>
          </Col>
          <Col xs={24} lg={6} style={{ textAlign: 'right' }}>
            <Button 
              type="primary" 
              icon={<DownloadOutlined />} 
              onClick={handleExportCSV}
              style={{ borderRadius: 6, background: '#10B981', borderColor: '#10B981', height: 38, width: '100%' }}
            >
              Export CSV Report
            </Button>
          </Col>
        </Row>
      </Card>

      {/* REPORT SHEET */}
      <Card 
        bordered={false}
        title={<span style={{ fontWeight: 600 }}><BarChartOutlined /> Attendance Export Ledger</span>}
        style={{ borderRadius: 16, boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)', background: '#FFFFFF' }}
      >
        <Table 
          columns={columns} 
          dataSource={reportData} 
          rowKey="id" 
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          style={{ borderRadius: 8 }}
        />
      </Card>
    </div>
  );
};
