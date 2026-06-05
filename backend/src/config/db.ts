import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { Department, Employee, Skill, EmployeeSkill, Document, Activity, LeaveType, LeaveBalance, LeaveRequest, LeaveApproval, LeaveDashboardData, Attendance, AttendanceStatus, AttendanceAnalytics, Task, TaskComment, TaskActivity, TaskStatus, TaskPriority } from '../types';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

const dbEnabled = process.env.DB_ENABLED === 'true';
const jsonDbPath = path.resolve(__dirname, '../../database.json');

function getLocalDateStr(): string {
  const now = new Date();
  return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

let pool: Pool | null = null;
let pgConnected = false;

// Initialize PostgreSQL Pool if enabled
if (dbEnabled) {
  try {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'premium_hrms',
    });
    console.log('[Database] PostgreSQL Pool created.');
  } catch (err) {
    console.error('[Database] Failed to create PostgreSQL pool. Falling back to JSON.', err);
  }
}

// In-Memory storage for fallback JSON database
interface JsonDatabase {
  departments: Department[];
  employees: Employee[];
  skills: Skill[];
  employee_skills: EmployeeSkill[];
  documents: Document[];
  activities: Activity[];
  leave_types: LeaveType[];
  leave_balances: LeaveBalance[];
  leave_requests: LeaveRequest[];
  leave_approvals: LeaveApproval[];
  attendance: Attendance[];
  tasks: Task[];
  task_comments: TaskComment[];
  task_activities: TaskActivity[];
}

let jsonDb: JsonDatabase = {
  departments: [],
  employees: [],
  skills: [],
  employee_skills: [],
  documents: [],
  activities: [],
  leave_types: [],
  leave_balances: [],
  leave_requests: [],
  leave_approvals: [],
  attendance: [],
  tasks: [],
  task_comments: [],
  task_activities: []
};

// Seed Data definition
const seedDepartments: Omit<Department, 'id'>[] = [
  { name: 'Engineering', code: 'ENG', description: 'Software engineering, DevOps, and QA operations.' },
  { name: 'Product Design', code: 'DES', description: 'UI/UX design, visual design, user research, and branding.' },
  { name: 'Product Management', code: 'PM', description: 'Product strategy, planning, roadmaps, and execution.' },
  { name: 'Human Resources', code: 'HR', description: 'Talent acquisition, employee success, and culture.' },
  { name: 'Finance & Ops', code: 'FIN', description: 'Financial planning, accounting, and general operations.' }
];

const seedSkills: Omit<Skill, 'id'>[] = [
  { name: 'React', category: 'Frontend' },
  { name: 'TypeScript', category: 'Frontend' },
  { name: 'Tailwind CSS', category: 'Frontend' },
  { name: 'Next.js', category: 'Frontend' },
  { name: 'Node.js', category: 'Backend' },
  { name: 'Express', category: 'Backend' },
  { name: 'PostgreSQL', category: 'Backend' },
  { name: 'Go', category: 'Backend' },
  { name: 'Docker', category: 'DevOps' },
  { name: 'AWS', category: 'DevOps' },
  { name: 'Figma', category: 'Design' },
  { name: 'UI/UX Research', category: 'Design' },
  { name: 'Product Roadmap', category: 'Management' },
  { name: 'Talent Acquisition', category: 'Management' },
  { name: 'Financial Modeling', category: 'Finance' }
];

const seedEmployeesData = [
  { employee_id: 'EMP-001', first_name: 'Sarah', last_name: 'Jenkins', email: 'sarah.j@enterprise.io', designation: 'VP of Engineering', status: 'Active' as const, joining_date: '2022-01-15', role: 'Super Admin' as const, bio: 'Veteran tech leader focused on scaling teams, building robust architectures, and promoting developer happiness.', phone: '+1 (555) 123-4567', address: 'San Francisco, CA' },
  { employee_id: 'EMP-002', first_name: 'David', last_name: 'Chen', email: 'david.c@enterprise.io', designation: 'Principal Architect', status: 'Active' as const, joining_date: '2022-04-10', role: 'Manager' as const, bio: 'Passionate builder of microservices, distributed systems, and real-time data pipelines.', phone: '+1 (555) 234-5678', address: 'Seattle, WA' },
  { employee_id: 'EMP-003', first_name: 'Aisha', last_name: 'Rahman', email: 'aisha.r@enterprise.io', designation: 'Lead UI/UX Designer', status: 'Active' as const, joining_date: '2023-02-01', role: 'Manager' as const, bio: 'Creating beautiful, user-centered digital interfaces that simplify complex B2B enterprise workflows.', phone: '+1 (555) 345-6789', address: 'New York, NY' },
  { employee_id: 'EMP-004', first_name: 'Marcus', last_name: 'Vance', email: 'marcus.v@enterprise.io', designation: 'Senior Frontend Engineer', status: 'Active' as const, joining_date: '2023-06-15', role: 'Employee' as const, bio: 'Component-driven development advocate. Loves CSS-in-JS, animation, and performance optimization.', phone: '+1 (555) 456-7890', address: 'Austin, TX' },
  { employee_id: 'EMP-005', first_name: 'Elena', last_name: 'Rostova', email: 'elena.r@enterprise.io', designation: 'HR Director', status: 'Active' as const, joining_date: '2021-09-01', role: 'HR' as const, bio: 'Dedicated to cultivating positive corporate culture, managing talent development, and HR compliance.', phone: '+1 (555) 567-8901', address: 'Chicago, IL' },
  { employee_id: 'EMP-006', first_name: 'John', last_name: 'Doe', email: 'john.doe@enterprise.io', designation: 'Senior React Developer', status: 'Active' as const, joining_date: '2024-01-10', role: 'Employee' as const, bio: 'Passionate about building responsive, accessible web interfaces.', phone: '+1 (555) 678-9012', address: 'Boston, MA' },
  { employee_id: 'EMP-007', first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@enterprise.io', designation: 'Senior Product Manager', status: 'Active' as const, joining_date: '2023-08-20', role: 'Manager' as const, bio: 'Driving product strategy, defining roadmaps, and collaborating across engineering and design.', phone: '+1 (555) 789-0123', address: 'Los Angeles, CA' },
  { employee_id: 'EMP-008', first_name: 'Liam', last_name: 'O\'Connor', email: 'liam.o@enterprise.io', designation: 'DevOps Engineer', status: 'Active' as const, joining_date: '2024-03-01', role: 'Employee' as const, bio: 'Automating cloud infrastructure, managing CI/CD pipelines, and ensuring system uptime.', phone: '+1 (555) 890-1234', address: 'Denver, CO' },
  { employee_id: 'EMP-009', first_name: 'Chloe', last_name: 'Tan', email: 'chloe.tan@enterprise.io', designation: 'UI Designer', status: 'Probation' as const, joining_date: '2026-03-15', role: 'Employee' as const, bio: 'Junior designer obsessed with typography, grids, and design systems.', phone: '+1 (555) 901-2345', address: 'San Francisco, CA' },
  { employee_id: 'EMP-010', first_name: 'Kofi', last_name: 'Anan', email: 'kofi.a@enterprise.io', designation: 'Backend Engineer', status: 'On Leave' as const, joining_date: '2022-11-10', role: 'Employee' as const, bio: 'API developer who writes clean, modular code in Node.js and Go.', phone: '+1 (555) 012-3456', address: 'Washington, DC' },
  { employee_id: 'EMP-011', first_name: 'Sophia', last_name: 'Martinez', email: 'sophia.m@enterprise.io', designation: 'Finance Lead', status: 'Active' as const, joining_date: '2022-03-01', role: 'Manager' as const, bio: 'Overseeing financial health, modeling growth, and optimizing tax strategies.', phone: '+1 (555) 123-7890', address: 'Miami, FL' },
  { employee_id: 'EMP-012', first_name: 'Julian', last_name: 'Draxler', email: 'julian.d@enterprise.io', designation: 'QA Specialist', status: 'Inactive' as const, joining_date: '2023-10-15', role: 'Employee' as const, bio: 'Breaking software so customers don\'t. Specialized in automated browser testing.', phone: '+1 (555) 234-8901', address: 'Portland, OR' },
  { employee_id: 'EMP-013', first_name: 'Toby', last_name: 'Flenderson', email: 'toby.f@enterprise.io', designation: 'HR Specialist', status: 'Active' as const, joining_date: '2024-05-01', role: 'HR' as const, bio: 'Talent management, compliance, and employee relations coordinator.', phone: '+1 (555) 111-2222', address: 'Scranton, PA' },
  { employee_id: 'EMP-014', first_name: 'Pam', last_name: 'Beesly', email: 'pam.b@enterprise.io', designation: 'Operations Intern', status: 'Active' as const, joining_date: '2026-05-01', role: 'Intern' as const, bio: 'Supporting administrative workflows, scheduling, and general office operations.', phone: '+1 (555) 333-4444', address: 'Scranton, PA' }
];

// Helper to write changes to local JSON file
function saveJsonDb() {
  fs.writeFileSync(jsonDbPath, JSON.stringify(jsonDb, null, 2), 'utf-8');
}

// Generate deterministic historical attendance logs for seeding
function generateSeedAttendance(employeesList: any[]): Attendance[] {
  const list: Attendance[] = [];
  const today = new Date();
  let idCounter = 1;

  // Generate logs for last 15 days, skipping weekends
  for (let i = 15; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    const dateStr = d.toISOString().split('T')[0];

    for (const emp of employeesList) {
      const seed = (emp.id * 17 + i * 31) % 100;
      let status: AttendanceStatus = 'Present';
      let checkInTime: string | null = null;
      let checkOutTime: string | null = null;
      let workingHours: number | null = null;
      let remarks: string | null = null;

      if (seed < 80) {
        status = 'Present';
        const minutes = 30 + (seed % 15); // Check in between 8:30 and 8:45 AM
        checkInTime = `${dateStr}T08:${minutes < 10 ? '0' + minutes : minutes}:00.000Z`;
        const outMinutes = 30 + (seed % 30); // Check out between 5:30 and 6:00 PM
        checkOutTime = `${dateStr}T17:${outMinutes < 10 ? '0' + outMinutes : outMinutes}:00.000Z`;
      } else if (seed < 90) {
        status = 'Late';
        const minutes = 35 + (seed % 20); // Check in between 9:35 and 9:55 AM
        checkInTime = `${dateStr}T09:${minutes}:00.000Z`;
        const outMinutes = 30 + (seed % 30); // Check out between 6:30 and 7:00 PM
        checkOutTime = `${dateStr}T18:${outMinutes < 10 ? '0' + outMinutes : outMinutes}:00.000Z`;
        remarks = 'Delayed due to traffic/transit delay.';
      } else if (seed < 95) {
        status = 'Work From Home';
        const minutes = 50 + (seed % 10);
        checkInTime = `${dateStr}T08:${minutes}:00.000Z`;
        checkOutTime = `${dateStr}T17:00:00.000Z`;
        remarks = 'Remote work pre-approved.';
      } else if (seed < 98) {
        status = 'Half Day';
        checkInTime = `${dateStr}T09:00:00.000Z`;
        checkOutTime = `${dateStr}T13:00:00.000Z`;
        remarks = 'Doctor appointment in the afternoon.';
      } else {
        status = 'Absent';
        remarks = 'Personal emergency absence.';
      }

      if (checkInTime && checkOutTime) {
        const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
        workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
      }

      list.push({
        id: idCounter++,
        employee_id: emp.id,
        date: dateStr,
        check_in: checkInTime,
        check_out: checkOutTime,
        status,
        working_hours: workingHours,
        remarks,
        created_at: `${dateStr}T08:00:00.000Z`
      });
    }
  }

  return list;
}

// Generate mock tasks, comments, and activities for seeding
function generateSeedTasks(employeesList: any[]) {
  const findEmpId = (email: string, defaultId: number) => {
    const e = employeesList.find((x: any) => x.email === email);
    return e ? e.id : defaultId;
  };

  const sarahId = findEmpId('sarah.j@enterprise.io', 1);
  const davidId = findEmpId('david.c@enterprise.io', 2);
  const aishaId = findEmpId('aisha.r@enterprise.io', 3);
  const marcusId = findEmpId('marcus.v@enterprise.io', 4);
  const elenaId = findEmpId('elena.r@enterprise.io', 5);
  const liamId = findEmpId('liam.o@enterprise.io', 8);
  const sophiaId = findEmpId('sophia.m@enterprise.io', 11);

  const tasks: Task[] = [
    {
      id: 1,
      title: 'Implement Phase 1 Attendance module',
      description: 'Develop checking in, checking out, history, and manager corrections panel.',
      status: 'Done',
      priority: 'High',
      due_date: '2026-06-03',
      assignee_id: marcusId,
      creator_id: davidId,
      department_id: 1,
      created_at: new Date('2026-05-20T09:00:00Z').toISOString(),
      updated_at: new Date('2026-06-03T17:00:00Z').toISOString()
    },
    {
      id: 2,
      title: 'Design HRMS System Identity',
      description: 'Define branding, corporate palette, typography, and premium component guides.',
      status: 'Done',
      priority: 'Urgent',
      due_date: '2026-05-30',
      assignee_id: aishaId,
      creator_id: sarahId,
      department_id: 2,
      created_at: new Date('2026-05-15T10:00:00Z').toISOString(),
      updated_at: new Date('2026-05-28T16:30:00Z').toISOString()
    },
    {
      id: 3,
      title: 'Setup PostgreSQL staging server',
      description: 'Configure PG database replica, index buffers, and backup routines.',
      status: 'In Progress',
      priority: 'Medium',
      due_date: '2026-06-15',
      assignee_id: liamId,
      creator_id: davidId,
      department_id: 1,
      created_at: new Date('2026-06-01T09:00:00Z').toISOString(),
      updated_at: new Date('2026-06-02T11:00:00Z').toISOString()
    },
    {
      id: 4,
      title: 'Draft Employee Offboarding policy',
      description: 'Establish standard checkout documents list, hardware returns, and transition reviews.',
      status: 'Todo',
      priority: 'Low',
      due_date: '2026-06-20',
      assignee_id: elenaId,
      creator_id: sarahId,
      department_id: 4,
      created_at: new Date('2026-06-03T14:00:00Z').toISOString(),
      updated_at: new Date('2026-06-03T14:00:00Z').toISOString()
    },
    {
      id: 5,
      title: 'Review quarterly financial budgets',
      description: 'Verify project spending sheets, licensing costs, and headcount reserves.',
      status: 'In Review',
      priority: 'High',
      due_date: '2026-06-10',
      assignee_id: sophiaId,
      creator_id: sarahId,
      department_id: 5,
      created_at: new Date('2026-06-02T10:00:00Z').toISOString(),
      updated_at: new Date('2026-06-03T15:00:00Z').toISOString()
    }
  ];

  const comments: TaskComment[] = [
    {
      id: 1,
      task_id: 1,
      author_id: davidId,
      content: 'Looking good, Marcus. Make sure PG indexes are correct.',
      created_at: new Date('2026-05-25T11:00:00Z').toISOString()
    },
    {
      id: 2,
      task_id: 1,
      author_id: marcusId,
      content: "Thanks David, I've added the unique constraints and performance indexes.",
      created_at: new Date('2026-05-26T14:30:00Z').toISOString()
    },
    {
      id: 3,
      task_id: 2,
      author_id: sarahId,
      content: "Identity looks great! Let's go with the Emerald palette.",
      created_at: new Date('2026-05-20T16:00:00Z').toISOString()
    }
  ];

  const activities: TaskActivity[] = [
    {
      id: 1,
      task_id: 1,
      employee_id: davidId,
      activity_type: 'CREATED',
      description: 'Task was created by David Chen.',
      created_at: new Date('2026-05-20T09:00:00Z').toISOString()
    },
    {
      id: 2,
      task_id: 1,
      employee_id: davidId,
      activity_type: 'REASSIGNED',
      description: 'Assigned task to Marcus Vance.',
      created_at: new Date('2026-05-20T09:05:00Z').toISOString()
    },
    {
      id: 3,
      task_id: 1,
      employee_id: marcusId,
      activity_type: 'STATUS_CHANGE',
      description: 'Changed status from Todo to In Progress.',
      created_at: new Date('2026-05-21T10:00:00Z').toISOString()
    },
    {
      id: 4,
      task_id: 1,
      employee_id: marcusId,
      activity_type: 'STATUS_CHANGE',
      description: 'Changed status from In Progress to In Review.',
      created_at: new Date('2026-06-02T15:00:00Z').toISOString()
    },
    {
      id: 5,
      task_id: 1,
      employee_id: elenaId,
      activity_type: 'STATUS_CHANGE',
      description: 'Changed status from In Review to Done.',
      created_at: new Date('2026-06-03T17:00:00Z').toISOString()
    },
    {
      id: 6,
      task_id: 2,
      employee_id: sarahId,
      activity_type: 'CREATED',
      description: 'Task was created by Sarah Jenkins.',
      created_at: new Date('2026-05-15T10:00:00Z').toISOString()
    },
    {
      id: 7,
      task_id: 2,
      employee_id: aishaId,
      activity_type: 'STATUS_CHANGE',
      description: 'Changed status from In Progress to Done.',
      created_at: new Date('2026-05-28T16:30:00Z').toISOString()
    }
  ];

  return { tasks, comments, activities };
}

// Seed JSON DB
async function seedJsonDatabase() {
  console.log('[Database] Seeding fallback JSON Database...');
  
  // Hash password for employees
  const hashedPassword = await bcrypt.hash('password123', 10);

  // 1. Seed Departments
  jsonDb.departments = seedDepartments.map((dept, index) => ({
    id: index + 1,
    ...dept,
    created_at: new Date(Date.now() - (100 - index) * 24 * 3600 * 1000).toISOString()
  }));

  // 2. Seed Skills
  jsonDb.skills = seedSkills.map((skill, index) => ({
    id: index + 1,
    ...skill
  }));

  // 3. Seed Employees
  jsonDb.employees = seedEmployeesData.map((emp, index) => {
    // Distribute departments
    let deptId = 1; // Engineering
    if (emp.designation.includes('Designer') || emp.designation.includes('Design')) {
      deptId = 2; // Design
    } else if (emp.designation.includes('Product Manager')) {
      deptId = 3; // PM
    } else if (emp.designation.includes('HR')) {
      deptId = 4; // HR
    } else if (emp.designation.includes('Finance')) {
      deptId = 5; // Finance
    }
    
    return {
      id: index + 1,
      ...emp,
      password: hashedPassword,
      department_id: deptId,
      created_at: new Date(emp.joining_date).toISOString(),
      updated_at: new Date(emp.joining_date).toISOString()
    };
  });

  // Assign department managers
  jsonDb.departments[0].manager_id = 1; // Sarah - VP Eng
  jsonDb.departments[1].manager_id = 3; // Aisha - Lead Designer
  jsonDb.departments[2].manager_id = 7; // Jane - Senior PM
  jsonDb.departments[3].manager_id = 5; // Elena - HR Director
  jsonDb.departments[4].manager_id = 11; // Sophia - Finance Lead

  // 4. Seed Employee Skills
  // Sarah (id: 1) - Management, Roadmap
  jsonDb.employee_skills.push(
    { employee_id: 1, skill_id: 13, proficiency_level: 'Expert' }, // Product Roadmap
    { employee_id: 1, skill_id: 14, proficiency_level: 'Expert' }  // Talent Acquisition
  );
  // David (id: 2) - Node, PostgreSQL, Go, Docker, AWS
  jsonDb.employee_skills.push(
    { employee_id: 2, skill_id: 5, proficiency_level: 'Expert' }, // Node
    { employee_id: 2, skill_id: 7, proficiency_level: 'Expert' }, // Postgres
    { employee_id: 2, skill_id: 8, proficiency_level: 'Expert' }, // Go
    { employee_id: 2, skill_id: 9, proficiency_level: 'Expert' }  // Docker
  );
  // Aisha (id: 3) - Figma, Research
  jsonDb.employee_skills.push(
    { employee_id: 3, skill_id: 11, proficiency_level: 'Expert' },
    { employee_id: 3, skill_id: 12, proficiency_level: 'Expert' }
  );
  // Marcus (id: 4) - React, TS, Tailwind, Next
  jsonDb.employee_skills.push(
    { employee_id: 4, skill_id: 1, proficiency_level: 'Expert' },
    { employee_id: 4, skill_id: 2, proficiency_level: 'Expert' },
    { employee_id: 4, skill_id: 3, proficiency_level: 'Intermediate' }
  );
  // Seed basic skills for other members
  for (let i = 5; i <= 12; i++) {
    const primarySkill = (i % 15) + 1;
    jsonDb.employee_skills.push({
      employee_id: i,
      skill_id: primarySkill,
      proficiency_level: i % 3 === 0 ? 'Expert' : 'Intermediate'
    });
  }

  // 5. Seed Documents
  jsonDb.documents = [
    { id: 1, employee_id: 1, name: 'offer_letter.pdf', file_path: 'uploads/demo_offer.pdf', file_size: 154200, file_type: 'application/pdf', uploaded_at: new Date('2022-01-10').toISOString() },
    { id: 2, employee_id: 1, name: 'resume.pdf', file_path: 'uploads/demo_resume.pdf', file_size: 245000, file_type: 'application/pdf', uploaded_at: new Date('2022-01-10').toISOString() },
    { id: 3, employee_id: 4, name: 'portfolio.pdf', file_path: 'uploads/demo_portfolio.pdf', file_size: 489000, file_type: 'application/pdf', uploaded_at: new Date('2023-06-12').toISOString() }
  ];

  // 6. Seed Activities
  jsonDb.activities = [
    { id: 1, employee_id: 1, activity_type: 'EMPLOYEE_CREATED', description: 'Sarah Jenkins joined the company as VP of Engineering.', created_at: new Date('2022-01-15').toISOString() },
    { id: 2, employee_id: 1, activity_type: 'STATUS_CHANGE', description: 'Sarah Jenkins status set to Active.', created_at: new Date('2022-01-15').toISOString() },
    { id: 3, employee_id: 2, activity_type: 'EMPLOYEE_CREATED', description: 'David Chen was hired as Principal Architect.', created_at: new Date('2022-04-10').toISOString() },
    { id: 4, employee_id: 3, activity_type: 'EMPLOYEE_CREATED', description: 'Aisha Rahman joined design division as Lead UI/UX Designer.', created_at: new Date('2023-02-01').toISOString() },
    { id: 5, employee_id: 4, activity_type: 'SKILL_ASSIGNED', description: 'React assigned to Marcus Vance with Expert proficiency.', created_at: new Date('2023-06-16').toISOString() },
    { id: 6, employee_id: 9, activity_type: 'EMPLOYEE_CREATED', description: 'Chloe Tan added to roster on Probation.', created_at: new Date('2026-03-15').toISOString() }
  ];

  // 7. Seed Leave Types
  const leaveTypesData: LeaveType[] = [
    { id: 1, name: 'Casual Leave', code: 'CL', description: 'Used for casual personal reasons, vacation, or short breaks.', default_days: 12 },
    { id: 2, name: 'Sick Leave', code: 'SL', description: 'Used for medical emergencies, illness, or medical consultations.', default_days: 10 },
    { id: 3, name: 'Earned Leave', code: 'EL', description: 'Accrued vacation time based on service duration.', default_days: 15 },
    { id: 4, name: 'Maternity Leave', code: 'ML', description: 'Paid maternity leave for female employees.', default_days: 90 }
  ];
  jsonDb.leave_types = leaveTypesData;

  // 8. Seed Leave Balances for all employees
  jsonDb.leave_balances = [];
  jsonDb.employees.forEach(emp => {
    leaveTypesData.forEach(lt => {
      let used = 0;
      if (emp.id === 4) {
        if (lt.code === 'CL') used = 2;
        if (lt.code === 'SL') used = 1;
      }
      if (emp.id === 6 && lt.code === 'EL') {
        used = 4;
      }
      
      jsonDb.leave_balances.push({
        employee_id: emp.id,
        leave_type_id: lt.id,
        total_days: lt.default_days,
        used_days: used,
        remaining_days: lt.default_days - used
      });
    });
  });

  // 9. Seed Leave Requests
  jsonDb.leave_requests = [
    {
      id: 1,
      employee_id: 4,
      leave_type_id: 1,
      start_date: '2026-05-10',
      end_date: '2026-05-11',
      total_days: 2,
      reason: 'Family event and short vacation.',
      status: 'Approved',
      attachment_path: null,
      created_at: new Date('2026-05-01T09:00:00Z').toISOString(),
      updated_at: new Date('2026-05-02T14:30:00Z').toISOString()
    },
    {
      id: 2,
      employee_id: 4,
      leave_type_id: 2,
      start_date: '2026-05-25',
      end_date: '2026-05-25',
      total_days: 1,
      reason: 'Sudden high fever and dental consultation.',
      status: 'Approved',
      attachment_path: null,
      created_at: new Date('2026-05-25T07:15:00Z').toISOString(),
      updated_at: new Date('2026-05-25T11:00:00Z').toISOString()
    },
    {
      id: 3,
      employee_id: 4,
      leave_type_id: 1,
      start_date: '2026-06-10',
      end_date: '2026-06-12',
      total_days: 3,
      reason: 'Attending cousin wedding and travel.',
      status: 'Pending',
      attachment_path: null,
      created_at: new Date('2026-06-03T10:00:00Z').toISOString(),
      updated_at: new Date('2026-06-03T10:00:00Z').toISOString()
    },
    {
      id: 4,
      employee_id: 9,
      leave_type_id: 3,
      start_date: '2026-06-15',
      end_date: '2026-06-19',
      total_days: 5,
      reason: 'Annual family road trip.',
      status: 'Manager Approved',
      attachment_path: null,
      created_at: new Date('2026-06-02T15:20:00Z').toISOString(),
      updated_at: new Date('2026-06-03T11:45:00Z').toISOString()
    },
    {
      id: 5,
      employee_id: 10,
      leave_type_id: 2,
      start_date: '2026-04-12',
      end_date: '2026-04-13',
      total_days: 2,
      reason: 'Recovery from minor surgery.',
      status: 'Rejected',
      attachment_path: null,
      created_at: new Date('2026-04-10T08:30:00Z').toISOString(),
      updated_at: new Date('2026-04-11T13:00:00Z').toISOString()
    },
    {
      id: 6,
      employee_id: 6,
      leave_type_id: 3,
      start_date: '2026-06-02',
      end_date: '2026-06-05',
      total_days: 4,
      reason: 'Personal relocation and home setup.',
      status: 'Approved',
      attachment_path: null,
      created_at: new Date('2026-05-28T09:10:00Z').toISOString(),
      updated_at: new Date('2026-05-29T16:20:00Z').toISOString()
    }
  ];

  // 10. Seed Leave Approvals
  jsonDb.leave_approvals = [
    {
      id: 1,
      leave_request_id: 1,
      approver_id: 2,
      stage: 'Manager Review',
      status: 'Approved',
      remarks: 'Approved. Team schedule allows it.',
      created_at: new Date('2026-05-02T10:00:00Z').toISOString()
    },
    {
      id: 2,
      leave_request_id: 1,
      approver_id: 5,
      stage: 'HR Review',
      status: 'Approved',
      remarks: 'Final HR Approval. Balance verified.',
      created_at: new Date('2026-05-02T14:30:00Z').toISOString()
    },
    {
      id: 3,
      leave_request_id: 2,
      approver_id: 2,
      stage: 'Manager Review',
      status: 'Approved',
      remarks: 'Approved. Take care.',
      created_at: new Date('2026-05-25T09:00:00Z').toISOString()
    },
    {
      id: 4,
      leave_request_id: 2,
      approver_id: 5,
      stage: 'HR Review',
      status: 'Approved',
      remarks: 'Processed. Medical certificate requested if extended.',
      created_at: new Date('2026-05-25T11:00:00Z').toISOString()
    },
    {
      id: 5,
      leave_request_id: 4,
      approver_id: 3,
      stage: 'Manager Review',
      status: 'Approved',
      remarks: 'Recommended. Design schedule looks good.',
      created_at: new Date('2026-06-03T11:45:00Z').toISOString()
    },
    {
      id: 6,
      leave_request_id: 5,
      approver_id: 1,
      stage: 'Manager Review',
      status: 'Rejected',
      remarks: 'Client delivery deadline on these dates. Please reschedule if possible.',
      created_at: new Date('2026-04-11T13:00:00Z').toISOString()
    },
    {
      id: 7,
      leave_request_id: 6,
      approver_id: 1,
      stage: 'Manager Review',
      status: 'Approved',
      remarks: 'Approved.',
      created_at: new Date('2026-05-29T10:00:00Z').toISOString()
    },
    {
      id: 8,
      leave_request_id: 6,
      approver_id: 5,
      stage: 'HR Review',
      status: 'Approved',
      remarks: 'Approved.',
      created_at: new Date('2026-05-29T16:20:00Z').toISOString()
    }
  ];

  // 11. Seed Attendance
  jsonDb.attendance = generateSeedAttendance(jsonDb.employees);

  // 12. Seed Tasks
  const taskSeeds = generateSeedTasks(jsonDb.employees);
  jsonDb.tasks = taskSeeds.tasks;
  jsonDb.task_comments = taskSeeds.comments;
  jsonDb.task_activities = taskSeeds.activities;

  saveJsonDb();
  console.log('[Database] Fallback JSON database successfully seeded.');
}

// Check database initialization
export async function initializeDatabase() {
  if (dbEnabled && pool) {
    try {
      const client = await pool.connect();
      pgConnected = true;
      console.log('[Database] Connected to PostgreSQL database successfully.');
      
      // Dynamic Role Check Constraint Upgrade (Phase 3)
      try {
        const constraintRes = await client.query(`
          SELECT constraint_name 
          FROM information_schema.constraint_column_usage 
          WHERE table_name = 'employees' AND column_name = 'role'
        `);
        for (const row of constraintRes.rows) {
          await client.query(`ALTER TABLE employees DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
        }
        await client.query(`
          ALTER TABLE employees ADD CONSTRAINT employees_role_check 
          CHECK (role IN ('Super Admin', 'Admin', 'HR', 'Manager', 'Employee', 'Intern'))
        `);
      } catch (e) {
        console.warn('[Database] Failed to alter PostgreSQL role constraint, it might already be updated.', e);
      }

      // Check if schema exists and seed if empty
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'employees'
        );
      `);
      
      const exists = tableCheck.rows[0].exists;
      if (!exists) {
        console.log('[Database] Tables not found. Please run schema.sql in PostgreSQL to set up tables.');
      } else {
        // Ensure attendance table and its indexes exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS attendance (
              id SERIAL PRIMARY KEY,
              employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
              date DATE NOT NULL,
              check_in TIMESTAMP,
              check_out TIMESTAMP,
              status VARCHAR(30) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Half Day', 'Work From Home')),
              working_hours NUMERIC(4,2),
              remarks TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT unique_employee_date UNIQUE (employee_id, date)
          );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date)');

        // Ensure tasks tables and indexes exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS tasks (
              id SERIAL PRIMARY KEY,
              title VARCHAR(255) NOT NULL,
              description TEXT,
              status VARCHAR(50) DEFAULT 'Todo' CHECK (status IN ('Todo', 'In Progress', 'In Review', 'Done')),
              priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
              due_date DATE,
              assignee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
              creator_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
              department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS task_comments (
              id SERIAL PRIMARY KEY,
              task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
              author_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
              content TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS task_activities (
              id SERIAL PRIMARY KEY,
              task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
              employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
              activity_type VARCHAR(50) NOT NULL,
              description TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_task_activities_task ON task_activities(task_id)');

        const empCount = await client.query('SELECT COUNT(*) FROM employees');
        if (parseInt(empCount.rows[0].count) === 0) {
          console.log('[Database] PostgreSQL DB empty. Seeding...');
          // Seed PostgreSQL
          const hp = await bcrypt.hash('password123', 10);
          
          // Seed departments
          for (const dept of seedDepartments) {
            await client.query(
              'INSERT INTO departments (name, code, description) VALUES ($1, $2, $3)',
              [dept.name, dept.code, dept.description]
            );
          }
          
          // Seed skills
          for (const skill of seedSkills) {
            await client.query(
              'INSERT INTO skills (name, category) VALUES ($1, $2)',
              [skill.name, skill.category]
            );
          }
          
          // Seed employees
          for (const emp of seedEmployeesData) {
            let deptId = 1;
            if (emp.designation.includes('Designer') || emp.designation.includes('Design')) deptId = 2;
            else if (emp.designation.includes('Product Manager')) deptId = 3;
            else if (emp.designation.includes('HR')) deptId = 4;
            else if (emp.designation.includes('Finance')) deptId = 5;
            
            await client.query(`
              INSERT INTO employees 
              (employee_id, first_name, last_name, email, password, phone, department_id, designation, status, joining_date, role, bio, address)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            `, [emp.employee_id, emp.first_name, emp.last_name, emp.email, hp, emp.phone, deptId, emp.designation, emp.status, emp.joining_date, emp.role, emp.bio, emp.address]);
          }

          // Link managers
          await client.query('UPDATE departments SET manager_id = 1 WHERE id = 1');
          await client.query('UPDATE departments SET manager_id = 3 WHERE id = 2');
          await client.query('UPDATE departments SET manager_id = 7 WHERE id = 3');
          await client.query('UPDATE departments SET manager_id = 5 WHERE id = 4');
          await client.query('UPDATE departments SET manager_id = 11 WHERE id = 5');

          // Seed employee skills
          await client.query("INSERT INTO employee_skills (employee_id, skill_id, proficiency_level) VALUES (1, 13, 'Expert'), (1, 14, 'Expert'), (2, 5, 'Expert'), (2, 7, 'Expert'), (2, 8, 'Expert'), (2, 9, 'Expert'), (3, 11, 'Expert'), (3, 12, 'Expert'), (4, 1, 'Expert'), (4, 2, 'Expert'), (4, 3, 'Intermediate')");
          for (let i = 5; i <= 12; i++) {
            const skillId = (i % 15) + 1;
            await client.query("INSERT INTO employee_skills (employee_id, skill_id, proficiency_level) VALUES ($1, $2, $3)", [i, skillId, i % 3 === 0 ? 'Expert' : 'Intermediate']);
          }

          // Seed documents
          await client.query("INSERT INTO documents (employee_id, name, file_path, file_size, file_type, uploaded_at) VALUES (1, 'offer_letter.pdf', 'uploads/demo_offer.pdf', 154200, 'application/pdf', '2022-01-10'), (1, 'resume.pdf', 'uploads/demo_resume.pdf', 245000, 'application/pdf', '2022-01-10'), (4, 'portfolio.pdf', 'uploads/demo_portfolio.pdf', 489000, 'application/pdf', '2023-06-12')");
          
          // Seed activities
          await client.query(`
            INSERT INTO activities (employee_id, activity_type, description, created_at) VALUES
            (1, 'EMPLOYEE_CREATED', 'Sarah Jenkins joined the company as VP of Engineering.', '2022-01-15'),
            (1, 'STATUS_CHANGE', 'Sarah Jenkins status set to Active.', '2022-01-15'),
            (2, 'EMPLOYEE_CREATED', 'David Chen was hired as Principal Architect.', '2022-04-10'),
            (3, 'EMPLOYEE_CREATED', 'Aisha Rahman joined design division as Lead UI/UX Designer.', '2023-02-01'),
            (4, 'SKILL_ASSIGNED', 'React assigned to Marcus Vance with Expert proficiency.', '2023-06-16'),
            (9, 'EMPLOYEE_CREATED', 'Chloe Tan added to roster on Probation.', '2026-03-15')
          `);

          // Seed leave types
          await client.query("INSERT INTO leave_types (name, code, description, default_days) VALUES ('Casual Leave', 'CL', 'Used for casual personal reasons, vacation, or short breaks.', 12), ('Sick Leave', 'SL', 'Used for medical emergencies, illness, or medical consultations.', 10), ('Earned Leave', 'EL', 'Accrued vacation time based on service duration.', 15), ('Maternity Leave', 'ML', 'Paid maternity leave for female employees.', 90)");

          // Seed leave balances
          const leaveTypesRes = await client.query('SELECT * FROM leave_types');
          const employeesRes = await client.query('SELECT * FROM employees');
          for (const emp of employeesRes.rows) {
            for (const lt of leaveTypesRes.rows) {
              let used = 0;
              if (emp.id === 4) {
                if (lt.code === 'CL') used = 2;
                if (lt.code === 'SL') used = 1;
              }
              if (emp.id === 6 && lt.code === 'EL') {
                used = 4;
              }
              await client.query(
                'INSERT INTO leave_balances (employee_id, leave_type_id, total_days, used_days, remaining_days) VALUES ($1, $2, $3, $4, $5)',
                [emp.id, lt.id, lt.default_days, used, lt.default_days - used]
              );
            }
          }

          // Seed leave requests
          await client.query(`
            INSERT INTO leave_requests (id, employee_id, leave_type_id, start_date, end_date, total_days, reason, status, created_at, updated_at) VALUES
            (1, 4, 1, '2026-05-10', '2026-05-11', 2, 'Family event and short vacation.', 'Approved', '2026-05-01 09:00:00', '2026-05-02 14:30:00'),
            (2, 4, 2, '2026-05-25', '2026-05-25', 1, 'Sudden high fever and dental consultation.', 'Approved', '2026-05-25 07:15:00', '2026-05-25 11:00:00'),
            (3, 4, 1, '2026-06-10', '2026-06-12', 3, 'Attending cousin wedding and travel.', 'Pending', '2026-06-03 10:00:00', '2026-06-03 10:00:00'),
            (4, 9, 3, '2026-06-15', '2026-06-19', 5, 'Annual family road trip.', 'Manager Approved', '2026-06-02 15:20:00', '2026-06-03 11:45:00'),
            (5, 10, 2, '2026-04-12', '2026-04-13', 2, 'Recovery from minor surgery.', 'Rejected', '2026-04-10 08:30:00', '2026-04-11 13:00:00'),
            (6, 6, 3, '2026-06-02', '2026-06-05', 4, 'Personal relocation and home setup.', 'Approved', '2026-05-28 09:10:00', '2026-05-29 16:20:00')
          `);
          
          // Seed leave approvals
          await client.query(`
            INSERT INTO leave_approvals (id, leave_request_id, approver_id, stage, status, remarks, created_at) VALUES
            (1, 1, 2, 'Manager Review', 'Approved', 'Approved. Team schedule allows it.', '2026-05-02 10:00:00'),
            (2, 1, 5, 'HR Review', 'Approved', 'Final HR Approval. Balance verified.', '2026-05-02 14:30:00'),
            (3, 2, 2, 'Manager Review', 'Approved', 'Approved. Take care.', '2026-05-25 09:00:00'),
            (4, 2, 5, 'HR Review', 'Approved', 'Processed. Medical certificate requested if extended.', '2026-05-25 11:00:00'),
            (5, 4, 3, 'Manager Review', 'Approved', 'Recommended. Design schedule looks good.', '2026-06-03 11:45:00'),
            (6, 5, 1, 'Manager Review', 'Rejected', 'Client delivery deadline on these dates. Please reschedule if possible.', '2026-04-11 13:00:00'),
            (7, 6, 1, 'Manager Review', 'Approved', 'Approved.', '2026-05-29 10:00:00'),
            (8, 6, 5, 'HR Review', 'Approved', 'Approved.', '2026-05-29 16:20:00')
          `);
          
          // Fix serial sequence values so inserts don't fail later
          await client.query("SELECT setval('leave_types_id_seq', (SELECT MAX(id) FROM leave_types))");
          await client.query("SELECT setval('leave_requests_id_seq', (SELECT MAX(id) FROM leave_requests))");
          await client.query("SELECT setval('leave_approvals_id_seq', (SELECT MAX(id) FROM leave_approvals))");

          // Seed attendance logs in PostgreSQL
          const seededEmps = await client.query('SELECT * FROM employees');
          const attLogs = generateSeedAttendance(seededEmps.rows);
          for (const log of attLogs) {
            await client.query(`
              INSERT INTO attendance (employee_id, date, check_in, check_out, status, working_hours, remarks, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [log.employee_id, log.date, log.check_in, log.check_out, log.status, log.working_hours, log.remarks, log.created_at]);
          }
          await client.query("SELECT setval('attendance_id_seq', (SELECT MAX(id) FROM attendance))");

          // Seed Tasks
          const seededEmpsTasks = await client.query('SELECT * FROM employees');
          const taskSeeds = generateSeedTasks(seededEmpsTasks.rows);
          for (const task of taskSeeds.tasks) {
            await client.query(`
              INSERT INTO tasks (id, title, description, status, priority, due_date, assignee_id, creator_id, department_id, created_at, updated_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [task.id, task.title, task.description, task.status, task.priority, task.due_date, task.assignee_id, task.creator_id, task.department_id, task.created_at, task.updated_at]);
          }
          for (const comm of taskSeeds.comments) {
            await client.query(`
              INSERT INTO task_comments (id, task_id, author_id, content, created_at)
              VALUES ($1, $2, $3, $4, $5)
            `, [comm.id, comm.task_id, comm.author_id, comm.content, comm.created_at]);
          }
          for (const act of taskSeeds.activities) {
            await client.query(`
              INSERT INTO task_activities (id, task_id, employee_id, activity_type, description, created_at)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [act.id, act.task_id, act.employee_id, act.activity_type, act.description, act.created_at]);
          }
          await client.query("SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks))");
          await client.query("SELECT setval('task_comments_id_seq', (SELECT MAX(id) FROM task_comments))");
          await client.query("SELECT setval('task_activities_id_seq', (SELECT MAX(id) FROM task_activities))");

          console.log('[Database] PostgreSQL database seeded.');
        }
      }
      client.release();
    } catch (err) {
      console.warn('[Database] PostgreSQL connection failed. Using JSON-file database engine instead. Reason:', err instanceof Error ? err.message : err);
      pgConnected = false;
      await initJsonDatabase();
    }
  } else {
    console.log('[Database] PostgreSQL disabled in configurations. Using JSON-file database engine.');
    await initJsonDatabase();
  }
}

async function initJsonDatabase() {
  if (fs.existsSync(jsonDbPath)) {
    try {
      const data = fs.readFileSync(jsonDbPath, 'utf-8');
      jsonDb = JSON.parse(data);
      console.log('[Database] Loaded existing JSON database from database.json');
      
      // Auto-upgrade database schema if attendance key is missing
      if (!jsonDb.attendance || jsonDb.attendance.length === 0) {
        console.log('[Database] Seeding attendance logs to existing JSON database...');
        jsonDb.attendance = generateSeedAttendance(jsonDb.employees);
        saveJsonDb();
      }

      // Auto-upgrade database schema if tasks key is missing
      if (!jsonDb.tasks || jsonDb.tasks.length === 0) {
        console.log('[Database] Seeding tasks logs to existing JSON database...');
        const taskSeeds = generateSeedTasks(jsonDb.employees);
        jsonDb.tasks = taskSeeds.tasks;
        jsonDb.task_comments = taskSeeds.comments;
        jsonDb.task_activities = taskSeeds.activities;
        saveJsonDb();
      }
    } catch (err) {
      console.error('[Database] Error reading database.json, re-initializing.', err);
      await seedJsonDatabase();
    }
  } else {
    await seedJsonDatabase();
  }
}

// Unified Database Provider Interface
export const db = {
  isPostgres() {
    return pgConnected && pool !== null;
  },

  // Generic raw SQL query for components that require direct raw database operations
  async query(text: string, params: any[] = []) {
    if (this.isPostgres() && pool) {
      return pool.query(text, params);
    }
    throw new Error('Raw SQL querying not supported in JSON fallback mode. Use helper CRUD functions.');
  },

  // --- DEPARTMENTS CRUDS ---
  async getDepartments(): Promise<Department[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM departments ORDER BY name ASC');
      return res.rows;
    }
    return [...jsonDb.departments].sort((a, b) => a.name.localeCompare(b.name));
  },

  async getDepartmentById(id: number): Promise<Department | null> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM departments WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return jsonDb.departments.find(d => d.id === id) || null;
  },

  async createDepartment(name: string, code: string, description?: string, manager_id?: number | null): Promise<Department> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(
        'INSERT INTO departments (name, code, description, manager_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [name, code, description, manager_id || null]
      );
      return res.rows[0];
    }
    const newDept: Department = {
      id: jsonDb.departments.length > 0 ? Math.max(...jsonDb.departments.map(d => d.id)) + 1 : 1,
      name,
      code,
      description,
      manager_id: manager_id || null,
      created_at: new Date().toISOString()
    };
    jsonDb.departments.push(newDept);
    saveJsonDb();
    return newDept;
  },

  async updateDepartment(id: number, data: Partial<Department>): Promise<Department | null> {
    if (this.isPostgres() && pool) {
      const fields = Object.keys(data);
      if (fields.length === 0) return this.getDepartmentById(id);
      
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(data)];
      const res = await pool.query(`UPDATE departments SET ${setClause} WHERE id = $1 RETURNING *`, values);
      return res.rows[0] || null;
    }
    const index = jsonDb.departments.findIndex(d => d.id === id);
    if (index === -1) return null;
    
    jsonDb.departments[index] = { ...jsonDb.departments[index], ...data };
    saveJsonDb();
    return jsonDb.departments[index];
  },

  // --- EMPLOYEES CRUDS ---
  async getEmployees(): Promise<Employee[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM employees ORDER BY id DESC');
      return res.rows;
    }
    return [...jsonDb.employees].reverse();
  },

  async getEmployeeById(id: number): Promise<Employee | null> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return jsonDb.employees.find(e => e.id === id) || null;
  },

  async getEmployeeByEmail(email: string): Promise<Employee | null> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM employees WHERE email = $1', [email]);
      return res.rows[0] || null;
    }
    return jsonDb.employees.find(e => e.email.toLowerCase() === email.toLowerCase()) || null;
  },

  async getEmployeeByCode(code: string): Promise<Employee | null> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM employees WHERE employee_id = $1', [code]);
      return res.rows[0] || null;
    }
    return jsonDb.employees.find(e => e.employee_id === code) || null;
  },

  async createEmployee(data: Omit<Employee, 'id'>): Promise<Employee> {
    if (this.isPostgres() && pool) {
      const keys = Object.keys(data);
      const columns = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = Object.values(data);
      
      const res = await pool.query(`INSERT INTO employees (${columns}) VALUES (${placeholders}) RETURNING *`, values);
      return res.rows[0];
    }
    const newEmp: Employee = {
      id: jsonDb.employees.length > 0 ? Math.max(...jsonDb.employees.map(e => e.id)) + 1 : 1,
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    jsonDb.employees.push(newEmp);
    saveJsonDb();
    return newEmp;
  },

  async updateEmployee(id: number, data: Partial<Employee>): Promise<Employee | null> {
    if (this.isPostgres() && pool) {
      const fields = Object.keys(data);
      if (fields.length === 0) return this.getEmployeeById(id);
      
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(data)];
      const res = await pool.query(`UPDATE employees SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`, values);
      return res.rows[0] || null;
    }
    const index = jsonDb.employees.findIndex(e => e.id === id);
    if (index === -1) return null;
    
    jsonDb.employees[index] = { 
      ...jsonDb.employees[index], 
      ...data, 
      updated_at: new Date().toISOString() 
    };
    saveJsonDb();
    return jsonDb.employees[index];
  },

  async deleteEmployee(id: number): Promise<boolean> {
    if (this.isPostgres() && pool) {
      // Set managers to null before deleting
      await pool.query('UPDATE departments SET manager_id = NULL WHERE manager_id = $1', [id]);
      const res = await pool.query('DELETE FROM employees WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const index = jsonDb.employees.findIndex(e => e.id === id);
    if (index === -1) return false;
    
    // Clear manager_id referencing this employee
    jsonDb.departments.forEach(dept => {
      if (dept.manager_id === id) dept.manager_id = null;
    });
    
    // Cascading deletes in json database
    jsonDb.employee_skills = jsonDb.employee_skills.filter(es => es.employee_id !== id);
    jsonDb.documents = jsonDb.documents.filter(doc => doc.employee_id !== id);
    jsonDb.activities = jsonDb.activities.filter(act => act.employee_id !== id);
    
    jsonDb.employees.splice(index, 1);
    saveJsonDb();
    return true;
  },

  // --- SKILLS CRUDS ---
  async getSkills(): Promise<Skill[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM skills ORDER BY name ASC');
      return res.rows;
    }
    return [...jsonDb.skills].sort((a, b) => a.name.localeCompare(b.name));
  },

  async createSkill(name: string, category: string): Promise<Skill> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('INSERT INTO skills (name, category) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET category = $2 RETURNING *', [name, category]);
      return res.rows[0];
    }
    const existing = jsonDb.skills.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.category = category;
      saveJsonDb();
      return existing;
    }
    const newSkill: Skill = {
      id: jsonDb.skills.length > 0 ? Math.max(...jsonDb.skills.map(s => s.id)) + 1 : 1,
      name,
      category
    };
    jsonDb.skills.push(newSkill);
    saveJsonDb();
    return newSkill;
  },

  // --- EMPLOYEE SKILLS JUNCTION ---
  async getEmployeeSkills(employeeId: number) {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        SELECT s.id, s.name, s.category, es.proficiency_level 
        FROM employee_skills es
        JOIN skills s ON es.skill_id = s.id
        WHERE es.employee_id = $1
      `, [employeeId]);
      return res.rows;
    }
    return jsonDb.employee_skills
      .filter(es => es.employee_id === employeeId)
      .map(es => {
        const skill = jsonDb.skills.find(s => s.id === es.skill_id);
        return {
          id: es.skill_id,
          name: skill?.name || 'Unknown',
          category: skill?.category || 'Unknown',
          proficiency_level: es.proficiency_level
        };
      });
  },

  async assignSkill(employeeId: number, skillId: number, proficiencyLevel: 'Beginner' | 'Intermediate' | 'Expert'): Promise<void> {
    if (this.isPostgres() && pool) {
      await pool.query(`
        INSERT INTO employee_skills (employee_id, skill_id, proficiency_level)
        VALUES ($1, $2, $3)
        ON CONFLICT (employee_id, skill_id) DO UPDATE SET proficiency_level = $3
      `, [employeeId, skillId, proficiencyLevel]);
      return;
    }
    const index = jsonDb.employee_skills.findIndex(es => es.employee_id === employeeId && es.skill_id === skillId);
    if (index > -1) {
      jsonDb.employee_skills[index].proficiency_level = proficiencyLevel;
    } else {
      jsonDb.employee_skills.push({ employee_id: employeeId, skill_id: skillId, proficiency_level: proficiencyLevel });
    }
    saveJsonDb();
  },

  async removeSkill(employeeId: number, skillId: number): Promise<void> {
    if (this.isPostgres() && pool) {
      await pool.query('DELETE FROM employee_skills WHERE employee_id = $1 AND skill_id = $2', [employeeId, skillId]);
      return;
    }
    jsonDb.employee_skills = jsonDb.employee_skills.filter(es => !(es.employee_id === employeeId && es.skill_id === skillId));
    saveJsonDb();
  },

  // --- DOCUMENTS CRUDS ---
  async getEmployeeDocuments(employeeId: number): Promise<Document[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM documents WHERE employee_id = $1 ORDER BY id DESC', [employeeId]);
      return res.rows;
    }
    return jsonDb.documents.filter(d => d.employee_id === employeeId).reverse();
  },

  async getDocumentById(id: number): Promise<Document | null> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      return res.rows[0] || null;
    }
    return jsonDb.documents.find(d => d.id === id) || null;
  },

  async createDocument(employeeId: number, name: string, filePath: string, fileSize: number, fileType: string): Promise<Document> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(
        'INSERT INTO documents (employee_id, name, file_path, file_size, file_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [employeeId, name, filePath, fileSize, fileType]
      );
      return res.rows[0];
    }
    const newDoc: Document = {
      id: jsonDb.documents.length > 0 ? Math.max(...jsonDb.documents.map(d => d.id)) + 1 : 1,
      employee_id: employeeId,
      name,
      file_path: filePath,
      file_size: fileSize,
      file_type: fileType,
      uploaded_at: new Date().toISOString()
    };
    jsonDb.documents.push(newDoc);
    saveJsonDb();
    return newDoc;
  },

  async deleteDocument(id: number): Promise<boolean> {
    const doc = await this.getDocumentById(id);
    if (!doc) return false;
    
    // Attempt physical deletion of file
    try {
      const fullPath = path.resolve(__dirname, '../../', doc.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (e) {
      console.warn('[Database] Physical document file could not be deleted:', e);
    }

    if (this.isPostgres() && pool) {
      const res = await pool.query('DELETE FROM documents WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const index = jsonDb.documents.findIndex(d => d.id === id);
    if (index === -1) return false;
    jsonDb.documents.splice(index, 1);
    saveJsonDb();
    return true;
  },

  // --- ACTIVITIES CRUDS ---
  async getActivities(limit: number = 50): Promise<Activity[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM activities ORDER BY id DESC LIMIT $1', [limit]);
      return res.rows;
    }
    return [...jsonDb.activities].reverse().slice(0, limit);
  },

  async getEmployeeActivities(employeeId: number): Promise<Activity[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM activities WHERE employee_id = $1 ORDER BY id DESC', [employeeId]);
      return res.rows;
    }
    return jsonDb.activities.filter(a => a.employee_id === employeeId).reverse();
  },

  async logActivity(employeeId: number | null, activityType: string, description: string): Promise<Activity> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(
        'INSERT INTO activities (employee_id, activity_type, description) VALUES ($1, $2, $3) RETURNING *',
        [employeeId, activityType, description]
      );
      return res.rows[0];
    }
    const newAct: Activity = {
      id: jsonDb.activities.length > 0 ? Math.max(...jsonDb.activities.map(a => a.id)) + 1 : 1,
      employee_id: employeeId,
      activity_type: activityType,
      description,
      created_at: new Date().toISOString()
    };
    jsonDb.activities.push(newAct);
    saveJsonDb();
    return newAct;
  },

  // --- LEAVE MANAGEMENT METHODS ---
  async getLeaveTypes(): Promise<LeaveType[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM leave_types ORDER BY id ASC');
      return res.rows;
    }
    return jsonDb.leave_types;
  },

  async getLeaveBalances(employeeId: number): Promise<LeaveBalance[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        SELECT lb.*, row_to_json(lt) as leave_type
        FROM leave_balances lb
        JOIN leave_types lt ON lb.leave_type_id = lt.id
        WHERE lb.employee_id = $1
      `, [employeeId]);
      return res.rows;
    }
    return jsonDb.leave_balances
      .filter(lb => lb.employee_id === employeeId)
      .map(lb => ({
        ...lb,
        leave_type: jsonDb.leave_types.find(lt => lt.id === lb.leave_type_id)
      }));
  },

  async getLeaveRequests(filters: { status?: string; departmentId?: number; employeeId?: number } = {}): Promise<LeaveRequest[]> {
    if (this.isPostgres() && pool) {
      let queryText = `
        SELECT lr.*, 
               json_build_object(
                 'id', e.id, 
                 'employee_id', e.employee_id, 
                 'first_name', e.first_name, 
                 'last_name', e.last_name, 
                 'email', e.email, 
                 'designation', e.designation,
                 'avatar_url', e.avatar_url,
                 'role', e.role,
                 'status', e.status,
                 'joining_date', e.joining_date,
                 'department_id', e.department_id
               ) as employee,
               row_to_json(lt) as leave_type
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let index = 1;

      if (filters.status) {
        queryText += ` AND lr.status = $${index++}`;
        params.push(filters.status);
      }
      if (filters.departmentId) {
        queryText += ` AND e.department_id = $${index++}`;
        params.push(filters.departmentId);
      }
      if (filters.employeeId) {
        queryText += ` AND lr.employee_id = $${index++}`;
        params.push(filters.employeeId);
      }

      queryText += ` ORDER BY lr.id DESC`;
      const res = await pool.query(queryText, params);
      
      for (const row of res.rows) {
        const approvalsRes = await pool.query(`
          SELECT la.*, 
                 json_build_object(
                   'id', app.id,
                   'first_name', app.first_name,
                   'last_name', app.last_name,
                   'role', app.role,
                   'designation', app.designation
                 ) as approver
          FROM leave_approvals la
          LEFT JOIN employees app ON la.approver_id = app.id
          WHERE la.leave_request_id = $1
          ORDER BY la.id ASC
        `, [row.id]);
        row.approvals = approvalsRes.rows;
      }
      
      return res.rows;
    }

    let list = [...jsonDb.leave_requests];

    if (filters.status) {
      list = list.filter(r => r.status === filters.status);
    }
    if (filters.employeeId) {
      list = list.filter(r => r.employee_id === filters.employeeId);
    }
    if (filters.departmentId) {
      list = list.filter(r => {
        const emp = jsonDb.employees.find(e => e.id === r.employee_id);
        return emp?.department_id === filters.departmentId;
      });
    }

    list.sort((a, b) => b.id - a.id);

    return list.map(r => {
      const emp = jsonDb.employees.find(e => e.id === r.employee_id);
      const lt = jsonDb.leave_types.find(t => t.id === r.leave_type_id);
      
      const approvals = jsonDb.leave_approvals
        .filter(la => la.leave_request_id === r.id)
        .map(la => {
          const approver = jsonDb.employees.find(e => e.id === la.approver_id);
          return {
            ...la,
            approver: approver ? {
              id: approver.id,
              first_name: approver.first_name,
              last_name: approver.last_name,
              role: approver.role,
              designation: approver.designation
            } : null
          };
        })
        .sort((a, b) => a.id - b.id);

      return {
        ...r,
        employee: emp ? (() => {
          const { password, ...rest } = emp;
          return rest;
        })() : undefined,
        leave_type: lt,
        approvals
      };
    });
  },

  async getLeaveRequestById(id: number): Promise<LeaveRequest | null> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        SELECT lr.*, 
               json_build_object(
                 'id', e.id, 
                 'employee_id', e.employee_id, 
                 'first_name', e.first_name, 
                 'last_name', e.last_name, 
                 'email', e.email, 
                 'designation', e.designation,
                 'avatar_url', e.avatar_url,
                 'role', e.role,
                 'status', e.status,
                 'joining_date', e.joining_date,
                 'department_id', e.department_id
               ) as employee,
               row_to_json(lt) as leave_type
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.id = $1
      `, [id]);
      
      const row = res.rows[0] || null;
      if (!row) return null;

      const approvalsRes = await pool.query(`
        SELECT la.*, 
               json_build_object(
                 'id', app.id,
                 'first_name', app.first_name,
                 'last_name', app.last_name,
                 'role', app.role,
                 'designation', app.designation
               ) as approver
        FROM leave_approvals la
        LEFT JOIN employees app ON la.approver_id = app.id
        WHERE la.leave_request_id = $1
        ORDER BY la.id ASC
      `, [id]);
      row.approvals = approvalsRes.rows;

      return row;
    }

    const r = jsonDb.leave_requests.find(req => req.id === id);
    if (!r) return null;

    const emp = jsonDb.employees.find(e => e.id === r.employee_id);
    const lt = jsonDb.leave_types.find(t => t.id === r.leave_type_id);
    
    const approvals = jsonDb.leave_approvals
      .filter(la => la.leave_request_id === r.id)
      .map(la => {
        const approver = jsonDb.employees.find(e => e.id === la.approver_id);
        return {
          ...la,
          approver: approver ? {
            id: approver.id,
            first_name: approver.first_name,
            last_name: approver.last_name,
            role: approver.role,
            designation: approver.designation
          } : null
        };
      })
      .sort((a, b) => a.id - b.id);

    return {
      ...r,
      employee: emp ? (() => {
        const { password, ...rest } = emp;
        return rest;
      })() : undefined,
      leave_type: lt,
      approvals
    };
  },

  async applyLeave(data: {
    employee_id: number;
    leave_type_id: number;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string;
    attachment_path?: string | null;
  }): Promise<LeaveRequest> {
    if (this.isPostgres() && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const balanceRes = await client.query(
          'SELECT remaining_days FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 FOR UPDATE',
          [data.employee_id, data.leave_type_id]
        );

        if (balanceRes.rows.length === 0) {
          throw new Error('No leave balance record found for this leave type.');
        }

        const remaining = balanceRes.rows[0].remaining_days;
        if (remaining < data.total_days) {
          throw new Error(`Insufficient leave balance. Requested: ${data.total_days}, Available: ${remaining}`);
        }

        const insertRes = await client.query(`
          INSERT INTO leave_requests 
          (employee_id, leave_type_id, start_date, end_date, total_days, reason, status, attachment_path, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7, NOW(), NOW())
          RETURNING *
        `, [
          data.employee_id,
          data.leave_type_id,
          data.start_date,
          data.end_date,
          data.total_days,
          data.reason,
          data.attachment_path || null
        ]);

        const newRequest = insertRes.rows[0];

        const empRes = await client.query('SELECT first_name, last_name FROM employees WHERE id = $1', [data.employee_id]);
        const empName = empRes.rows.length > 0 ? `${empRes.rows[0].first_name} ${empRes.rows[0].last_name}` : 'Employee';
        const typeRes = await client.query('SELECT name FROM leave_types WHERE id = $1', [data.leave_type_id]);
        const typeName = typeRes.rows.length > 0 ? typeRes.rows[0].name : 'Leave';

        await client.query(
          'INSERT INTO activities (employee_id, activity_type, description, created_at) VALUES ($1, $2, $3, NOW())',
          [data.employee_id, 'LEAVE_APPLIED', `${empName} applied for ${data.total_days} day(s) of ${typeName}.`]
        );

        await client.query('COMMIT');
        client.release();
        
        return (await this.getLeaveRequestById(newRequest.id))!;
      } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        throw err;
      }
    }

    const backup = JSON.stringify(jsonDb);
    try {
      const balance = jsonDb.leave_balances.find(
        lb => lb.employee_id === data.employee_id && lb.leave_type_id === data.leave_type_id
      );

      if (!balance) {
        throw new Error('No leave balance record found for this leave type.');
      }

      if (balance.remaining_days < data.total_days) {
        throw new Error(`Insufficient leave balance. Requested: ${data.total_days}, Available: ${balance.remaining_days}`);
      }

      const newId = jsonDb.leave_requests.length > 0 ? Math.max(...jsonDb.leave_requests.map(r => r.id)) + 1 : 1;
      const newRequest: LeaveRequest = {
        id: newId,
        employee_id: data.employee_id,
        leave_type_id: data.leave_type_id,
        start_date: data.start_date,
        end_date: data.end_date,
        total_days: data.total_days,
        reason: data.reason,
        status: 'Pending',
        attachment_path: data.attachment_path || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      jsonDb.leave_requests.push(newRequest);

      const emp = jsonDb.employees.find(e => e.id === data.employee_id);
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
      const lt = jsonDb.leave_types.find(t => t.id === data.leave_type_id);
      const typeName = lt ? lt.name : 'Leave';

      jsonDb.activities.push({
        id: jsonDb.activities.length > 0 ? Math.max(...jsonDb.activities.map(a => a.id)) + 1 : 1,
        employee_id: data.employee_id,
        activity_type: 'LEAVE_APPLIED',
        description: `${empName} applied for ${data.total_days} day(s) of ${typeName}.`,
        created_at: new Date().toISOString()
      });

      saveJsonDb();
      return (await this.getLeaveRequestById(newId))!;
    } catch (err) {
      jsonDb = JSON.parse(backup);
      throw err;
    }
  },

  async approveLeaveWorkflow(
    requestId: number,
    approverId: number,
    stage: 'Manager Review' | 'HR Review',
    status: 'Approved' | 'Rejected',
    remarks?: string
  ): Promise<LeaveRequest> {
    if (this.isPostgres() && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const reqRes = await client.query(
          'SELECT * FROM leave_requests WHERE id = $1 FOR UPDATE',
          [requestId]
        );

        if (reqRes.rows.length === 0) {
          throw new Error('Leave request not found.');
        }

        const request = reqRes.rows[0];

        if (['Approved', 'Rejected', 'Cancelled'].includes(request.status)) {
          throw new Error(`Cannot approve a leave request that is already ${request.status}.`);
        }

        if (stage === 'Manager Review' && !['Pending', 'Under Review'].includes(request.status)) {
          throw new Error(`Invalid stage transition. Request is currently ${request.status}.`);
        }

        if (stage === 'HR Review' && request.status !== 'Manager Approved') {
          throw new Error(`HR Approval requires Manager Approval first. Current status: ${request.status}.`);
        }

        await client.query(`
          INSERT INTO leave_approvals (leave_request_id, approver_id, stage, status, remarks, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [requestId, approverId, stage, status, remarks || null]);

        const empRes = await client.query('SELECT first_name, last_name FROM employees WHERE id = $1', [request.employee_id]);
        const empName = empRes.rows.length > 0 ? `${empRes.rows[0].first_name} ${empRes.rows[0].last_name}` : 'Employee';
        
        const appRes = await client.query('SELECT first_name, last_name, role FROM employees WHERE id = $1', [approverId]);
        const approverName = appRes.rows.length > 0 ? `${appRes.rows[0].first_name} ${appRes.rows[0].last_name}` : 'Approver';

        let nextStatus = request.status;

        if (status === 'Rejected') {
          nextStatus = 'Rejected';
          await client.query(
            'INSERT INTO activities (employee_id, activity_type, description, created_at) VALUES ($1, $2, $3, NOW())',
            [request.employee_id, 'LEAVE_REJECTED', `Leave request for ${empName} was rejected by ${approverName} during ${stage}.`]
          );
        } else {
          if (stage === 'Manager Review') {
            nextStatus = 'Manager Approved';
            await client.query(
              'INSERT INTO activities (employee_id, activity_type, description, created_at) VALUES ($1, $2, $3, NOW())',
              [request.employee_id, 'LEAVE_APPROVED', `Leave request for ${empName} was approved by manager ${approverName}.`]
            );
          } else if (stage === 'HR Review') {
            nextStatus = 'Approved';

            const balanceRes = await client.query(
              'SELECT remaining_days, used_days FROM leave_balances WHERE employee_id = $1 AND leave_type_id = $2 FOR UPDATE',
              [request.employee_id, request.leave_type_id]
            );

            if (balanceRes.rows.length === 0) {
              throw new Error('No leave balance record found for this employee.');
            }

            const currentBalance = balanceRes.rows[0];
            if (currentBalance.remaining_days < request.total_days) {
              throw new Error(`Insufficient leave balance. Remaining: ${currentBalance.remaining_days}, Requested: ${request.total_days}`);
            }

            await client.query(`
              UPDATE leave_balances 
              SET used_days = used_days + $1, remaining_days = remaining_days - $1
              WHERE employee_id = $2 AND leave_type_id = $3
            `, [request.total_days, request.employee_id, request.leave_type_id]);

            await client.query(
              'INSERT INTO activities (employee_id, activity_type, description, created_at) VALUES ($1, $2, $3, NOW())',
              [request.employee_id, 'LEAVE_FINAL_APPROVED', `Leave request for ${empName} was finally approved by HR ${approverName}. Quota deducted by ${request.total_days} day(s).`]
            );
          }
        }

        await client.query(`
          UPDATE leave_requests 
          SET status = $1, updated_at = NOW() 
          WHERE id = $2
        `, [nextStatus, requestId]);

        await client.query('COMMIT');
        client.release();

        return (await this.getLeaveRequestById(requestId))!;
      } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        throw err;
      }
    }

    const backup = JSON.stringify(jsonDb);
    try {
      const requestIndex = jsonDb.leave_requests.findIndex(r => r.id === requestId);
      if (requestIndex === -1) {
        throw new Error('Leave request not found.');
      }

      const request = jsonDb.leave_requests[requestIndex];

      if (['Approved', 'Rejected', 'Cancelled'].includes(request.status)) {
        throw new Error(`Cannot approve a leave request that is already ${request.status}.`);
      }

      if (stage === 'Manager Review' && !['Pending', 'Under Review'].includes(request.status)) {
        throw new Error(`Invalid stage transition. Request is currently ${request.status}.`);
      }

      if (stage === 'HR Review' && request.status !== 'Manager Approved') {
        throw new Error(`HR Approval requires Manager Approval first. Current status: ${request.status}.`);
      }

      const approvalId = jsonDb.leave_approvals.length > 0 ? Math.max(...jsonDb.leave_approvals.map(la => la.id)) + 1 : 1;
      jsonDb.leave_approvals.push({
        id: approvalId,
        leave_request_id: requestId,
        approver_id: approverId,
        stage,
        status,
        remarks,
        created_at: new Date().toISOString()
      });

      const emp = jsonDb.employees.find(e => e.id === request.employee_id);
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';
      const app = jsonDb.employees.find(e => e.id === approverId);
      const approverName = app ? `${app.first_name} ${app.last_name}` : 'Approver';

      let nextStatus = request.status;

      if (status === 'Rejected') {
        nextStatus = 'Rejected';
        jsonDb.activities.push({
          id: jsonDb.activities.length > 0 ? Math.max(...jsonDb.activities.map(a => a.id)) + 1 : 1,
          employee_id: request.employee_id,
          activity_type: 'LEAVE_REJECTED',
          description: `Leave request for ${empName} was rejected by ${approverName} during ${stage}.`,
          created_at: new Date().toISOString()
        });
      } else {
        if (stage === 'Manager Review') {
          nextStatus = 'Manager Approved';
          jsonDb.activities.push({
            id: jsonDb.activities.length > 0 ? Math.max(...jsonDb.activities.map(a => a.id)) + 1 : 1,
            employee_id: request.employee_id,
            activity_type: 'LEAVE_APPROVED',
            description: `Leave request for ${empName} was approved by manager ${approverName}.`,
            created_at: new Date().toISOString()
          });
        } else if (stage === 'HR Review') {
          nextStatus = 'Approved';

          const balance = jsonDb.leave_balances.find(
            lb => lb.employee_id === request.employee_id && lb.leave_type_id === request.leave_type_id
          );

          if (!balance) {
            throw new Error('No leave balance record found for this employee.');
          }

          if (balance.remaining_days < request.total_days) {
            throw new Error(`Insufficient leave balance. Remaining: ${balance.remaining_days}, Requested: ${request.total_days}`);
          }

          balance.used_days += request.total_days;
          balance.remaining_days -= request.total_days;

          jsonDb.activities.push({
            id: jsonDb.activities.length > 0 ? Math.max(...jsonDb.activities.map(a => a.id)) + 1 : 1,
            employee_id: request.employee_id,
            activity_type: 'LEAVE_FINAL_APPROVED',
            description: `Leave request for ${empName} was finally approved by HR ${approverName}. Quota deducted by ${request.total_days} day(s).`,
            created_at: new Date().toISOString()
          });
        }
      }

      jsonDb.leave_requests[requestIndex].status = nextStatus;
      jsonDb.leave_requests[requestIndex].updated_at = new Date().toISOString();

      saveJsonDb();
      return (await this.getLeaveRequestById(requestId))!;
    } catch (err) {
      jsonDb = JSON.parse(backup);
      throw err;
    }
  },

  async cancelLeave(requestId: number, employeeId: number): Promise<LeaveRequest> {
    if (this.isPostgres() && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const reqRes = await client.query(
          'SELECT * FROM leave_requests WHERE id = $1 AND employee_id = $2 FOR UPDATE',
          [requestId, employeeId]
        );

        if (reqRes.rows.length === 0) {
          throw new Error('Leave request not found or not owned by you.');
        }

        const request = reqRes.rows[0];
        if (!['Pending', 'Manager Approved', 'Under Review'].includes(request.status)) {
          throw new Error(`Cannot cancel a leave request in ${request.status} status.`);
        }

        await client.query(
          "UPDATE leave_requests SET status = 'Cancelled', updated_at = NOW() WHERE id = $1",
          [requestId]
        );

        const empRes = await client.query('SELECT first_name, last_name FROM employees WHERE id = $1', [employeeId]);
        const empName = empRes.rows.length > 0 ? `${empRes.rows[0].first_name} ${empRes.rows[0].last_name}` : 'Employee';

        await client.query(
          'INSERT INTO activities (employee_id, activity_type, description, created_at) VALUES ($1, $2, $3, NOW())',
          [employeeId, 'LEAVE_CANCELLED', `${empName} cancelled their leave request.`]
        );

        await client.query('COMMIT');
        client.release();

        return (await this.getLeaveRequestById(requestId))!;
      } catch (err) {
        await client.query('ROLLBACK');
        client.release();
        throw err;
      }
    }

    const backup = JSON.stringify(jsonDb);
    try {
      const requestIndex = jsonDb.leave_requests.findIndex(
        r => r.id === requestId && r.employee_id === employeeId
      );

      if (requestIndex === -1) {
        throw new Error('Leave request not found or not owned by you.');
      }

      const request = jsonDb.leave_requests[requestIndex];
      if (!['Pending', 'Manager Approved', 'Under Review'].includes(request.status)) {
        throw new Error(`Cannot cancel a leave request in ${request.status} status.`);
      }

      jsonDb.leave_requests[requestIndex].status = 'Cancelled';
      jsonDb.leave_requests[requestIndex].updated_at = new Date().toISOString();

      const emp = jsonDb.employees.find(e => e.id === employeeId);
      const empName = emp ? `${emp.first_name} ${emp.last_name}` : 'Employee';

      jsonDb.activities.push({
        id: jsonDb.activities.length > 0 ? Math.max(...jsonDb.activities.map(a => a.id)) + 1 : 1,
        employee_id: employeeId,
        activity_type: 'LEAVE_CANCELLED',
        description: `${empName} cancelled their leave request.`,
        created_at: new Date().toISOString()
      });

      saveJsonDb();
      return (await this.getLeaveRequestById(requestId))!;
    } catch (err) {
      jsonDb = JSON.parse(backup);
      throw err;
    }
  },

  async getLeaveAnalytics(filters: { departmentId?: number; employeeId?: number } = {}): Promise<LeaveDashboardData> {
    const allRequests = await this.getLeaveRequests(filters);
    const allEmployees = await this.getEmployees();
    const allDepartments = await this.getDepartments();

    const todayStr = getLocalDateStr();

    const summary = {
      total: allRequests.length,
      pending: allRequests.filter(r => ['Pending', 'Under Review', 'Manager Approved'].includes(r.status)).length,
      approved: allRequests.filter(r => r.status === 'Approved').length,
      rejected: allRequests.filter(r => r.status === 'Rejected').length,
      on_leave_today: 0
    };

    const activeLeaves = allRequests.filter(r => {
      if (r.status !== 'Approved') return false;
      const start = r.start_date.split('T')[0];
      const end = r.end_date.split('T')[0];
      return todayStr >= start && todayStr <= end;
    });
    
    summary.on_leave_today = activeLeaves.length;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const last6Months: { name: string; year: number; monthIdx: number; Requested: number; Approved: number }[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      last6Months.push({
        name: `${months[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`,
        year: d.getFullYear(),
        monthIdx: d.getMonth(),
        Requested: 0,
        Approved: 0
      });
    }

    allRequests.forEach(r => {
      if (!r.created_at) return;
      const cDate = new Date(r.created_at);
      const rYear = cDate.getFullYear();
      const rMonth = cDate.getMonth();

      const mBucket = last6Months.find(m => m.year === rYear && m.monthIdx === rMonth);
      if (mBucket) {
        mBucket.Requested++;
        if (r.status === 'Approved') {
          mBucket.Approved++;
        }
      }
    });

    const monthlyTrends = last6Months.map(m => ({
      name: m.name,
      Requested: m.Requested,
      Approved: m.Approved
    }));

    const deptLeavesMap: { [deptName: string]: number } = {};
    allDepartments.forEach(d => {
      deptLeavesMap[d.name] = 0;
    });

    allRequests.forEach(r => {
      const emp = r.employee;
      if (emp && emp.department_id) {
        const dept = allDepartments.find(d => d.id === emp.department_id);
        if (dept) {
          deptLeavesMap[dept.name] = (deptLeavesMap[dept.name] || 0) + 1;
        }
      }
    });

    const deptLeaves = Object.keys(deptLeavesMap).map(name => ({
      name,
      value: deptLeavesMap[name]
    })).filter(item => item.value > 0);

    const typeDistributionMap: { [typeName: string]: number } = {};
    allRequests.forEach(r => {
      if (r.leave_type) {
        typeDistributionMap[r.leave_type.name] = (typeDistributionMap[r.leave_type.name] || 0) + 1;
      }
    });

    const typeDistribution = Object.keys(typeDistributionMap).map(name => ({
      name,
      value: typeDistributionMap[name]
    }));

    const deptUtilizationMap: { [deptName: string]: { used: number; total: number } } = {};
    allDepartments.forEach(d => {
      deptUtilizationMap[d.name] = { used: 0, total: 0 };
    });

    let balances: LeaveBalance[] = [];
    if (this.isPostgres() && pool) {
      const res = await pool.query('SELECT * FROM leave_balances');
      balances = res.rows;
    } else {
      balances = jsonDb.leave_balances;
    }

    balances.forEach(b => {
      const emp = allEmployees.find(e => e.id === b.employee_id);
      if (emp && emp.department_id) {
        const dept = allDepartments.find(d => d.id === emp.department_id);
        if (dept) {
          deptUtilizationMap[dept.name].used += b.used_days;
          deptUtilizationMap[dept.name].total += b.total_days;
        }
      }
    });

    const utilization = Object.keys(deptUtilizationMap).map(name => {
      const { used, total } = deptUtilizationMap[name];
      const pct = total > 0 ? Math.round((used / total) * 100) : 0;
      return {
        name,
        value: pct
      };
    }).filter(item => item.value > 0);

    return {
      summary,
      monthlyTrends,
      deptLeaves,
      typeDistribution,
      utilization
    };
  },

  async getLeaveCalendar(filters: { departmentId?: number } = {}): Promise<any[]> {
    const allRequests = await this.getLeaveRequests();
    
    let filtered = allRequests.filter(r => ['Approved', 'Pending', 'Under Review', 'Manager Approved', 'HR Approved'].includes(r.status));

    if (filters.departmentId) {
      filtered = filtered.filter(r => r.employee?.department_id === filters.departmentId);
    }

    return filtered.map(r => ({
      id: r.id,
      title: `${r.employee ? r.employee.first_name + ' ' + r.employee.last_name : 'Employee'} - ${r.leave_type?.name || 'Leave'}`,
      start: r.start_date,
      end: r.end_date,
      allDay: true,
      color: r.status === 'Approved' ? '#16A34A' : '#D97706',
      extendedProps: {
        status: r.status,
        reason: r.reason,
        employeeName: r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : 'Unknown',
        leaveType: r.leave_type?.name || 'Unknown',
        totalDays: r.total_days
      }
    }));
  },

  async getLeaveReports(filters: { departmentId?: number; employeeId?: number; startDate?: string; endDate?: string; leaveTypeId?: number } = {}): Promise<any[]> {
    const allRequests = await this.getLeaveRequests();
    const departments = await this.getDepartments();
    let filtered = [...allRequests];

    if (filters.employeeId) {
      filtered = filtered.filter(r => r.employee_id === filters.employeeId);
    }
    if (filters.leaveTypeId) {
      filtered = filtered.filter(r => r.leave_type_id === filters.leaveTypeId);
    }
    if (filters.departmentId) {
      filtered = filtered.filter(r => r.employee?.department_id === filters.departmentId);
    }
    if (filters.startDate) {
      filtered = filtered.filter(r => r.start_date >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(r => r.end_date <= filters.endDate!);
    }

    return filtered.map(r => {
      const dept = departments.find(d => d.id === r.employee?.department_id);
      return {
        id: r.id,
        employeeName: r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : 'Unknown',
        employeeId: r.employee?.employee_id || 'Unknown',
        department: dept ? dept.name : 'Unknown',
        leaveType: r.leave_type?.name || 'Unknown',
        startDate: r.start_date,
        endDate: r.end_date,
        totalDays: r.total_days,
        reason: r.reason,
        status: r.status,
        appliedOn: r.created_at?.split('T')[0] || 'Unknown'
      };
    });
  },

  // --- ATTENDANCE METHODS ---
  async getAttendanceToday(employeeId: number): Promise<Attendance | null> {
    const todayStr = getLocalDateStr();
    
    // First try: exact match on todayStr
    let record: Attendance | null = null;
    if (this.isPostgres() && pool) {
      const res = await pool.query(
        'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
        [employeeId, todayStr]
      );
      record = res.rows[0] || null;
    } else {
      record = jsonDb.attendance.find(a => a.employee_id === employeeId && a.date === todayStr) || null;
    }

    if (record) {
      return record;
    }

    // Fallback: active shift with no check_out created in the last 18 hours
    if (this.isPostgres() && pool) {
      const res = await pool.query(
        'SELECT * FROM attendance WHERE employee_id = $1 AND check_out IS NULL ORDER BY date DESC, check_in DESC LIMIT 1',
        [employeeId]
      );
      record = res.rows[0] || null;
    } else {
      const activeLogs = jsonDb.attendance.filter(a => a.employee_id === employeeId && !a.check_out);
      if (activeLogs.length > 0) {
        activeLogs.sort((a, b) => b.date.localeCompare(a.date));
        record = activeLogs[0];
      }
    }

    if (record && record.check_in) {
      const now = new Date();
      const checkInTime = new Date(record.check_in);
      const diffHours = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      if (diffHours < 18) {
        return record;
      }
    }

    return null;
  },

  async checkIn(employeeId: number, status: AttendanceStatus, remarks?: string): Promise<Attendance> {
    const existing = await this.getAttendanceToday(employeeId);
    if (existing) {
      throw new Error('Already checked in for today.');
    }

    const todayStr = getLocalDateStr();
    const nowStr = new Date().toISOString();
    
    if (this.isPostgres() && pool) {
      const res = await pool.query(
        `INSERT INTO attendance (employee_id, date, check_in, status, remarks)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [employeeId, todayStr, nowStr, status, remarks || null]
      );
      return res.rows[0];
    }

    const newId = jsonDb.attendance.length > 0 ? Math.max(...jsonDb.attendance.map(a => a.id)) + 1 : 1;
    const record: Attendance = {
      id: newId,
      employee_id: employeeId,
      date: todayStr,
      check_in: nowStr,
      check_out: null,
      status,
      working_hours: null,
      remarks: remarks || null,
      created_at: nowStr
    };
    jsonDb.attendance.push(record);
    saveJsonDb();
    return record;
  },

  async checkOut(employeeId: number): Promise<Attendance> {
    const record = await this.getAttendanceToday(employeeId);
    if (!record) {
      throw new Error('No check-in record found for today. Please check in first.');
    }
    if (record.check_out) {
      throw new Error('Already checked out for today.');
    }

    const nowStr = new Date().toISOString();
    const checkInTime = new Date(record.check_in!);
    const checkOutTime = new Date(nowStr);
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    const workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    if (this.isPostgres() && pool) {
      const res = await pool.query(
        `UPDATE attendance
         SET check_out = $1, working_hours = $2
         WHERE employee_id = $3 AND date = $4
         RETURNING *`,
        [nowStr, workingHours, employeeId, record.date]
      );
      return res.rows[0];
    }

    const idx = jsonDb.attendance.findIndex(a => a.id === record.id);
    if (idx !== -1) {
      jsonDb.attendance[idx].check_out = nowStr;
      jsonDb.attendance[idx].working_hours = workingHours;
      saveJsonDb();
      return jsonDb.attendance[idx];
    }
    throw new Error('Failed to update attendance record.');
  },

  async getAttendanceHistory(employeeId: number): Promise<Attendance[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(
        'SELECT * FROM attendance WHERE employee_id = $1 ORDER BY date DESC',
        [employeeId]
      );
      return res.rows;
    }
    return jsonDb.attendance
      .filter(a => a.employee_id === employeeId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },

  async getAttendanceTeam(filters: { departmentId?: number; employeeId?: number; startDate?: string; endDate?: string } = {}): Promise<any[]> {
    if (this.isPostgres() && pool) {
      let queryText = `
        SELECT a.*, 
               json_build_object(
                 'id', e.id,
                 'employee_id', e.employee_id,
                 'first_name', e.first_name,
                 'last_name', e.last_name,
                 'email', e.email,
                 'designation', e.designation,
                 'role', e.role,
                 'status', e.status,
                 'department_id', e.department_id
               ) as employee
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let index = 1;

      if (filters.employeeId) {
        queryText += ` AND a.employee_id = $${index++}`;
        params.push(filters.employeeId);
      }
      if (filters.departmentId) {
        queryText += ` AND e.department_id = $${index++}`;
        params.push(filters.departmentId);
      }
      if (filters.startDate) {
        queryText += ` AND a.date >= $${index++}`;
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        queryText += ` AND a.date <= $${index++}`;
        params.push(filters.endDate);
      }

      queryText += ` ORDER BY a.date DESC, e.first_name ASC`;
      const res = await pool.query(queryText, params);
      return res.rows;
    }

    let list = [...jsonDb.attendance];

    if (filters.employeeId) {
      list = list.filter(a => a.employee_id === filters.employeeId);
    }
    if (filters.startDate) {
      list = list.filter(a => a.date >= filters.startDate!);
    }
    if (filters.endDate) {
      list = list.filter(a => a.date <= filters.endDate!);
    }

    const result = list.map(a => {
      const emp = jsonDb.employees.find(e => e.id === a.employee_id);
      return {
        ...a,
        employee: emp ? {
          id: emp.id,
          employee_id: emp.employee_id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          designation: emp.designation,
          role: emp.role,
          status: emp.status,
          department_id: emp.department_id
        } : undefined
      };
    });

    let filtered = result;
    if (filters.departmentId) {
      filtered = result.filter(a => a.employee?.department_id === filters.departmentId);
    }

    filtered.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      const firstNameA = a.employee?.first_name || '';
      const firstNameB = b.employee?.first_name || '';
      return firstNameA.localeCompare(firstNameB);
    });

    return filtered;
  },

  async updateAttendance(id: number, data: Partial<Attendance>): Promise<Attendance | null> {
    let workingHours = data.working_hours;
    if (data.check_in && data.check_out) {
      const diffMs = new Date(data.check_out).getTime() - new Date(data.check_in).getTime();
      workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    }
    const updateData = { ...data };
    if (data.check_in && data.check_out) {
      updateData.working_hours = workingHours;
    }

    if (this.isPostgres() && pool) {
      const fields = Object.keys(updateData);
      if (fields.length === 0) {
        const res = await pool.query('SELECT * FROM attendance WHERE id = $1', [id]);
        return res.rows[0] || null;
      }
      
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(updateData)];
      const res = await pool.query(`UPDATE attendance SET ${setClause} WHERE id = $1 RETURNING *`, values);
      return res.rows[0] || null;
    }

    const index = jsonDb.attendance.findIndex(a => a.id === id);
    if (index === -1) return null;

    jsonDb.attendance[index] = { 
      ...jsonDb.attendance[index], 
      ...updateData
    };
    saveJsonDb();
    return jsonDb.attendance[index];
  },

  async getAttendanceAnalytics(filters: { departmentId?: number; employeeId?: number } = {}): Promise<AttendanceAnalytics> {
    const allEmployees = await this.getEmployees();
    const targetEmployees = filters.departmentId 
      ? allEmployees.filter(e => e.department_id === filters.departmentId)
      : allEmployees;
    
    const targetEmployeeIds = targetEmployees.map(e => e.id);
    const activeEmployeeIds = targetEmployees.filter(e => e.status === 'Active' || e.status === 'Probation').map(e => e.id);

    const todayStr = getLocalDateStr();
    let todayLogs: Attendance[] = [];
    let allLogs: Attendance[] = [];

    if (this.isPostgres() && pool) {
      const resToday = await pool.query('SELECT * FROM attendance WHERE date = $1', [todayStr]);
      todayLogs = resToday.rows;

      const resAll = await pool.query('SELECT * FROM attendance ORDER BY date DESC');
      allLogs = resAll.rows;
    } else {
      todayLogs = jsonDb.attendance.filter(a => a.date === todayStr);
      allLogs = jsonDb.attendance;
    }

    if (filters.employeeId) {
      todayLogs = todayLogs.filter(a => a.employee_id === filters.employeeId);
      allLogs = allLogs.filter(a => a.employee_id === filters.employeeId);
    } else if (filters.departmentId) {
      todayLogs = todayLogs.filter(a => targetEmployeeIds.includes(a.employee_id));
      allLogs = allLogs.filter(a => targetEmployeeIds.includes(a.employee_id));
    }

    const presentToday = todayLogs.filter(l => ['Present', 'Late', 'Work From Home'].includes(l.status)).length + todayLogs.filter(l => l.status === 'Half Day').length * 0.5;
    const lateArrivals = todayLogs.filter(l => l.status === 'Late').length;
    const wfhCount = todayLogs.filter(l => l.status === 'Work From Home').length;

    let absentToday = 0;
    if (filters.employeeId) {
      const isAbsent = todayLogs.length === 0 || todayLogs[0].status === 'Absent';
      absentToday = isAbsent ? 1 : 0;
    } else {
      const checkedInEmpIds = todayLogs.filter(l => l.status !== 'Absent').map(l => l.employee_id);
      const noLogCount = activeEmployeeIds.filter(id => !checkedInEmpIds.includes(id)).length;
      absentToday = noLogCount + todayLogs.filter(l => l.status === 'Absent').length;
    }

    let monthlyPercentage = 100;
    if (allLogs.length > 0) {
      const presentWeight = allLogs.reduce((acc, log) => {
        if (['Present', 'Late', 'Work From Home'].includes(log.status)) return acc + 1;
        if (log.status === 'Half Day') return acc + 0.5;
        return acc;
      }, 0);
      monthlyPercentage = Math.round((presentWeight / allLogs.length) * 100);
    }

    const dailyStats: Array<{ date: string; present: number; absent: number; late: number; wfh: number }> = [];
    const today = new Date();
    const dateList: string[] = [];
    
    for (let i = 14; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      dateList.push(d.toISOString().split('T')[0]);
    }

    for (const dateStr of dateList) {
      const logsForDate = allLogs.filter(l => l.date === dateStr);
      const present = logsForDate.filter(l => l.status === 'Present').length;
      const late = logsForDate.filter(l => l.status === 'Late').length;
      const wfh = logsForDate.filter(l => l.status === 'Work From Home').length;
      const halfDay = logsForDate.filter(l => l.status === 'Half Day').length;
      
      const checkedInIds = logsForDate.filter(l => l.status !== 'Absent').map(l => l.employee_id);
      const absent = filters.employeeId 
        ? (logsForDate.length === 0 || logsForDate[0].status === 'Absent' ? 1 : 0)
        : activeEmployeeIds.filter(id => !checkedInIds.includes(id)).length + logsForDate.filter(l => l.status === 'Absent').length;

      dailyStats.push({
        date: dateStr,
        present: present + halfDay * 0.5,
        absent,
        late,
        wfh
      });
    }

    return {
      presentToday: Math.round(presentToday),
      absentToday,
      lateArrivals,
      wfhCount,
      monthlyPercentage,
      dailyStats
    };
  },

  // --- TASK MANAGEMENT METHODS ---
  async getTasks(filters: { status?: TaskStatus; assigneeId?: number; departmentId?: number; priority?: TaskPriority } = {}): Promise<Task[]> {
    if (this.isPostgres() && pool) {
      let queryText = `
        SELECT t.*,
               json_build_object(
                 'id', a.id, 'employee_id', a.employee_id, 'first_name', a.first_name, 'last_name', a.last_name, 'email', a.email, 'designation', a.designation, 'role', a.role, 'status', a.status, 'joining_date', a.joining_date::text
               ) as assignee,
               json_build_object(
                 'id', c.id, 'employee_id', c.employee_id, 'first_name', c.first_name, 'last_name', c.last_name, 'email', c.email, 'designation', c.designation, 'role', c.role, 'status', c.status, 'joining_date', c.joining_date::text
               ) as creator,
               row_to_json(d) as department
        FROM tasks t
        LEFT JOIN employees a ON t.assignee_id = a.id
        LEFT JOIN employees c ON t.creator_id = c.id
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let index = 1;

      if (filters.status) {
        queryText += ` AND t.status = $${index++}`;
        params.push(filters.status);
      }
      if (filters.assigneeId) {
        queryText += ` AND t.assignee_id = $${index++}`;
        params.push(filters.assigneeId);
      }
      if (filters.departmentId) {
        queryText += ` AND t.department_id = $${index++}`;
        params.push(filters.departmentId);
      }
      if (filters.priority) {
        queryText += ` AND t.priority = $${index++}`;
        params.push(filters.priority);
      }

      queryText += ` ORDER BY t.id DESC`;
      const res = await pool.query(queryText, params);
      
      return res.rows.map(row => {
        if (row.assignee && row.assignee.id === null) row.assignee = null;
        if (row.creator && row.creator.id === null) row.creator = null;
        return row;
      });
    }

    let list = [...jsonDb.tasks];
    if (filters.status) list = list.filter(t => t.status === filters.status);
    if (filters.assigneeId) list = list.filter(t => t.assignee_id === filters.assigneeId);
    if (filters.departmentId) list = list.filter(t => t.department_id === filters.departmentId);
    if (filters.priority) list = list.filter(t => t.priority === filters.priority);

    return list.map(t => {
      const assignee = jsonDb.employees.find(e => e.id === t.assignee_id);
      const creator = jsonDb.employees.find(e => e.id === t.creator_id);
      const dept = jsonDb.departments.find(d => d.id === t.department_id);
      return {
        ...t,
        assignee: assignee ? (() => {
          const { password, ...rest } = assignee;
          return rest;
        })() : null,
        creator: creator ? (() => {
          const { password, ...rest } = creator;
          return rest;
        })() : null,
        department: dept || null
      };
    }).reverse();
  },

  async getTaskById(id: number): Promise<Task | null> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        SELECT t.*,
               json_build_object(
                 'id', a.id, 'employee_id', a.employee_id, 'first_name', a.first_name, 'last_name', a.last_name, 'email', a.email, 'designation', a.designation, 'role', a.role, 'status', a.status, 'joining_date', a.joining_date::text
               ) as assignee,
               json_build_object(
                 'id', c.id, 'employee_id', c.employee_id, 'first_name', c.first_name, 'last_name', c.last_name, 'email', c.email, 'designation', c.designation, 'role', c.role, 'status', c.status, 'joining_date', c.joining_date::text
               ) as creator,
               row_to_json(d) as department
        FROM tasks t
        LEFT JOIN employees a ON t.assignee_id = a.id
        LEFT JOIN employees c ON t.creator_id = c.id
        LEFT JOIN departments d ON t.department_id = d.id
        WHERE t.id = $1
      `, [id]);
      
      const row = res.rows[0];
      if (!row) return null;
      if (row.assignee && row.assignee.id === null) row.assignee = null;
      if (row.creator && row.creator.id === null) row.creator = null;
      return row;
    }

    const t = jsonDb.tasks.find(x => x.id === id);
    if (!t) return null;

    const assignee = jsonDb.employees.find(e => e.id === t.assignee_id);
    const creator = jsonDb.employees.find(e => e.id === t.creator_id);
    const dept = jsonDb.departments.find(d => d.id === t.department_id);
    return {
      ...t,
      assignee: assignee ? (() => {
        const { password, ...rest } = assignee;
        return rest;
      })() : null,
      creator: creator ? (() => {
        const { password, ...rest } = creator;
        return rest;
      })() : null,
      department: dept || null
    };
  },

  async createTask(data: Omit<Task, 'id' | 'created_at' | 'updated_at'>): Promise<Task> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        INSERT INTO tasks (title, description, status, priority, due_date, assignee_id, creator_id, department_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [data.title, data.description || null, data.status || 'Todo', data.priority || 'Medium', data.due_date || null, data.assignee_id || null, data.creator_id || null, data.department_id || null]);
      return (await this.getTaskById(res.rows[0].id))!;
    }

    const newId = jsonDb.tasks.length > 0 ? Math.max(...jsonDb.tasks.map(t => t.id)) + 1 : 1;
    const task: Task = {
      id: newId,
      title: data.title,
      description: data.description || undefined,
      status: data.status || 'Todo',
      priority: data.priority || 'Medium',
      due_date: data.due_date,
      assignee_id: data.assignee_id,
      creator_id: data.creator_id,
      department_id: data.department_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    jsonDb.tasks.push(task);
    saveJsonDb();
    return (await this.getTaskById(newId))!;
  },

  async updateTask(id: number, data: Partial<Task>): Promise<Task | null> {
    const updateData = { ...data, updated_at: new Date().toISOString() };
    delete updateData.assignee;
    delete updateData.creator;
    delete updateData.department;
    delete updateData.comments;
    delete updateData.activities;

    if (this.isPostgres() && pool) {
      const fields = Object.keys(updateData);
      if (fields.length === 0) return this.getTaskById(id);
      
      const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
      const values = [id, ...Object.values(updateData)];
      await pool.query(`UPDATE tasks SET ${setClause} WHERE id = $1`, values);
      return this.getTaskById(id);
    }

    const index = jsonDb.tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    jsonDb.tasks[index] = { 
      ...jsonDb.tasks[index], 
      ...updateData,
      updated_at: new Date().toISOString()
    };
    saveJsonDb();
    return this.getTaskById(id);
  },

  async deleteTask(id: number): Promise<boolean> {
    if (this.isPostgres() && pool) {
      const res = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const index = jsonDb.tasks.findIndex(t => t.id === id);
    if (index === -1) return false;
    jsonDb.tasks.splice(index, 1);
    jsonDb.task_comments = jsonDb.task_comments.filter(c => c.task_id !== id);
    jsonDb.task_activities = jsonDb.task_activities.filter(a => a.task_id !== id);
    saveJsonDb();
    return true;
  },

  async getTaskComments(taskId: number): Promise<TaskComment[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        SELECT c.*,
               json_build_object(
                 'id', e.id, 'employee_id', e.employee_id, 'first_name', e.first_name, 'last_name', e.last_name, 'email', e.email, 'designation', e.designation, 'role', e.role, 'status', e.status, 'joining_date', e.joining_date::text
               ) as author
        FROM task_comments c
        JOIN employees e ON c.author_id = e.id
        WHERE c.task_id = $1
        ORDER BY c.id ASC
      `, [taskId]);
      return res.rows;
    }

    return jsonDb.task_comments
      .filter(c => c.task_id === taskId)
      .map(c => {
        const author = jsonDb.employees.find(e => e.id === c.author_id);
        return {
          ...c,
          author: author ? (() => {
            const { password, ...rest } = author;
            return rest;
          })() : undefined
        };
      });
  },

  async addTaskComment(taskId: number, authorId: number, content: string): Promise<TaskComment> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        INSERT INTO task_comments (task_id, author_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [taskId, authorId, content]);
      const newComm = res.rows[0];
      
      const authorRes = await pool.query(`
        SELECT id, employee_id, first_name, last_name, email, designation, role, status, joining_date
        FROM employees WHERE id = $1
      `, [authorId]);
      newComm.author = authorRes.rows[0];
      return newComm;
    }

    const newId = jsonDb.task_comments.length > 0 ? Math.max(...jsonDb.task_comments.map(c => c.id)) + 1 : 1;
    const newComment: TaskComment = {
      id: newId,
      task_id: taskId,
      author_id: authorId,
      content,
      created_at: new Date().toISOString()
    };
    jsonDb.task_comments.push(newComment);
    saveJsonDb();
    
    const author = jsonDb.employees.find(e => e.id === authorId);
    return {
      ...newComment,
      author: author ? (() => {
        const { password, ...rest } = author;
        return rest;
      })() : undefined
    };
  },

  async getTaskActivities(taskId: number): Promise<TaskActivity[]> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        SELECT a.*,
               json_build_object(
                 'id', e.id, 'employee_id', e.employee_id, 'first_name', e.first_name, 'last_name', e.last_name, 'email', e.email, 'designation', e.designation, 'role', e.role, 'status', e.status, 'joining_date', e.joining_date::text
               ) as employee
        FROM task_activities a
        LEFT JOIN employees e ON a.employee_id = e.id
        WHERE a.task_id = $1
        ORDER BY a.id ASC
      `, [taskId]);
      
      return res.rows.map(row => {
        if (row.employee && row.employee.id === null) row.employee = null;
        return row;
      });
    }

    return jsonDb.task_activities
      .filter(a => a.task_id === taskId)
      .map(a => {
        const emp = jsonDb.employees.find(e => e.id === a.employee_id);
        return {
          ...a,
          employee: emp ? (() => {
            const { password, ...rest } = emp;
            return rest;
          })() : null
        };
      });
  },

  async logTaskActivity(taskId: number, employeeId: number | null, activityType: string, description: string): Promise<TaskActivity> {
    if (this.isPostgres() && pool) {
      const res = await pool.query(`
        INSERT INTO task_activities (task_id, employee_id, activity_type, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [taskId, employeeId, activityType, description]);
      return res.rows[0];
    }

    const newId = jsonDb.task_activities.length > 0 ? Math.max(...jsonDb.task_activities.map(a => a.id)) + 1 : 1;
    const newAct: TaskActivity = {
      id: newId,
      task_id: taskId,
      employee_id: employeeId,
      activity_type: activityType,
      description,
      created_at: new Date().toISOString()
    };
    jsonDb.task_activities.push(newAct);
    saveJsonDb();
    return newAct;
  }
};
export default db;
