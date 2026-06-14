import { Response } from 'express';
import { db } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getHeadcount(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsHeadcount();
    res.json(data);
  } catch (err) {
    console.error('getHeadcount error:', err);
    res.status(500).json({ message: 'Error retrieving headcount report.' });
  }
}

export async function getDepartmentDistribution(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsDepartmentDistribution();
    res.json(data);
  } catch (err) {
    console.error('getDepartmentDistribution error:', err);
    res.status(500).json({ message: 'Error retrieving department distribution report.' });
  }
}

export async function getTaskStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsTaskStats();
    res.json(data);
  } catch (err) {
    console.error('getTaskStats error:', err);
    res.status(500).json({ message: 'Error retrieving task stats report.' });
  }
}

export async function getLeaveStats(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const data = await db.getReportsLeaveStats();
    res.json(data);
  } catch (err) {
    console.error('getLeaveStats error:', err);
    res.status(500).json({ message: 'Error retrieving leave stats report.' });
  }
}

export async function getComprehensiveReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const {
    reportType = 'daily',
    startDate = new Date().toISOString().split('T')[0],
    endDate = new Date().toISOString().split('T')[0],
    departmentId,
    page = '1',
    limit = '10',
    search = ''
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    if (!db.isPostgres()) {
      // Fallback JSON-based mock reporting
      res.json({
        data: [],
        total: 0,
        page: pageNum,
        limit: limitNum
      });
      return;
    }

    let queryText = '';
    const params: any[] = [];
    let paramIndex = 1;

    const sDate = startDate as string;
    const eDate = endDate as string;

    if (reportType === 'daily') {
      const dateParamIdx = paramIndex++;
      params.push(sDate);
      
      let filterClauses = '';
      if (departmentId) {
        filterClauses += ` AND e.department_id = $${paramIndex++}`;
        params.push(parseInt(departmentId as string, 10));
      }
      if (search) {
        filterClauses += ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR e.designation ILIKE $${paramIndex})`;
        paramIndex++;
        params.push(`%${search}%`);
      }

      queryText = `
        SELECT 
          e.id AS id,
          e.employee_id AS display_id,
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.designation,
          d.name AS department,
          a.check_in,
          a.check_out,
          COALESCE(a.status, 'Absent') AS attendance_status,
          COALESCE(SUM(CASE WHEN h.status = 'Active' THEN 0.5 ELSE 0 END) / 60.0, 0) AS working_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Idle' THEN 0.5 ELSE 0 END) / 60.0, 0) AS idle_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Break' THEN 0.5 ELSE 0 END) / 60.0, 0) AS break_hours
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = $${dateParamIdx}
        LEFT JOIN activity_heartbeats h ON e.id = h.employee_id AND h.timestamp::DATE = $${dateParamIdx}
        WHERE e.deleted_at IS NULL ${filterClauses}
        GROUP BY e.id, e.employee_id, e.first_name, e.last_name, e.designation, d.name, a.check_in, a.check_out, a.status
        ORDER BY name ASC
      `;
    } 
    else if (reportType === 'weekly' || reportType === 'monthly') {
      const sDateIdx = paramIndex++;
      const eDateIdx = paramIndex++;
      params.push(sDate, eDate);

      let filterClauses = '';
      if (departmentId) {
        filterClauses += ` AND e.department_id = $${paramIndex++}`;
        params.push(parseInt(departmentId as string, 10));
      }
      if (search) {
        filterClauses += ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR e.designation ILIKE $${paramIndex})`;
        paramIndex++;
        params.push(`%${search}%`);
      }

      queryText = `
        SELECT 
          e.id AS id,
          e.employee_id AS display_id,
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.designation,
          d.name AS department,
          COUNT(DISTINCT a.date)::int AS days_active,
          COALESCE(SUM(CASE WHEN h.status = 'Active' THEN 0.5 ELSE 0 END) / 60.0, 0) AS total_working_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Idle' THEN 0.5 ELSE 0 END) / 60.0, 0) AS total_idle_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Break' THEN 0.5 ELSE 0 END) / 60.0, 0) AS total_break_hours
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= $${sDateIdx} AND a.date <= $${eDateIdx}
        LEFT JOIN activity_heartbeats h ON e.id = h.employee_id AND h.timestamp::DATE >= $${sDateIdx} AND h.timestamp::DATE <= $${eDateIdx}
        WHERE e.deleted_at IS NULL ${filterClauses}
        GROUP BY e.id, e.employee_id, e.first_name, e.last_name, e.designation, d.name
        ORDER BY name ASC
      `;
    }
    else if (reportType === 'department') {
      const sDateIdx = paramIndex++;
      const eDateIdx = paramIndex++;
      params.push(sDate, eDate);

      let deptFilter = '';
      if (departmentId) {
        deptFilter = ` AND d.id = $${paramIndex++}`;
        params.push(parseInt(departmentId as string, 10));
      }

      queryText = `
        SELECT 
          d.id AS id,
          d.name AS department,
          CONCAT(mgr.first_name, ' ', mgr.last_name) AS manager,
          COUNT(DISTINCT e.id)::int AS staff_count,
          COALESCE(SUM(CASE WHEN h.status = 'Active' THEN 0.5 ELSE 0 END) / 60.0, 0) AS total_working_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Idle' THEN 0.5 ELSE 0 END) / 60.0, 0) AS total_idle_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Break' THEN 0.5 ELSE 0 END) / 60.0, 0) AS total_break_hours
        FROM departments d
        LEFT JOIN employees mgr ON d.manager_id = mgr.id
        LEFT JOIN employees e ON e.department_id = d.id AND e.deleted_at IS NULL
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= $${sDateIdx} AND a.date <= $${eDateIdx}
        LEFT JOIN activity_heartbeats h ON e.id = h.employee_id AND h.timestamp::DATE >= $${sDateIdx} AND h.timestamp::DATE <= $${eDateIdx}
        WHERE 1=1 ${deptFilter}
        GROUP BY d.id, d.name, mgr.first_name, mgr.last_name
        ORDER BY department ASC
      `;
    }
    else if (reportType === 'employee' || reportType === 'intern') {
      const sDateIdx = paramIndex++;
      const eDateIdx = paramIndex++;
      const roleIdx = paramIndex++;
      params.push(sDate, eDate, reportType === 'intern' ? 'Intern' : 'Employee');

      let filterClauses = '';
      if (departmentId) {
        filterClauses += ` AND e.department_id = $${paramIndex++}`;
        params.push(parseInt(departmentId as string, 10));
      }
      if (search) {
        filterClauses += ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR e.designation ILIKE $${paramIndex})`;
        paramIndex++;
        params.push(`%${search}%`);
      }

      queryText = `
        SELECT 
          e.id AS id,
          e.employee_id AS display_id,
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.designation,
          d.name AS department,
          COUNT(DISTINCT a.id)::int AS days_checked_in,
          COALESCE(SUM(CASE WHEN h.status = 'Active' THEN 0.5 ELSE 0 END) / 60.0, 0) AS working_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Idle' THEN 0.5 ELSE 0 END) / 60.0, 0) AS idle_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Break' THEN 0.5 ELSE 0 END) / 60.0, 0) AS break_hours
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN attendance a ON e.id = a.employee_id AND a.date >= $${sDateIdx} AND a.date <= $${eDateIdx}
        LEFT JOIN activity_heartbeats h ON e.id = h.employee_id AND h.timestamp::DATE >= $${sDateIdx} AND h.timestamp::DATE <= $${eDateIdx}
        WHERE e.deleted_at IS NULL AND e.role = $${roleIdx} ${filterClauses}
        GROUP BY e.id, e.employee_id, e.first_name, e.last_name, e.designation, d.name
        ORDER BY name ASC
      `;
    }
    else if (reportType === 'top-performers' || reportType === 'least-active') {
      const sDateIdx = paramIndex++;
      const eDateIdx = paramIndex++;
      params.push(sDate, eDate);

      const isTop = reportType === 'top-performers';

      let filterClauses = '';
      if (departmentId) {
        filterClauses += ` AND e.department_id = $${paramIndex++}`;
        params.push(parseInt(departmentId as string, 10));
      }
      if (search) {
        filterClauses += ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR e.designation ILIKE $${paramIndex})`;
        paramIndex++;
        params.push(`%${search}%`);
      }

      queryText = `
        WITH heartbeat_scores AS (
          SELECT 
            h.employee_id,
            h.timestamp::DATE AS date,
            h.status,
            COALESCE(
              (
                SELECT score 
                FROM productivity_classifications pc 
                WHERE LOWER(h.active_window) LIKE '%' || LOWER(pc.pattern) || '%' 
                ORDER BY LENGTH(pc.pattern) DESC 
                LIMIT 1
              ), 
              CASE 
                WHEN LOWER(h.active_window) LIKE '%code%' OR LOWER(h.active_window) LIKE '%editor%' THEN 100 
                ELSE 80 
              END
            ) AS heartbeat_score
          FROM activity_heartbeats h
          WHERE h.timestamp::DATE >= $${sDateIdx} AND h.timestamp::DATE <= $${eDateIdx} AND h.status = 'Active'
        )
        SELECT 
          e.id AS id,
          e.employee_id AS display_id,
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.designation,
          d.name AS department,
          COUNT(DISTINCT hs.date)::int AS active_days,
          ROUND(COALESCE(AVG(hs.heartbeat_score), 100))::int AS focus_score,
          COALESCE(SUM(CASE WHEN h.status = 'Active' THEN 0.5 ELSE 0 END) / 60.0, 0) AS total_working_hours
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN heartbeat_scores hs ON e.id = hs.employee_id
        LEFT JOIN activity_heartbeats h ON e.id = h.employee_id AND h.timestamp::DATE >= $${sDateIdx} AND h.timestamp::DATE <= $${eDateIdx}
        WHERE e.deleted_at IS NULL ${filterClauses}
        GROUP BY e.id, e.employee_id, e.first_name, e.last_name, e.designation, d.name
        ORDER BY ${isTop ? 'focus_score DESC, total_working_hours DESC' : 'total_working_hours ASC'}
      `;
    }
    else if (reportType === 'idle-analysis') {
      const sDateIdx = paramIndex++;
      const eDateIdx = paramIndex++;
      params.push(sDate, eDate);

      let filterClauses = '';
      if (departmentId) {
        filterClauses += ` AND e.department_id = $${paramIndex++}`;
        params.push(parseInt(departmentId as string, 10));
      }
      if (search) {
        filterClauses += ` AND (e.first_name ILIKE $${paramIndex} OR e.last_name ILIKE $${paramIndex} OR e.designation ILIKE $${paramIndex})`;
        paramIndex++;
        params.push(`%${search}%`);
      }

      queryText = `
        SELECT 
          e.id AS id,
          e.employee_id AS display_id,
          CONCAT(e.first_name, ' ', e.last_name) AS name,
          e.designation,
          d.name AS department,
          COALESCE(SUM(CASE WHEN h.status = 'Active' THEN 0.5 ELSE 0 END) / 60.0, 0) AS working_hours,
          COALESCE(SUM(CASE WHEN h.status = 'Idle' THEN 0.5 ELSE 0 END) / 60.0, 0) AS idle_hours,
          COALESCE(ROUND((SUM(CASE WHEN h.status = 'Idle' THEN 1.0 ELSE 0 END) * 100.0 / NULLIF(COUNT(h.id), 0))::numeric, 1), 0) AS idle_percentage
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.id
        LEFT JOIN activity_heartbeats h ON e.id = h.employee_id AND h.timestamp::DATE >= $${sDateIdx} AND h.timestamp::DATE <= $${eDateIdx}
        WHERE e.deleted_at IS NULL ${filterClauses}
        GROUP BY e.id, e.employee_id, e.first_name, e.last_name, e.designation, d.name
        ORDER BY idle_hours DESC
      `;
    }
    else if (reportType === 'website-usage') {
      const sDateIdx = paramIndex++;
      const eDateIdx = paramIndex++;
      params.push(sDate, eDate);

      let searchClause = '';
      if (search) {
        searchClause = ` AND active_window ILIKE $${paramIndex++}`;
        params.push(`%${search}%`);
      }

      queryText = `
        SELECT 
          LOWER(COALESCE(SUBSTRING(active_window FROM '([a-zA-Z0-9-]+\\.[a-zA-Z0-9-]{2,})'), 'browser-sessions')) AS website,
          COUNT(*) * 0.5 / 60.0 AS duration_hours,
          COUNT(DISTINCT employee_id) AS staff_count
        FROM activity_heartbeats
        WHERE timestamp::DATE >= $${sDateIdx} AND timestamp::DATE <= $${eDateIdx} AND status = 'Active' AND active_window ~ '(\\.[a-zA-Z]{2,})' ${searchClause}
        GROUP BY website
        ORDER BY duration_hours DESC
      `;
    }
    else if (reportType === 'application-usage') {
      const sDateIdx = paramIndex++;
      const eDateIdx = paramIndex++;
      params.push(sDate, eDate);

      let searchClause = '';
      if (search) {
        searchClause = ` AND active_window ILIKE $${paramIndex++}`;
        params.push(`%${search}%`);
      }

      queryText = `
        SELECT 
          COALESCE(
            SUBSTRING(active_window FROM ' - ([^-]+)$'),
            SUBSTRING(active_window FROM '^([^-]+)'),
            'Unknown App'
          ) AS app_name,
          COUNT(*) * 0.5 / 60.0 AS duration_hours,
          COUNT(DISTINCT employee_id) AS staff_count
        FROM activity_heartbeats
        WHERE timestamp::DATE >= $${sDateIdx} AND timestamp::DATE <= $${eDateIdx} AND status = 'Active' ${searchClause}
        GROUP BY app_name
        ORDER BY duration_hours DESC
      `;
    }

    // Wrap query in count query to enable pagination offset calculation
    const dbRes = await db.query(queryText, params);
    const totalCount = dbRes.rows.length;

    // Apply pagination offset
    const paginatedQuery = `${queryText} LIMIT ${limitNum} OFFSET ${offset}`;
    const paginatedRes = await db.query(paginatedQuery, params);

    res.json({
      data: paginatedRes.rows,
      total: totalCount,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    console.error('getComprehensiveReport error:', err);
    res.status(500).json({ message: 'Error compiling comprehensive analytics report.' });
  }
}
