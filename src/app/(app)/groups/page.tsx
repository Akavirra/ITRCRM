'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { uk } from '@/i18n/uk';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface Course {
  id: number;
  title: string;
}

interface Teacher {
  id: number;
  name: string;
}

interface Group {
  id: number;
  public_id: string;
  title: string;
  course_id: number;
  course_title: string;
  teacher_id: number;
  teacher_name: string;
  weekly_day: number;
  start_time: string;
  duration_minutes: number;
  monthly_price: number;
  students_count: number;
  status: 'active' | 'graduate' | 'inactive';
  note: string | null;
  is_active: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        // Fetch groups
        const groupsRes = await fetch('/api/groups');
        const groupsData = await groupsRes.json();
        setGroups(groupsData.groups || []);

        // Fetch courses for filter
        const coursesRes = await fetch('/api/courses');
        const coursesData = await coursesRes.json();
        setCourses(coursesData.courses || []);

        // Fetch teachers for filter (admin only)
        if (authData.user.role === 'admin') {
          const usersRes = await fetch('/api/users');
          const usersData = await usersRes.json();
          setTeachers((usersData.users || []).filter((u: User) => u.role === 'teacher'));
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleSearch = async (query: string) => {
    setSearch(query);
    applyFilters(query, courseFilter, teacherFilter, statusFilter);
  };

  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'course':
        setCourseFilter(value);
        applyFilters(search, value, teacherFilter, statusFilter);
        break;
      case 'teacher':
        setTeacherFilter(value);
        applyFilters(search, courseFilter, value, statusFilter);
        break;
      case 'status':
        setStatusFilter(value);
        applyFilters(search, courseFilter, teacherFilter, value);
        break;
    }
  };

  const applyFilters = async (searchQuery: string, course: string, teacher: string, status: string) => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (course) params.append('courseId', course);
    if (teacher) params.append('teacherId', teacher);
    if (status) params.append('status', status);

    const res = await fetch(`/api/groups?${params.toString()}`);
    const data = await res.json();
    setGroups(data.groups || []);
  };

  const getDayName = (dayIndex: number) => {
    return uk.days[dayIndex as keyof typeof uk.days] || '';
  };

  const getStatusLabel = (status: string) => {
    return uk.groupStatus[status as keyof typeof uk.groupStatus] || status;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'graduate':
        return 'badge-info';
      case 'inactive':
        return 'badge-gray';
      default:
        return 'badge-gray';
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{uk.common.loading}</div>;
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
            {uk.pages.groups}
          </h1>
          {user.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => router.push('/groups/new')}>
              + {uk.actions.addGroup}
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <input
              type="text"
              className="form-input"
              placeholder={`${uk.actions.search}...`}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ maxWidth: '250px' }}
            />

            {/* Course filter */}
            <select
              className="form-input"
              value={courseFilter}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              style={{ minWidth: '180px' }}
            >
              <option value="">{uk.common.all} {uk.pages.courses.toLowerCase()}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>

            {/* Teacher filter (admin only) */}
            {user.role === 'admin' && (
              <select
                className="form-input"
                value={teacherFilter}
                onChange={(e) => handleFilterChange('teacher', e.target.value)}
                style={{ minWidth: '180px' }}
              >
                <option value="">{uk.common.all} {uk.roles.teacher.toLowerCase()}</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status filter */}
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="">{uk.common.all} {uk.common.status.toLowerCase()}</option>
              <option value="active">{uk.groupStatus.active}</option>
              <option value="graduate">{uk.groupStatus.graduate}</option>
              <option value="inactive">{uk.groupStatus.inactive}</option>
            </select>

            {/* Clear filters */}
            {(search || courseFilter || teacherFilter || statusFilter) && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSearch('');
                  setCourseFilter('');
                  setTeacherFilter('');
                  setStatusFilter('');
                  router.refresh();
                }}
              >
                {uk.actions.cancel}
              </button>
            )}
          </div>
        </div>

        <div className="table-container">
          {groups.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{uk.table.id}</th>
                  <th>{uk.table.title}</th>
                  <th>{uk.table.course}</th>
                  <th>{uk.table.schedule}</th>
                  {user.role === 'admin' && <th>{uk.table.teacher}</th>}
                  <th style={{ textAlign: 'center' }}>{uk.table.students}</th>
                  <th>{uk.common.status}</th>
                  <th>{uk.table.note}</th>
                  <th>{uk.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
                      {group.public_id}
                    </td>
                    <td>
                      <a href={`/groups/${group.id}`} style={{ fontWeight: '500' }}>
                        {group.title}
                      </a>
                    </td>
                    <td>{group.course_title}</td>
                    <td>
                      {getDayName(group.weekly_day)} {group.start_time}
                      <span style={{ color: '#6b7280', fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                        ({group.duration_minutes} {uk.plural.minute.many})
                      </span>
                    </td>
                    {user.role === 'admin' && <td>{group.teacher_name}</td>}
                    <td style={{ textAlign: 'center' }}>{group.students_count}</td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(group.status)}`}>
                        {getStatusLabel(group.status)}
                      </span>
                    </td>
                    <td>
                      {group.note ? (
                        <span style={{ 
                          maxWidth: '150px', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}>
                          {group.note}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => router.push(`/groups/${group.id}`)}
                        >
                          {uk.actions.view}
                        </button>
                        {user.role === 'admin' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => router.push(`/groups/${group.id}/edit`)}
                          >
                            {uk.actions.edit}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="empty-state-title">{uk.emptyStates.noGroups}</h3>
              <p className="empty-state-text">
                {user.role === 'teacher' 
                  ? uk.emptyStates.noGroupsTeacher
                  : uk.emptyStates.noGroupsHint}
              </p>
              {user.role === 'admin' && (
                <button className="btn btn-primary" onClick={() => router.push('/groups/new')}>
                  {uk.actions.addGroup}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
