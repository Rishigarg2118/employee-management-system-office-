import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SocialConnect HRMS API Documentation',
    version: '1.0.0',
    description: 'Production-grade API endpoints for Authentication, Employee Records, and the Leave Management & Approval Workflow system.',
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      LeaveType: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          code: { type: 'string' },
          description: { type: 'string' },
          default_days: { type: 'integer' },
        },
      },
      LeaveBalance: {
        type: 'object',
        properties: {
          employee_id: { type: 'integer' },
          leave_type_id: { type: 'integer' },
          total_days: { type: 'integer' },
          used_days: { type: 'integer' },
          remaining_days: { type: 'integer' },
          leave_type: { $ref: '#/components/schemas/LeaveType' },
        },
      },
      LeaveRequest: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          employee_id: { type: 'integer' },
          leave_type_id: { type: 'integer' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date' },
          total_days: { type: 'integer' },
          reason: { type: 'string' },
          status: { type: 'string', enum: ['Pending', 'Under Review', 'Manager Approved', 'HR Approved', 'Approved', 'Rejected', 'Cancelled'] },
          attachment_path: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      LeaveApproval: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          leave_request_id: { type: 'integer' },
          approver_id: { type: 'integer', nullable: true },
          stage: { type: 'string', enum: ['Manager Review', 'HR Review'] },
          status: { type: 'string', enum: ['Approved', 'Rejected'] },
          remarks: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User Login',
        description: 'Authenticates user and issues a JWT token.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email', example: 'marcus.v@enterprise.io' },
                  password: { type: 'string', example: 'password123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Authentication successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        email: { type: 'string' },
                        role: { type: 'string' },
                        first_name: { type: 'string' },
                        last_name: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get Current Profile',
        description: 'Returns the currently logged in user context.',
        responses: {
          200: { description: 'Profile context details' },
          401: { description: 'Unauthorized token' },
        },
      },
    },
    '/api/leaves/types': {
      get: {
        tags: ['Leaves Metadata'],
        summary: 'List Leave Categories',
        description: 'Returns active types (Casual, Sick, Earned, Maternity).',
        responses: {
          200: {
            description: 'Array of leave categories',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LeaveType' },
                },
              },
            },
          },
        },
      },
    },
    '/api/leaves/balances/{employeeId}': {
      get: {
        tags: ['Leaves Metadata'],
        summary: 'Fetch Quota Allocations',
        description: 'Returns used and remaining balances for a selected employee.',
        parameters: [
          {
            name: 'employeeId',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          200: {
            description: 'Quota allocation detail array',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LeaveBalance' },
                },
              },
            },
          },
          403: { description: 'Access denied' },
        },
      },
    },
    '/api/leaves/requests': {
      get: {
        tags: ['Leaves Registry'],
        summary: 'Fetch Leave Applications',
        description: 'List leave requests matching optional status and department filters. Employees only see their own.',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'departmentId', in: 'query', schema: { type: 'integer' } },
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'List of leave applications',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/LeaveRequest' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Leaves Registry'],
        summary: 'Submit Leave Application',
        description: 'Apply for a request. Files can be attached.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['leave_type_id', 'start_date', 'end_date', 'reason'],
                properties: {
                  leave_type_id: { type: 'integer' },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                  reason: { type: 'string' },
                  attachment: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Leave application created' },
          400: { description: 'Invalid data or insufficient balance' },
        },
      },
    },
    '/api/leaves/requests/{id}': {
      get: {
        tags: ['Leaves Registry'],
        summary: 'Get Leave Application Details',
        description: 'Returns detail audit timeline and logs for a single application.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'Detailed leave request record',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LeaveRequest' },
              },
            },
          },
          404: { description: 'Request not found' },
        },
      },
    },
    '/api/leaves/requests/{id}/approve': {
      post: {
        tags: ['Leaves Registry'],
        summary: 'Approve or Reject Leave',
        description: 'Executes Manager or HR review approvals.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['stage', 'status'],
                properties: {
                  stage: { type: 'string', enum: ['Manager Review', 'HR Review'] },
                  status: { type: 'string', enum: ['Approved', 'Rejected'] },
                  remarks: { type: 'string', example: 'Approved' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Workflow state updated successfully' },
          400: { description: 'Invalid workflow progression' },
          403: { description: 'Unauthorized role permissions' },
        },
      },
    },
    '/api/leaves/requests/{id}/cancel': {
      post: {
        tags: ['Leaves Registry'],
        summary: 'Cancel Leave Request',
        description: 'Allows employees to cancel pending requests.',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Request status set to Cancelled' },
          400: { description: 'Request already approved/rejected' },
        },
      },
    },
    '/api/leaves/analytics': {
      get: {
        tags: ['Executive Analytics'],
        summary: 'Leave Dashboard Analytics',
        description: 'Aggregates counts, trends, and utilization metrics.',
        responses: {
          200: { description: 'Analytics payload' },
        },
      },
    },
    '/api/leaves/calendar': {
      get: {
        tags: ['Executive Calendar'],
        summary: 'Team Availability Grid',
        description: 'Lists leave schedules formatted for Calendar UI visualization.',
        responses: {
          200: { description: 'Calendar event list' },
        },
      },
    },
    '/api/leaves/reports': {
      get: {
        tags: ['Reports Generator'],
        summary: 'Query Filters Reporting',
        description: 'Lists detailed records formatted for CSV downloads.',
        parameters: [
          { name: 'departmentId', in: 'query', schema: { type: 'integer' } },
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
          { name: 'leaveTypeId', in: 'query', schema: { type: 'integer' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'Tabular report listings' },
        },
      },
    },
  },
};

const options = {
  swaggerDefinition,
  apis: [],
};

export const swaggerSpec = swaggerJSDoc(options);
