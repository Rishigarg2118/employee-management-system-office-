import React, { useState, useEffect, useRef } from 'react';
import { Input, Spin, Empty, Space, Typography, Tag, Avatar, Dropdown, Card, List } from 'antd';
import { 
  SearchOutlined, UserOutlined, ProjectOutlined, CheckSquareOutlined,
  AppstoreOutlined, TeamOutlined, BulbOutlined, CalendarOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { Text } = Typography;

export const GlobalSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [results, setResults] = useState<{
    employees: any[];
    departments: any[];
    skills: any[];
    projects: any[];
    teams: any[];
    tasks: any[];
    leaves: any[];
  }>({
    employees: [],
    departments: [],
    skills: [],
    projects: [],
    teams: [],
    tasks: [],
    leaves: []
  });

  const navigate = useNavigate();
  const inputRef = useRef<any>(null);

  // Listen for CMD+K / CTRL+K to focus search input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Debounced search trigger
  useEffect(() => {
    if (!query.trim()) {
      setResults({
        employees: [],
        departments: [],
        skills: [],
        projects: [],
        teams: [],
        tasks: [],
        leaves: []
      });
      return;
    }

    setLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const data = await api.search(query);
        setResults(data);
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSelect = (type: string, id: number) => {
    setDropdownVisible(false);
    setQuery('');
    inputRef.current?.blur();
    
    if (type === 'employee') {
      navigate(`/employees/${id}`);
    } else if (type === 'project') {
      navigate(`/projects/${id}`);
    } else if (type === 'task') {
      navigate('/tasks'); // task board
    } else if (type === 'department') {
      navigate('/departments');
    } else if (type === 'team') {
      navigate('/teams');
    } else if (type === 'skill') {
      navigate('/skills');
    } else if (type === 'leave') {
      navigate('/leaves');
    }
  };

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Group offsets for flat indexing
  const empOffset = 0;
  const projOffset = results.employees.length;
  const taskOffset = projOffset + results.projects.length;
  const teamOffset = taskOffset + results.tasks.length;
  const deptOffset = teamOffset + results.teams.length;
  const skillOffset = deptOffset + results.departments.length;
  const leaveOffset = skillOffset + results.skills.length;

  const getFlatItems = () => {
    const items: { type: string; id: number }[] = [];
    results.employees.forEach(e => items.push({ type: 'employee', id: e.id }));
    results.projects.forEach(p => items.push({ type: 'project', id: p.id }));
    results.tasks.forEach(t => items.push({ type: 'task', id: t.id }));
    results.teams.forEach(t => items.push({ type: 'team', id: t.id }));
    results.departments.forEach(d => items.push({ type: 'department', id: d.id }));
    results.skills.forEach(s => items.push({ type: 'skill', id: s.id }));
    results.leaves.forEach(l => items.push({ type: 'leave', id: l.id }));
    return items;
  };

  const flatItems = getFlatItems();

  useEffect(() => {
    setActiveIndex(flatItems.length > 0 ? 0 : -1);
  }, [results, query]);

  useEffect(() => {
    if (activeIndex >= 0) {
      const activeEl = document.querySelector('.search-result-item-active');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (flatItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownVisible(true);
      setActiveIndex(prev => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropdownVisible(true);
      setActiveIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < flatItems.length) {
        const item = flatItems[activeIndex];
        handleSelect(item.type, item.id);
      }
    } else if (e.key === 'Escape') {
      setDropdownVisible(false);
      inputRef.current?.blur();
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatDateRange = (start?: string, end?: string) => {
    const s = formatDate(start);
    const e = formatDate(end);
    if (s && e) return `${s} - ${e}`;
    if (s) return `Starts: ${s}`;
    return '';
  };

  const hasResults = flatItems.length > 0;

  const menuContent = (
    <Card
      style={{
        width: 500,
        maxHeight: 400,
        overflowY: 'auto',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid #E2E8F0',
        borderRadius: 12,
        padding: 4
      }}
      bodyStyle={{ padding: 12 }}
    >
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Spin size="medium" />
        </div>
      ) : query.trim() === '' ? (
        <div style={{ padding: '20px 12px', textAlign: 'center', color: '#94A3B8' }}>
          <SearchOutlined style={{ fontSize: '24px', marginBottom: '8px', display: 'block', margin: '0 auto', color: '#CBD5E1' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Type to search staff, projects, tasks, departments, skills, or leaves.
          </Text>
        </div>
      ) : !hasResults ? (
        <Empty description="No matching records found." image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '12px 0' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Employees Group */}
          {results.employees.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
                Staff Members
              </Text>
              <List
                dataSource={results.employees}
                renderItem={(emp: any, index: number) => {
                  const globalIndex = empOffset + index;
                  const isActive = globalIndex === activeIndex;
                  return (
                    <div 
                      onClick={() => handleSelect('employee', emp.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                        background: isActive ? '#E2E8F0' : 'transparent'
                      }}
                      className={`search-result-item ${isActive ? 'search-result-item-active' : ''}`}
                    >
                      <Space size={10}>
                        <Avatar size={24} icon={<UserOutlined />} style={{ backgroundColor: '#10B981' }} />
                        <div>
                          <Text strong style={{ display: 'block', fontSize: '13px', color: '#0F172A' }}>
                            {emp.first_name} {emp.last_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            {emp.designation} &bull; {emp.email}
                          </Text>
                        </div>
                      </Space>
                      <Tag style={{ borderRadius: '4px', fontSize: '10px' }}>Staff</Tag>
                    </div>
                  );
                }}
              />
            </div>
          )}

          {/* Projects Group */}
          {results.projects.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
                Corporate Projects
              </Text>
              <List
                dataSource={results.projects}
                renderItem={(proj: any, index: number) => {
                  const globalIndex = projOffset + index;
                  const isActive = globalIndex === activeIndex;
                  return (
                    <div 
                      onClick={() => handleSelect('project', proj.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                        background: isActive ? '#E2E8F0' : 'transparent'
                      }}
                      className={`search-result-item ${isActive ? 'search-result-item-active' : ''}`}
                    >
                      <Space size={10}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ProjectOutlined style={{ color: '#10B981', fontSize: '12px' }} />
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', fontSize: '13px', color: '#0F172A' }}>
                            {proj.name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            Status: {proj.status} {formatDateRange(proj.start_date, proj.deadline) && `• ${formatDateRange(proj.start_date, proj.deadline)}`}
                          </Text>
                        </div>
                      </Space>
                      <Tag color="green" style={{ borderRadius: '4px', fontSize: '10px' }}>Project</Tag>
                    </div>
                  );
                }}
              />
            </div>
          )}

          {/* Tasks Group */}
          {results.tasks.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
                Assigned Tasks
              </Text>
              <List
                dataSource={results.tasks}
                renderItem={(task: any, index: number) => {
                  const globalIndex = taskOffset + index;
                  const isActive = globalIndex === activeIndex;
                  return (
                    <div 
                      onClick={() => handleSelect('task', task.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                        background: isActive ? '#E2E8F0' : 'transparent'
                      }}
                      className={`search-result-item ${isActive ? 'search-result-item-active' : ''}`}
                    >
                      <Space size={10}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckSquareOutlined style={{ color: '#3B82F6', fontSize: '12px' }} />
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', fontSize: '13px', color: '#0F172A' }}>
                            {task.title}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            Pipeline: {task.status} &bull; Priority: {task.priority} {task.due_date && `• Due: ${formatDate(task.due_date)}`}
                          </Text>
                        </div>
                      </Space>
                      <Tag color="blue" style={{ borderRadius: '4px', fontSize: '10px' }}>Task</Tag>
                    </div>
                  );
                }}
              />
            </div>
          )}

          {/* Teams Group */}
          {results.teams.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
                Corporate Teams
              </Text>
              <List
                dataSource={results.teams}
                renderItem={(team: any, index: number) => {
                  const globalIndex = teamOffset + index;
                  const isActive = globalIndex === activeIndex;
                  return (
                    <div 
                      onClick={() => handleSelect('team', team.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                        background: isActive ? '#E2E8F0' : 'transparent'
                      }}
                      className={`search-result-item ${isActive ? 'search-result-item-active' : ''}`}
                    >
                      <Space size={10}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TeamOutlined style={{ color: '#8B5CF6', fontSize: '12px' }} />
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', fontSize: '13px', color: '#0F172A' }}>
                            {team.name}
                          </Text>
                        </div>
                      </Space>
                      <Tag color="purple" style={{ borderRadius: '4px', fontSize: '10px' }}>Team</Tag>
                    </div>
                  );
                }}
              />
            </div>
          )}

          {/* Departments Group */}
          {results.departments.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
                Divisions & Departments
              </Text>
              <List
                dataSource={results.departments}
                renderItem={(dept: any, index: number) => {
                  const globalIndex = deptOffset + index;
                  const isActive = globalIndex === activeIndex;
                  return (
                    <div 
                      onClick={() => handleSelect('department', dept.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                        background: isActive ? '#E2E8F0' : 'transparent'
                      }}
                      className={`search-result-item ${isActive ? 'search-result-item-active' : ''}`}
                    >
                      <Space size={10}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AppstoreOutlined style={{ color: '#D97706', fontSize: '12px' }} />
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', fontSize: '13px', color: '#0F172A' }}>
                            {dept.name} ({dept.code})
                          </Text>
                        </div>
                      </Space>
                      <Tag color="warning" style={{ borderRadius: '4px', fontSize: '10px' }}>Dept</Tag>
                    </div>
                  );
                }}
              />
            </div>
          )}

          {/* Skills Group */}
          {results.skills.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
                Skills Catalog
              </Text>
              <List
                dataSource={results.skills}
                renderItem={(skill: any, index: number) => {
                  const globalIndex = skillOffset + index;
                  const isActive = globalIndex === activeIndex;
                  return (
                    <div 
                      onClick={() => handleSelect('skill', skill.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                        background: isActive ? '#E2E8F0' : 'transparent'
                      }}
                      className={`search-result-item ${isActive ? 'search-result-item-active' : ''}`}
                    >
                      <Space size={10}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FDF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BulbOutlined style={{ color: '#DB2777', fontSize: '12px' }} />
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', fontSize: '13px', color: '#0F172A' }}>
                            {skill.name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            Category: {skill.category}
                          </Text>
                        </div>
                      </Space>
                      <Tag color="magenta" style={{ borderRadius: '4px', fontSize: '10px' }}>Skill</Tag>
                    </div>
                  );
                }}
              />
            </div>
          )}

          {/* Leaves Group */}
          {results.leaves.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', fontSize: '10px', textTransform: 'uppercase', color: '#94A3B8', letterSpacing: '0.05em', marginBottom: '6px', paddingLeft: '8px' }}>
                Leaves & Approvals
              </Text>
              <List
                dataSource={results.leaves}
                renderItem={(leave: any, index: number) => {
                  const globalIndex = leaveOffset + index;
                  const isActive = globalIndex === activeIndex;
                  return (
                    <div 
                      onClick={() => handleSelect('leave', leave.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s ease',
                        background: isActive ? '#E2E8F0' : 'transparent'
                      }}
                      className={`search-result-item ${isActive ? 'search-result-item-active' : ''}`}
                    >
                      <Space size={10}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FFF5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CalendarOutlined style={{ color: '#E53E3E', fontSize: '12px' }} />
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', fontSize: '13px', color: '#0F172A' }}>
                            Leave: {leave.first_name} {leave.last_name}
                          </Text>
                          <Text type="secondary" style={{ fontSize: '11px' }}>
                            Reason: {leave.reason || 'No reason'} &bull; Status: {leave.status} {formatDateRange(leave.start_date, leave.end_date) && `• ${formatDateRange(leave.start_date, leave.end_date)}`}
                          </Text>
                        </div>
                      </Space>
                      <Tag color="error" style={{ borderRadius: '4px', fontSize: '10px' }}>Leave</Tag>
                    </div>
                  );
                }}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );

  return (
    <div style={{ position: 'relative' }}>
      <Dropdown
        open={dropdownVisible && (query.trim() !== '' || focused)}
        onOpenChange={(open) => {
          if (!open) setDropdownVisible(false);
        }}
        dropdownRender={() => menuContent}
        trigger={[]}
      >
        <Input
          ref={inputRef}
          prefix={<SearchOutlined style={{ color: '#94A3B8', marginRight: 4 }} />}
          placeholder="Quick search..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setDropdownVisible(true);
          }}
          onFocus={() => {
            setFocused(true);
            setDropdownVisible(true);
          }}
          onBlur={() => {
            // Delay blur slightly to allow clicks inside the dropdown list
            setTimeout(() => {
              setFocused(false);
              setDropdownVisible(false);
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: focused ? '320px' : '240px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            height: '36px'
          }}
        />
      </Dropdown>

      {/* Styled class injection for search results hover and active states */}
      <style>{`
        .search-result-item:hover {
          background: #F1F5F9 !important;
        }
        .search-result-item-active {
          background: #E2E8F0 !important;
        }
      `}</style>
    </div>
  );
};
