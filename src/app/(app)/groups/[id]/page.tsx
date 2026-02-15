'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { uk } from '@/i18n/uk';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
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
  photos_folder_url: string | null;
  is_active: number;
}

interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  join_date: string;
  student_group_id: number;
}

interface StudentSearch {
  id: number;
  full_name: string;
  phone: string | null;
}

type TabType = 'overview' | 'students' | 'lessons' | 'attendance';

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Add student modal state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<StudentSearch[]>([]);
  const [searching, setSearching] = useState(false);

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

        // Fetch group details
        const groupRes = await fetch(`/api/groups/${groupId}?withStudents=true`);
        if (!groupRes.ok) {
          router.push('/groups');
          return;
        }
        const groupData = await groupRes.json();
        setGroup(groupData.group);
        setStudents(groupData.students || []);
      } catch (error) {
        console.error('Failed to fetch group:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, groupId]);

  const handleSearchStudents = async (query: string) => {
    setStudentSearch(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      // Filter out students already in group
      const existingIds = students.map(s => s.id);
      setSearchResults((data.students || []).filter((s: StudentSearch) => !existingIds.includes(s.id)));
    } catch (error) {
      console.error('Failed to search students:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleAddStudent = async (studentId: number) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      });
      
      if (res.ok) {
        // Refresh students list
        const groupRes = await fetch(`/api/groups/${groupId}?withStudents=true`);
        const groupData = await groupRes.json();
        setStudents(groupData.students || []);
        setGroup(groupData.group);
        setShowAddStudentModal(false);
        setStudentSearch('');
        setSearchResults([]);
      } else {
        const data = await res.json();
        alert(data.error || 'Помилка додавання учня');
      }
    } catch (error) {
      console.error('Failed to add student:', error);
    }
  };

  const handleRemoveStudent = async (studentGroupId: number, studentName: string) => {
    if (!confirm(uk.confirm.removeStudent.replace('{name}', studentName))) {
      return;
    }
    
    try {
      const res = await fetch(`/api/groups/${groupId}/students?studentGroupId=${studentGroupId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        // Refresh students list
        const groupRes = await fetch(`/api/groups/${groupId}?withStudents=true`);
        const groupData = await groupRes.json();
        setStudents(groupData.students || []);
        setGroup(groupData.group);
      }
    } catch (error) {
      console.error('Failed to remove student:', error);
    }
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

  if (!user || !group) return null;

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: uk.groupTabs.overview },
    { id: 'students', label: uk.groupTabs.students },
    { id: 'lessons', label: uk.groupTabs.lessons },
    { id: 'attendance', label: uk.groupTabs.attendance },
  ];

  return (
    <Layout user={user}>
      {/* Header */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
              {group.title}
            </h1>
            <p style={{ color: '#6b7280', margin: '0.25rem 0 0 0' }}>
              {group.course_title}
            </p>
          </div>
          {user.role === 'admin' && (
            <button className="btn btn-secondary" onClick={() => router.push(`/groups/${groupId}/edit`)}>
              {uk.actions.edit}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', gap: '0' }}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '1rem 1.5rem',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                  color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                  fontWeight: activeTab === tab.id ? '500' : '400',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {uk.table.id}
                  </h3>
                  <p style={{ fontSize: '1rem', margin: 0, fontFamily: 'monospace', color: '#6b7280' }}>
                    {group.public_id}
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {uk.table.schedule}
                  </h3>
                  <p style={{ fontSize: '1rem', margin: 0 }}>
                    {getDayName(group.weekly_day)} {group.start_time}
                    <span style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '0.5rem' }}>
                      ({group.duration_minutes} {uk.plural.minute.many})
                    </span>
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {uk.table.teacher}
                  </h3>
                  <p style={{ fontSize: '1rem', margin: 0 }}>{group.teacher_name}</p>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {uk.common.status}
                  </h3>
                  <span className={`badge ${getStatusBadgeClass(group.status)}`}>
                    {getStatusLabel(group.status)}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {uk.table.students}
                  </h3>
                  <p style={{ fontSize: '1rem', margin: 0 }}>{group.students_count}</p>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {uk.table.price}
                  </h3>
                  <p style={{ fontSize: '1rem', margin: 0 }}>{group.monthly_price} UAH</p>
                </div>

                {group.photos_folder_url && (
                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                      {uk.common.photosFolder}
                    </h3>
                    <a 
                      href={group.photos_folder_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#3b82f6', textDecoration: 'underline' }}
                    >
                      {uk.common.link}
                    </a>
                  </div>
                )}
              </div>

              {group.note && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', marginBottom: '0.5rem' }}>
                    {uk.common.note}
                  </h3>
                  <p style={{ fontSize: '1rem', margin: 0, whiteSpace: 'pre-wrap' }}>{group.note}</p>
                </div>
              )}
            </div>
          )}

          {/* Students Tab */}
          {activeTab === 'students' && (
            <div>
              {user.role === 'admin' && (
                <div style={{ marginBottom: '1rem' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setShowAddStudentModal(true)}
                  >
                    + {uk.emptyStates.addStudentToGroup}
                  </button>
                </div>
              )}

              {students.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{uk.table.id}</th>
                      <th>{uk.forms.fullName}</th>
                      <th>{uk.table.phone}</th>
                      <th>{uk.table.parent}</th>
                      <th>{uk.table.parentPhone}</th>
                      {user.role === 'admin' && <th>{uk.common.actions}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
                          {student.public_id}
                        </td>
                        <td>
                          <a href={`/students/${student.id}`} style={{ fontWeight: '500' }}>
                            {student.full_name}
                          </a>
                        </td>
                        <td>{student.phone || '—'}</td>
                        <td>{student.parent_name || '—'}</td>
                        <td>{student.parent_phone || '—'}</td>
                        {user.role === 'admin' && (
                          <td>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRemoveStudent(student.student_group_id, student.full_name)}
                            >
                              {uk.actions.remove}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <h3 className="empty-state-title">{uk.emptyStates.noStudentsInGroup}</h3>
                  {user.role === 'admin' && (
                    <button 
                      className="btn btn-primary"
                      onClick={() => setShowAddStudentModal(true)}
                    >
                      {uk.emptyStates.addStudentToGroup}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Lessons Tab (placeholder) */}
          {activeTab === 'lessons' && (
            <div className="empty-state">
              <h3 className="empty-state-title">{uk.emptyStates.noLessons}</h3>
              <p className="empty-state-text">Функціонал у розробці</p>
            </div>
          )}

          {/* Attendance Tab (placeholder) */}
          {activeTab === 'attendance' && (
            <div className="empty-state">
              <h3 className="empty-state-title">{uk.reports.attendance}</h3>
              <p className="empty-state-text">Функціонал у розробці</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddStudentModal && (
        <div className="modal-overlay" onClick={() => setShowAddStudentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{uk.modals.addStudentToGroup}</h2>
              <button className="modal-close" onClick={() => setShowAddStudentModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                className="form-input"
                placeholder={`${uk.actions.search}...`}
                value={studentSearch}
                onChange={(e) => handleSearchStudents(e.target.value)}
                autoFocus
              />
              
              {searching && <p style={{ padding: '1rem 0', color: '#6b7280' }}>{uk.common.loading}</p>}
              
              {searchResults.length > 0 && (
                <div style={{ marginTop: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {searchResults.map((student) => (
                    <div
                      key={student.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        borderBottom: '1px solid #e5e7eb',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleAddStudent(student.id)}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: '500' }}>{student.full_name}</p>
                        {student.phone && (
                          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{student.phone}</p>
                        )}
                      </div>
                      <button className="btn btn-primary btn-sm">{uk.actions.add}</button>
                    </div>
                  ))}
                </div>
              )}
              
              {studentSearch.length >= 2 && !searching && searchResults.length === 0 && (
                <p style={{ padding: '1rem 0', color: '#6b7280', textAlign: 'center' }}>
                  {uk.emptyStates.noStudents}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
