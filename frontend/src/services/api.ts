import axios from 'axios';
import { 
  Employee, Department, Skill, EmployeeDetails, 
  DashboardStats, DepartmentDistributionItem, GrowthTrendItem, Document,
  LeaveType, LeaveBalance, LeaveRequest, LeaveDashboardData,
  AttendanceStatus, Attendance, AttendanceAnalytics,
  Task, TaskComment, TaskActivity
} from '../types';

const API_URL = 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT token automatically
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hrms_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Redirect or handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_user');
      // If we are not on the login page, redirect to login
      if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// REST API Service Wrapper Methods
export const api = {
  // Auth
  async login(payload: any) {
    const res = await apiClient.post('/auth/login', payload);
    return res.data; // returns { token, user }
  },
  async setup(payload: any) {
    const res = await apiClient.post('/auth/setup', payload);
    return res.data;
  },
  async getMe() {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await apiClient.get('/dashboard/stats');
    return res.data;
  },
  async getDepartmentDistribution(): Promise<DepartmentDistributionItem[]> {
    const res = await apiClient.get('/dashboard/departments');
    return res.data;
  },
  async getEmployeeGrowth(): Promise<GrowthTrendItem[]> {
    const res = await apiClient.get('/dashboard/growth');
    return res.data;
  },
  async getRecentActivities(): Promise<any[]> {
    const res = await apiClient.get('/dashboard/activities');
    return res.data;
  },

  // Employees
  async getEmployees(params?: any): Promise<{ data: Employee[]; pagination: any }> {
    const res = await apiClient.get('/employees', { params });
    return res.data;
  },
  async getEmployeeById(id: number): Promise<EmployeeDetails> {
    const res = await apiClient.get(`/employees/${id}`);
    return res.data;
  },
  async createEmployee(formData: FormData): Promise<Employee> {
    const res = await apiClient.post('/employees', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  async updateEmployee(id: number, formData: FormData): Promise<Employee> {
    const res = await apiClient.post(`/employees/${id}`, formData, {
      // Note: Multer expects multipart/form-data. In Express, we mapped POST/PUT 
      // with upload.single. To avoid issues with PUT and file uploads on some browsers,
      // we utilize the standard route POST /api/employees/:id mapping to update.
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  // Direct JSON updates without files
  async updateEmployeeFields(id: number, fields: any): Promise<Employee> {
    // We map PUT /employees/:id to employee updates
    const res = await apiClient.put(`/employees/${id}`, fields);
    return res.data;
  },
  async deleteEmployee(id: number): Promise<void> {
    await apiClient.delete(`/employees/${id}`);
  },
  async bulkActions(payload: { ids: number[]; action: 'delete' | 'status'; value?: string }) {
    const res = await apiClient.post('/employees/bulk', payload);
    return res.data;
  },

  // Departments
  async getDepartments(): Promise<Department[]> {
    const res = await apiClient.get('/departments');
    return res.data;
  },
  async createDepartment(payload: Partial<Department>): Promise<Department> {
    const res = await apiClient.post('/departments', payload);
    return res.data;
  },
  async updateDepartment(id: number, payload: Partial<Department>): Promise<Department> {
    const res = await apiClient.put(`/departments/${id}`, payload);
    return res.data;
  },

  // Skills
  async getSkills(): Promise<Skill[]> {
    const res = await apiClient.get('/skills');
    return res.data;
  },
  async createSkill(payload: { name: string; category: string }): Promise<Skill> {
    const res = await apiClient.post('/skills', payload);
    return res.data;
  },

  // Documents
  async getEmployeeDocuments(employeeId: number): Promise<Document[]> {
    const res = await apiClient.get(`/documents/employee/${employeeId}`);
    return res.data;
  },
  async uploadDocument(employeeId: number, file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('employee_id', employeeId.toString());
    formData.append('document', file);
    const res = await apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  async deleteDocument(id: number): Promise<void> {
    await apiClient.delete(`/documents/${id}`);
  },

  // Leaves
  async getLeaveTypes(): Promise<LeaveType[]> {
    const res = await apiClient.get('/leaves/types');
    return res.data;
  },
  async getLeaveBalances(employeeId: number): Promise<LeaveBalance[]> {
    const res = await apiClient.get(`/leaves/balances/${employeeId}`);
    return res.data;
  },
  async getLeaveRequests(params?: any): Promise<LeaveRequest[]> {
    const res = await apiClient.get('/leaves/requests', { params });
    return res.data;
  },
  async getLeaveRequestById(id: number): Promise<LeaveRequest> {
    const res = await apiClient.get(`/leaves/requests/${id}`);
    return res.data;
  },
  async applyLeave(formData: FormData): Promise<LeaveRequest> {
    const res = await apiClient.post('/leaves/requests', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  async approveLeaveWorkflow(id: number, payload: { stage: 'Manager Review' | 'HR Review'; status: 'Approved' | 'Rejected'; remarks?: string }): Promise<LeaveRequest> {
    const res = await apiClient.post(`/leaves/requests/${id}/approve`, payload);
    return res.data;
  },
  async cancelLeave(id: number): Promise<LeaveRequest> {
    const res = await apiClient.post(`/leaves/requests/${id}/cancel`);
    return res.data;
  },
  async getLeaveAnalytics(): Promise<LeaveDashboardData> {
    const res = await apiClient.get('/leaves/analytics');
    return res.data;
  },
  async getLeaveCalendar(params?: any): Promise<any[]> {
    const res = await apiClient.get('/leaves/calendar', { params });
    return res.data;
  },
  async getLeaveReports(params?: any): Promise<any[]> {
    const res = await apiClient.get('/leaves/reports', { params });
    return res.data;
  },

  // Attendance
  async getAttendanceToday(): Promise<Attendance | null> {
    const res = await apiClient.get('/attendance/today');
    return res.data;
  },
  async checkIn(payload: { status?: AttendanceStatus; remarks?: string }): Promise<Attendance> {
    const res = await apiClient.post('/attendance/check-in', payload);
    return res.data;
  },
  async checkOut(): Promise<Attendance> {
    const res = await apiClient.post('/attendance/check-out');
    return res.data;
  },
  async getAttendanceHistory(): Promise<Attendance[]> {
    const res = await apiClient.get('/attendance/history');
    return res.data;
  },
  async getEmployeeAttendanceHistory(employeeId: number): Promise<Attendance[]> {
    const res = await apiClient.get(`/attendance/history/${employeeId}`);
    return res.data;
  },
  async getAttendanceTeam(params?: { departmentId?: number; employeeId?: number; startDate?: string; endDate?: string }): Promise<Attendance[]> {
    const res = await apiClient.get('/attendance/team', { params });
    return res.data;
  },
  async updateAttendance(id: number, payload: { status: AttendanceStatus; check_in?: string | null; check_out?: string | null; remarks?: string | null }): Promise<Attendance> {
    const res = await apiClient.put(`/attendance/${id}`, payload);
    return res.data;
  },
  async getAttendanceAnalytics(params?: { departmentId?: number; employeeId?: number }): Promise<AttendanceAnalytics> {
    const res = await apiClient.get('/attendance/analytics', { params });
    return res.data;
  },
  async getAttendanceReport(params?: { departmentId?: number; employeeId?: number; startDate?: string; endDate?: string }): Promise<any[]> {
    const res = await apiClient.get('/attendance/report', { params });
    return res.data;
  },

  // Task Management (Phase 2)
  async getTasks(params?: { status?: string; assigneeId?: number; departmentId?: number; priority?: string }): Promise<Task[]> {
    const res = await apiClient.get('/tasks', { params });
    return res.data;
  },
  async getTaskById(id: number): Promise<Task> {
    const res = await apiClient.get(`/tasks/${id}`);
    return res.data;
  },
  async createTask(payload: Partial<Task>): Promise<Task> {
    const res = await apiClient.post('/tasks', payload);
    return res.data;
  },
  async updateTask(id: number, payload: Partial<Task>): Promise<Task> {
    const res = await apiClient.put(`/tasks/${id}`, payload);
    return res.data;
  },
  async deleteTask(id: number): Promise<{ success: boolean }> {
    const res = await apiClient.delete(`/tasks/${id}`);
    return res.data;
  },
  async getTaskComments(id: number): Promise<TaskComment[]> {
    const res = await apiClient.get(`/tasks/${id}/comments`);
    return res.data;
  },
  async addTaskComment(id: number, payload: { content: string }): Promise<TaskComment> {
    const res = await apiClient.post(`/tasks/${id}/comments`, payload);
    return res.data;
  },
  async getTaskActivities(id: number): Promise<TaskActivity[]> {
    const res = await apiClient.get(`/tasks/${id}/activities`);
    return res.data;
  }
};
export default api;
export { API_URL };
