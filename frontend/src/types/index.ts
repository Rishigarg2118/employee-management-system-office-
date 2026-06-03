export type EmployeeStatus = 'Active' | 'Inactive' | 'On Leave' | 'Probation';
export type EmployeeRole = 'Admin' | 'Manager' | 'Employee';
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
