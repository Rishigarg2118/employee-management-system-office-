const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'workforce@123',
  database: 'premium_hrms'
});

async function main() {
  try {
    console.log('Querying departments...');
    const depts = await pool.query('SELECT * FROM departments;');
    console.log('Departments:', depts.rows);

    console.log('Querying employees...');
    const emps = await pool.query('SELECT id, first_name, last_name, role, department_id FROM employees;');
    console.log('Employees:', emps.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
