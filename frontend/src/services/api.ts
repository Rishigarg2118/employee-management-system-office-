import axios from 'axios';
import { 
  Employee, Department, Skill, EmployeeDetails, 
  DashboardStats, DepartmentDistributionItem, GrowthTrendItem, Document 
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
  }
};
export default api;
export { API_URL };
