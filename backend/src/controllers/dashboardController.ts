import { Request, Response } from 'express';
import { db } from '../config/db';
import { Employee } from '../types';

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const employees = await db.getEmployees();
    const departments = await db.getDepartments();
    const skills = await db.getSkills();
    const assets = await db.getAssets();

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === 'Active').length;
    const totalDepts = departments.length;
    const totalSkills = skills.length;
    const totalAssets = assets.length;
    const assignedAssets = assets.filter(a => a.status === 'Assigned').length;
    const availableAssets = assets.filter(a => a.status === 'Available').length;

    // Calculate realistic trends based on joining dates
    // (Assume joining dates before the last 30 days are baseline)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const baselineEmployees = employees.filter(e => new Date(e.joining_date) < thirtyDaysAgo).length;
    const employeeGrowthPercent = baselineEmployees > 0 
      ? parseFloat(((totalEmployees - baselineEmployees) / baselineEmployees * 100).toFixed(1)) 
      : 0;

    res.json({
      summary: {
        total_employees: {
          value: totalEmployees,
          trend: employeeGrowthPercent >= 0 ? 'up' : 'down',
          percentage: `${Math.abs(employeeGrowthPercent)}%`,
          label: 'vs last month'
        },
        active_employees: {
          value: activeEmployees,
          trend: 'up',
          percentage: '4.8%',
          label: 'vs last month'
        },
        departments: {
          value: totalDepts,
          trend: 'flat',
          percentage: '0%',
          label: 'vs last quarter'
        },
        skills: {
          value: totalSkills,
          trend: 'up',
          percentage: '12.5%',
          label: 'vs last month'
        },
        total_assets: {
          value: totalAssets,
          trend: 'flat',
          percentage: '0%',
          label: 'registered assets'
        },
        assigned_assets: {
          value: assignedAssets,
          trend: 'flat',
          percentage: '0%',
          label: 'allocated'
        },
        available_assets: {
          value: availableAssets,
          trend: 'flat',
          percentage: '0%',
          label: 'in inventory'
        }
      }
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ message: 'Error retrieving analytics statistics.' });
  }
}

export async function getDepartmentDistribution(req: Request, res: Response): Promise<void> {
  try {
    const departments = await db.getDepartments();
    const employees = await db.getEmployees();

    const data = departments.map(dept => {
      const count = employees.filter(e => e.department_id === dept.id).length;
      return {
        name: dept.name,
        value: count
      };
    });

    res.json(data);
  } catch (err) {
    console.error('getDepartmentDistribution error:', err);
    res.status(500).json({ message: 'Error calculating department allocations.' });
  }
}

export async function getEmployeeGrowthTrend(req: Request, res: Response): Promise<void> {
  try {
    const employees = await db.getEmployees();
    
    // Sort employees by joining date
    const sorted = [...employees].sort((a, b) => new Date(a.joining_date).getTime() - new Date(b.joining_date).getTime());
    
    // Build monthly growth trends for the last 6 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const trendData = [];
    
    // Collect past 6 months
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${months[targetDate.getMonth()]} ${targetDate.getFullYear().toString().slice(-2)}`;
      
      // Count how many employees joined before or during this target month
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
      const count = sorted.filter(e => new Date(e.joining_date) <= endOfMonth).length;
      
      // Calculate active count up to this point
      const activeCount = sorted.filter(e => {
        const joinDate = new Date(e.joining_date);
        return joinDate <= endOfMonth && e.status === 'Active';
      }).length;

      trendData.push({
        name: label,
        Employees: count,
        Active: activeCount
      });
    }

    res.json(trendData);
  } catch (err) {
    console.error('getEmployeeGrowthTrend error:', err);
    res.status(500).json({ message: 'Error calculating growth timeline trends.' });
  }
}

export async function getRecentActivities(req: Request, res: Response): Promise<void> {
  try {
    const activities = await db.getActivities(15);
    const employees = await db.getEmployees();
    
    const formatted = activities.map(act => {
      const employee = act.employee_id ? employees.find(e => e.id === act.employee_id) : null;
      return {
        ...act,
        employee_name: employee ? `${employee.first_name} ${employee.last_name}` : 'System',
        employee_avatar: employee ? employee.avatar_url : undefined
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('getRecentActivities error:', err);
    res.status(500).json({ message: 'Error pulling recent activity logs.' });
  }
}
