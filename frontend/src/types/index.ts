export type EmployeeStatus = 'Active' | 'Inactive' | 'On Leave' | 'Probation';
export type EmployeeRole = 'Super Admin' | 'Admin' | 'HR' | 'Manager' | 'Employee' | 'Intern';
export type SkillProficiency = 'Beginner' | 'Intermediate' | 'Expert';

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
  manager_id?: number | null;
  created_at?: string;
  employee_count?: number;
  manager?: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
  } | null;
}

export interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  department_id?: number | null;
  designation: string;
  status: EmployeeStatus;
  joining_date: string;
  avatar_url?: string;
  address?: string;
  bio?: string;
  role: EmployeeRole;
  created_at?: string;
  updated_at?: string;
  department?: Department | null;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
}

export interface EmployeeSkill {
  id: number;
  name: string;
  category: string;
  proficiency_level: SkillProficiency;
}

export interface Document {
  id: number;
  employee_id: number;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at?: string;
}

export interface Activity {
  id: number;
  employee_id?: number | null;
  activity_type: string;
  description: string;
  created_at?: string;
  employee_name?: string;
  employee_avatar?: string;
}

export interface EmployeeDetails extends Employee {
  skills: EmployeeSkill[];
  documents: Document[];
  timeline: Activity[];
}

export interface DashboardStats {
  summary: {
    total_employees: {
      value: number;
      trend: 'up' | 'down' | 'flat';
      percentage: string;
      label: string;
    };
    active_employees: {
      value: number;
      trend: 'up' | 'down' | 'flat';
      percentage: string;
      label: string;
    };
    departments: {
      value: number;
      trend: 'up' | 'down' | 'flat';
      percentage: string;
      label: string;
    };
    skills: {
      value: number;
      trend: 'up' | 'down' | 'flat';
      percentage: string;
      label: string;
    };
  };
}

export interface DepartmentDistributionItem {
  name: string;
  value: number;
}

export interface GrowthTrendItem {
  name: string;
  Employees: number;
  Active: number;
}

// Leave Management Interfaces
export interface LeaveType {
  id: number;
  name: string;
  code: string;
  description?: string;
  default_days: number;
}

export interface LeaveBalance {
  employee_id: number;
  leave_type_id: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
  leave_type?: LeaveType;
}

export type LeaveStatus = 'Pending' | 'Under Review' | 'Manager Approved' | 'HR Approved' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveRequest {
  id: number;
  employee_id: number;
  leave_type_id: number;
  start_date: string; // ISO date YYYY-MM-DD
  end_date: string; // ISO date YYYY-MM-DD
  total_days: number;
  reason: string;
  status: LeaveStatus;
  attachment_path?: string | null;
  created_at?: string;
  updated_at?: string;
  employee?: Omit<Employee, 'password'>;
  leave_type?: LeaveType;
  approvals?: LeaveApprovalDetails[];
}

export interface LeaveApproval {
  id: number;
  leave_request_id: number;
  approver_id: number | null;
  stage: 'Manager Review' | 'HR Review';
  status: 'Approved' | 'Rejected';
  remarks?: string;
  created_at?: string;
}

export interface LeaveApprovalDetails extends LeaveApproval {
  approver?: {
    id: number;
    first_name: string;
    last_name: string;
    role: EmployeeRole;
    designation: string;
  } | null;
}

export interface LeaveDashboardData {
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    on_leave_today: number;
  };
  monthlyTrends: Array<{ name: string; Requested: number; Approved: number }>;
  deptLeaves: Array<{ name: string; value: number }>;
  typeDistribution: Array<{ name: string; value: number }>;
  utilization: Array<{ name: string; value: number }>; // e.g. [{name: 'Sarah', value: 45}]
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Work From Home';

export interface Attendance {
  id: number;
  employee_id: number;
  date: string; // YYYY-MM-DD
  check_in?: string | null;
  check_out?: string | null;
  status: AttendanceStatus;
  working_hours?: number | null;
  remarks?: string | null;
  created_at?: string;
  employee?: Omit<Employee, 'password'>;
}

export interface AttendanceAnalytics {
  presentToday: number;
  absentToday: number;
  lateArrivals: number;
  wfhCount: number;
  monthlyPercentage: number;
  dailyStats: Array<{ date: string; present: number; absent: number; late: number; wfh: number }>;
}

export type TaskStatus = 'Todo' | 'In Progress' | 'In Review' | 'Done';
export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string | null;
  assignee_id?: number | null;
  creator_id?: number | null;
  department_id?: number | null;
  created_at?: string;
  updated_at?: string;
  assignee?: Omit<Employee, 'password'> | null;
  creator?: Omit<Employee, 'password'> | null;
  department?: Department | null;
  comments?: TaskComment[];
  activities?: TaskActivity[];
}

export interface TaskComment {
  id: number;
  task_id: number;
  author_id: number;
  content: string;
  created_at?: string;
  author?: Omit<Employee, 'password'>;
}

export interface TaskActivity {
  id: number;
  task_id: number;
  employee_id?: number | null;
  activity_type: string;
  description: string;
  created_at?: string;
  employee?: Omit<Employee, 'password'> | null;
}

