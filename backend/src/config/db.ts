import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { Department, Employee, Skill, EmployeeSkill, Document, Activity } from '../types';

// Load environment variables
import * as dotenv from 'dotenv';
dotenv.config();

const dbEnabled = process.env.DB_ENABLED === 'true';
const jsonDbPath = path.resolve(__dirname, '../../database.json');

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
}

let jsonDb: JsonDatabase = {
  departments: [],
  employees: [],
  skills: [],
  employee_skills: [],
  documents: [],
  activities: []
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
  { employee_id: 'EMP-001', first_name: 'Sarah', last_name: 'Jenkins', email: 'sarah.j@enterprise.io', designation: 'VP of Engineering', status: 'Active' as const, joining_date: '2022-01-15', role: 'Admin' as const, bio: 'Veteran tech leader focused on scaling teams, building robust architectures, and promoting developer happiness.', phone: '+1 (555) 123-4567', address: 'San Francisco, CA' },
  { employee_id: 'EMP-002', first_name: 'David', last_name: 'Chen', email: 'david.c@enterprise.io', designation: 'Principal Architect', status: 'Active' as const, joining_date: '2022-04-10', role: 'Manager' as const, bio: 'Passionate builder of microservices, distributed systems, and real-time data pipelines.', phone: '+1 (555) 234-5678', address: 'Seattle, WA' },
  { employee_id: 'EMP-003', first_name: 'Aisha', last_name: 'Rahman', email: 'aisha.r@enterprise.io', designation: 'Lead UI/UX Designer', status: 'Active' as const, joining_date: '2023-02-01', role: 'Manager' as const, bio: 'Creating beautiful, user-centered digital interfaces that simplify complex B2B enterprise workflows.', phone: '+1 (555) 345-6789', address: 'New York, NY' },
  { employee_id: 'EMP-004', first_name: 'Marcus', last_name: 'Vance', email: 'marcus.v@enterprise.io', designation: 'Senior Frontend Engineer', status: 'Active' as const, joining_date: '2023-06-15', role: 'Employee' as const, bio: 'Component-driven development advocate. Loves CSS-in-JS, animation, and performance optimization.', phone: '+1 (555) 456-7890', address: 'Austin, TX' },
  { employee_id: 'EMP-005', first_name: 'Elena', last_name: 'Rostova', email: 'elena.r@enterprise.io', designation: 'HR Director', status: 'Active' as const, joining_date: '2021-09-01', role: 'Admin' as const, bio: 'Dedicated to cultivating positive corporate culture, managing talent development, and HR compliance.', phone: '+1 (555) 567-8901', address: 'Chicago, IL' },
  { employee_id: 'EMP-006', first_name: 'John', last_name: 'Doe', email: 'john.doe@enterprise.io', designation: 'Senior React Developer', status: 'Active' as const, joining_date: '2024-01-10', role: 'Employee' as const, bio: 'Passionate about building responsive, accessible web interfaces.', phone: '+1 (555) 678-9012', address: 'Boston, MA' },
  { employee_id: 'EMP-007', first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@enterprise.io', designation: 'Senior Product Manager', status: 'Active' as const, joining_date: '2023-08-20', role: 'Manager' as const, bio: 'Driving product strategy, defining roadmaps, and collaborating across engineering and design.', phone: '+1 (555) 789-0123', address: 'Los Angeles, CA' },
  { employee_id: 'EMP-008', first_name: 'Liam', last_name: 'O\'Connor', email: 'liam.o@enterprise.io', designation: 'DevOps Engineer', status: 'Active' as const, joining_date: '2024-03-01', role: 'Employee' as const, bio: 'Automating cloud infrastructure, managing CI/CD pipelines, and ensuring system uptime.', phone: '+1 (555) 890-1234', address: 'Denver, CO' },
  { employee_id: 'EMP-009', first_name: 'Chloe', last_name: 'Tan', email: 'chloe.tan@enterprise.io', designation: 'UI Designer', status: 'Probation' as const, joining_date: '2026-03-15', role: 'Employee' as const, bio: 'Junior designer obsessed with typography, grids, and design systems.', phone: '+1 (555) 901-2345', address: 'San Francisco, CA' },
  { employee_id: 'EMP-010', first_name: 'Kofi', last_name: 'Anan', email: 'kofi.a@enterprise.io', designation: 'Backend Engineer', status: 'On Leave' as const, joining_date: '2022-11-10', role: 'Employee' as const, bio: 'API developer who writes clean, modular code in Node.js and Go.', phone: '+1 (555) 012-3456', address: 'Washington, DC' },
  { employee_id: 'EMP-011', first_name: 'Sophia', last_name: 'Martinez', email: 'sophia.m@enterprise.io', designation: 'Finance Lead', status: 'Active' as const, joining_date: '2022-03-01', role: 'Manager' as const, bio: 'Overseeing financial health, modeling growth, and optimizing tax strategies.', phone: '+1 (555) 123-7890', address: 'Miami, FL' },
  { employee_id: 'EMP-012', first_name: 'Julian', last_name: 'Draxler', email: 'julian.d@enterprise.io', designation: 'QA Specialist', status: 'Inactive' as const, joining_date: '2023-10-15', role: 'Employee' as const, bio: 'Breaking software so customers don\'t. Specialized in automated browser testing.', phone: '+1 (555) 234-8901', address: 'Portland, OR' }
];

// Helper to write changes to local JSON file
function saveJsonDb() {
  fs.writeFileSync(jsonDbPath, JSON.stringify(jsonDb, null, 2), 'utf-8');
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
  }
};
export default db;
