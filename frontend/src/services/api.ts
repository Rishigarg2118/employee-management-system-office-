import axios from 'axios';
import { 
  Employee, Department, Skill, EmployeeDetails, 
  DashboardStats, DepartmentDistributionItem, GrowthTrendItem, Document,
  LeaveType, LeaveBalance, LeaveRequest, LeaveDashboardData,
  AttendanceStatus, Attendance, AttendanceAnalytics,
  Task, TaskComment, TaskActivity
} from '../types';

export const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string) || 'http://localhost:5000';
export const API_URL = (import.meta.env.VITE_API_URL as string) || `${SERVER_URL}/api`;

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
    if (config.data instanceof FormData) {
      if (config.headers) {
        if (typeof config.headers.delete === 'function') {
          config.headers.delete('Content-Type');
        } else {
          delete config.headers['Content-Type'];
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export function resetAuthSession() {
  isRefreshing = false;
  failedQueue = [];
}

// Response Interceptor: Redirect or handle token expiration with automatic refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      // Check if token was already refreshed by another concurrent request while this one was in-flight
      const currentToken = localStorage.getItem('hrms_token');
      const requestToken = originalRequest.headers.Authorization?.split(' ')[1];
      if (currentToken && requestToken && currentToken !== requestToken) {
        originalRequest.headers.Authorization = 'Bearer ' + currentToken;
        return apiClient(originalRequest);
      }

      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('hrms_refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_refresh_token');
        localStorage.removeItem('hrms_user');
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      isRefreshing = true;

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { token: newAccessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('hrms_token', newAccessToken);
        localStorage.setItem('hrms_refresh_token', newRefreshToken);

        apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
        originalRequest.headers.Authorization = 'Bearer ' + newAccessToken;

        processQueue(null, newAccessToken);
        isRefreshing = false;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        localStorage.removeItem('hrms_token');
        localStorage.removeItem('hrms_refresh_token');
        localStorage.removeItem('hrms_user');

        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/setup')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
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
    return res.data; // returns { token, refreshToken, user }
  },
  async setup(payload: any) {
    const res = await apiClient.post('/auth/setup', payload);
    return res.data;
  },
  async getMe() {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
  async logout(payload: { refreshToken: string }) {
    const res = await apiClient.post('/auth/logout', payload);
    return res.data;
  },
  async getSystemStatus() {
    const res = await apiClient.get('/auth/status');
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
      headers: { 'Content-Type': undefined }
    });
    return res.data;
  },
  async updateEmployee(id: number, formData: FormData): Promise<Employee> {
    // Note: Multer expects multipart/form-data. In Express, we mapped POST/PUT 
    // with upload.single. To avoid issues with PUT and file uploads on some browsers,
    // we utilize the standard route POST /api/employees/:id mapping to update.
    const res = await apiClient.post(`/employees/${id}`, formData, {
      headers: { 'Content-Type': undefined }
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
  async deleteDepartment(id: number): Promise<void> {
    await apiClient.delete(`/departments/${id}`);
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
      headers: { 'Content-Type': undefined }
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
      headers: { 'Content-Type': undefined }
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
  async submitAttendanceCorrectionRequest(id: number, payload: { requested_status: string; requested_check_in?: string | null; requested_check_out?: string | null; reason: string }): Promise<any> {
    const res = await apiClient.post(`/attendance/${id}/correction-request`, payload);
    return res.data;
  },
  async rejectAttendanceCorrectionRequest(id: number, payload?: { remarks?: string }): Promise<any> {
    const res = await apiClient.post(`/attendance/corrections/${id}/reject`, payload || {});
    return res.data;
  },
  async getAttendanceCorrectionRequests(params?: { status?: string; employeeId?: number }): Promise<any[]> {
    const res = await apiClient.get('/attendance/corrections', { params });
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
  async getTasks(params?: { status?: string; assigneeId?: number; departmentId?: number; priority?: string; projectId?: number; teamId?: number }): Promise<Task[]> {
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
  },

  // Projects
  async getProjects(params?: any) {
    const res = await apiClient.get('/projects', { params });
    return res.data;
  },
  async getProjectById(id: number) {
    const res = await apiClient.get(`/projects/${id}`);
    return res.data;
  },
  async createProject(payload: any) {
    const res = await apiClient.post('/projects', payload);
    return res.data;
  },
  async updateProject(id: number, payload: any) {
    const res = await apiClient.put(`/projects/${id}`, payload);
    return res.data;
  },
  async deleteProject(id: number) {
    const res = await apiClient.delete(`/projects/${id}`);
    return res.data;
  },

  // Teams
  async getTeams(params?: any) {
    const res = await apiClient.get('/teams', { params });
    return res.data;
  },
  async getTeamById(id: number) {
    const res = await apiClient.get(`/teams/${id}`);
    return res.data;
  },
  async createTeam(payload: any) {
    const res = await apiClient.post('/teams', payload);
    return res.data;
  },
  async updateTeam(id: number, payload: any) {
    const res = await apiClient.put(`/teams/${id}`, payload);
    return res.data;
  },
  async deleteTeam(id: number) {
    const res = await apiClient.delete(`/teams/${id}`);
    return res.data;
  },

  // Notifications
  async getNotifications() {
    const res = await apiClient.get('/notifications');
    return res.data;
  },
  async markNotificationAsRead(id: number) {
    const res = await apiClient.put(`/notifications/${id}/read`, {});
    return res.data;
  },
  async markAllNotificationsAsRead() {
    const res = await apiClient.post('/notifications/read-all', {});
    return res.data;
  },

  // Audit Logs
  async getAuditLogs(params?: any) {
    const res = await apiClient.get('/audit-logs', { params });
    return res.data;
  },

  // Global Search
  async search(query: string) {
    const res = await apiClient.get('/search', { params: { q: query } });
    return res.data;
  },

  // Executive Reports (Security Hardened & Scalable)
  async getReportsHeadcount(): Promise<{ count: number }> {
    const res = await apiClient.get('/reports/headcount');
    return res.data;
  },
  async getReportsLeaveStats(): Promise<{ pendingLeavesCount: number; monthlyTrends: any[] }> {
    const res = await apiClient.get('/reports/leave-stats');
    return res.data;
  },
  async getReportsTaskStats(): Promise<{ totalTasksCount: number; taskCompletionRate: number; taskPriorityData: any[] }> {
    const res = await apiClient.get('/reports/task-stats');
    return res.data;
  },
  async getReportsDepartmentDistribution(): Promise<{ name: string; value: number }[]> {
    const res = await apiClient.get('/reports/department-distribution');
    return res.data;
  }
};
export default api;
