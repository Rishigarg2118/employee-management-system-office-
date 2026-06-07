// migrate.js - Standalone script to migrate database.json data to PostgreSQL
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'premium_hrms',
});

const jsonDbPath = path.resolve(__dirname, 'database.json');

async function migrate() {
  console.log('[Migration] Starting JSON -> PostgreSQL migration...');
  
  if (!fs.existsSync(jsonDbPath)) {
    console.error(`[Migration] Error: database.json file not found at: ${jsonDbPath}`);
    process.exit(1);
  }

  const jsonDb = JSON.parse(fs.readFileSync(jsonDbPath, 'utf-8'));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // 1. Truncate all tables to clear out auto-seeding defaults
    console.log('[Migration] Truncating all existing PostgreSQL tables to start clean...');
    await client.query(`
      TRUNCATE TABLE 
        audit_logs,
        notifications,
        task_activities,
        task_comments,
        tasks,
        team_members,
        teams,
        project_members,
        projects,
        attendance,
        leave_approvals,
        leave_requests,
        leave_balances,
        leave_types,
        activities,
        documents,
        employee_skills,
        skills,
        employees,
        departments
      RESTART IDENTITY CASCADE;
    `);

    // 2. Defer all constraints (FK checks) during bulk inserts
    await client.query('SET CONSTRAINTS ALL DEFERRED');

    // Insertion helper function
    const insertInto = async (tableName, columns, rows) => {
      if (!rows || rows.length === 0) {
        console.log(`[Migration] No records found to import for: "${tableName}"`);
        return;
      }
      console.log(`[Migration] Importing ${rows.length} rows into table: "${tableName}"...`);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => {
          let val = row[col];
          if (val === undefined) val = null;
          return val;
        });
        await client.query(query, values);
      }
    };

    // 3. Departments (Insert with manager_id = NULL first to avoid FK constraint errors)
    const deptsWithoutManager = jsonDb.departments.map(d => ({ ...d, manager_id: null }));
    await insertInto('departments', ['id', 'name', 'code', 'description', 'created_at'], deptsWithoutManager);

    // 4. Employees
    await insertInto('employees', [
      'id', 'employee_id', 'first_name', 'last_name', 'email', 'password',
      'phone', 'department_id', 'designation', 'status', 'joining_date',
      'avatar_url', 'address', 'bio', 'role', 'created_at', 'updated_at', 'deleted_at'
    ], jsonDb.employees);

    // 5. Restore Department Managers
    console.log('[Migration] Restoring department manager_id associations...');
    for (const dept of jsonDb.departments) {
      if (dept.manager_id) {
        await client.query('UPDATE departments SET manager_id = $1 WHERE id = $2', [dept.manager_id, dept.id]);
      }
    }

    // 6. Skills
    await insertInto('skills', ['id', 'name', 'category'], jsonDb.skills);

    // 7. Employee Skills
    await insertInto('employee_skills', ['employee_id', 'skill_id', 'proficiency_level'], jsonDb.employee_skills);

    // 8. Documents
    await insertInto('documents', ['id', 'employee_id', 'name', 'file_path', 'file_size', 'file_type', 'uploaded_at'], jsonDb.documents);

    // 9. Activities
    await insertInto('activities', ['id', 'employee_id', 'activity_type', 'description', 'created_at'], jsonDb.activities);

    // 10. Leave Types
    await insertInto('leave_types', ['id', 'name', 'code', 'description', 'default_days'], jsonDb.leave_types);

    // 11. Leave Balances
    await insertInto('leave_balances', ['employee_id', 'leave_type_id', 'total_days', 'used_days', 'remaining_days'], jsonDb.leave_balances);

    // 12. Leave Requests
    await insertInto('leave_requests', [
      'id', 'employee_id', 'leave_type_id', 'start_date', 'end_date',
      'total_days', 'reason', 'status', 'attachment_path', 'created_at', 'updated_at'
    ], jsonDb.leave_requests);

    // 13. Leave Approvals
    await insertInto('leave_approvals', ['id', 'leave_request_id', 'approver_id', 'stage', 'status', 'remarks', 'created_at'], jsonDb.leave_approvals);

    // 14. Attendance
    await insertInto('attendance', ['id', 'employee_id', 'date', 'check_in', 'check_out', 'status', 'working_hours', 'remarks', 'created_at'], jsonDb.attendance);

    // 15. Projects
    await insertInto('projects', ['id', 'name', 'description', 'start_date', 'deadline', 'status', 'manager_id', 'created_at', 'updated_at'], jsonDb.projects);

    // 16. Project Members
    await insertInto('project_members', ['project_id', 'employee_id'], jsonDb.project_members);

    // 17. Teams
    await insertInto('teams', ['id', 'name', 'department_id', 'lead_id', 'created_at'], jsonDb.teams);

    // 18. Team Members
    await insertInto('team_members', ['team_id', 'employee_id'], jsonDb.team_members);

    // 19. Tasks
    await insertInto('tasks', [
      'id', 'title', 'description', 'status', 'priority', 'due_date',
      'assignee_id', 'creator_id', 'department_id', 'project_id', 'team_id', 'created_at', 'updated_at'
    ], jsonDb.tasks);

    // 20. Task Comments
    await insertInto('task_comments', ['id', 'task_id', 'author_id', 'content', 'created_at'], jsonDb.task_comments);

    // 21. Task Activities
    await insertInto('task_activities', ['id', 'task_id', 'employee_id', 'activity_type', 'description', 'created_at'], jsonDb.task_activities);

    // 22. Notifications
    await insertInto('notifications', ['id', 'employee_id', 'title', 'message', 'type', 'is_read', 'created_at'], jsonDb.notifications);

    // 23. Audit Logs
    await insertInto('audit_logs', ['id', 'actor_id', 'actor_name', 'action', 'module', 'old_value', 'new_value', 'created_at'], jsonDb.audit_logs);

    // 24. Reset auto-increment sequences for SERIAL keys to prevent PK conflict errors on future inserts
    console.log('[Migration] Advancing PostgreSQL auto-increment serial sequences...');
    const tablesWithSequences = [
      'departments', 'employees', 'skills', 'documents', 'activities',
      'leave_types', 'leave_requests', 'leave_approvals', 'attendance',
      'projects', 'teams', 'tasks', 'task_comments', 'task_activities',
      'notifications', 'audit_logs'
    ];
    for (const tbl of tablesWithSequences) {
      await client.query(`SELECT setval('${tbl}_id_seq', COALESCE((SELECT MAX(id) FROM ${tbl}), 1))`);
    }

    await client.query('COMMIT');
    console.log('[Migration] Migration complete! All data successfully migrated from JSON to PostgreSQL.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration] CRITICAL ERROR during transaction execution. Rolled back.', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
