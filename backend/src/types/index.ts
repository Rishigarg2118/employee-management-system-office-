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
}

export interface Employee {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  password?: string; // Hashed password
  phone?: string;
  department_id?: number | null;
  designation: string;
  status: EmployeeStatus;
  joining_date: string; // ISO date string (YYYY-MM-DD)
  avatar_url?: string;
  address?: string;
  bio?: string;
  role: EmployeeRole;
  created_at?: string;
  updated_at?: string;
}

export interface Skill {
  id: number;
  name: string;
  category: string;
}

export interface EmployeeSkill {
  employee_id: number;
  skill_id: number;
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
}

// Expanded interfaces for API responses
export interface EmployeeDetails extends Employee {
  department?: Department | null;
  skills: Array<{
    id: number;
    name: string;
    category: string;
    proficiency_level: SkillProficiency;
  }>;
  documents: Document[];
  timeline: Activity[];
}
