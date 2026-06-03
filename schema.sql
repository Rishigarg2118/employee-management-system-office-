-- PostgreSQL database schema for the Enterprise Employee Management System

-- Drop tables if they exist (for easy teardown/reset)
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS employee_skills CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 1. Departments Table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    manager_id INTEGER, -- Self-referencing FK added via ALTER to prevent circular dependencies
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employees Table
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    designation VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave', 'Probation')),
    joining_date DATE NOT NULL,
    avatar_url VARCHAR(255),
    address TEXT,
    bio TEXT,
    role VARCHAR(20) DEFAULT 'Employee' CHECK (role IN ('Admin', 'Manager', 'Employee')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add manager_id foreign key constraint to departments table pointing to employees
ALTER TABLE departments ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 3. Skills Table
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL -- e.g., 'Frontend', 'Backend', 'Design', 'Management'
);

-- 4. Employee Skills Junction Table (Many-to-Many with proficiency)
CREATE TABLE employee_skills (
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level VARCHAR(20) NOT NULL CHECK (proficiency_level IN ('Beginner', 'Intermediate', 'Expert')),
    PRIMARY KEY (employee_id, skill_id)
);

-- 5. Documents Table
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL, -- In bytes
    file_type VARCHAR(100) NOT NULL, -- MIME type
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Activities (Timeline / Audit log) Table
CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL, -- e.g., 'EMPLOYEE_CREATED', 'SKILL_ASSIGNED', 'DOCUMENT_UPLOADED', 'STATUS_CHANGE'
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_activities_employee ON activities(employee_id);
CREATE INDEX idx_documents_employee ON documents(employee_id);
