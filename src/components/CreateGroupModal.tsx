'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { uk } from '@/i18n/uk';

interface Course {
  id: number;
  title: string;
}

interface Teacher {
  id: number;
  name: string;
}

interface AvailableStudent {
  id: number;
  full_name: string;
  public_id: string;
}

interface User {
  id: number;
  role: string;
  name: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (groupId: number) => void;
  initialStudents?: AvailableStudent[];
}

export default function CreateGroupModal({ isOpen, onClose, onSuccess, initialStudents = [] }: CreateGroupModalProps) {
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  // Form State
  const [newGroupCourseId, setNewGroupCourseId] = useState('');
  const [newGroupTeacherId, setNewGroupTeacherId] = useState('');
  const [newGroupWeeklyDay, setNewGroupWeeklyDay] = useState('');
  const [newGroupStartTime, setNewGroupStartTime] = useState('');
  const [newGroupNote, setNewGroupNote] = useState('');
  const [newGroupStartDate, setNewGroupStartDate] = useState('');
  
  // Students State
  const [selectedStudents, setSelectedStudents] = useState<AvailableStudent[]>([]);
  const [allStudents, setAllStudents] = useState<AvailableStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titlePreview, setTitlePreview] = useState('');

  // Use ref to avoid infinite re-render loop when initialStudents changes reference
  const initialStudentsRef = useRef(initialStudents);
  initialStudentsRef.current = initialStudents;

  // Initial load
  useEffect(() => {
    if (isOpen) {
      setSelectedStudents([...initialStudentsRef.current]);
      resetForm();
      const today = new Date().toISOString().split('T')[0];
      setNewGroupStartDate(today);
      fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchData = async () => {
    try {
      const authRes = await fetch('/api/auth/me');
      if (authRes.ok) {
        const authData = await authRes.json();
        setUser(authData.user);
        
        if (authData.user.role === 'admin') {
          const teachersRes = await fetch('/api/teachers');
          const teachersData = await teachersRes.json();
          setTeachers(Array.isArray(teachersData) ? teachersData : []);
        }
      }

      const coursesRes = await fetch('/api/courses');
      const coursesData = await coursesRes.json();
      setCourses(coursesData.courses || []);

      const studentsRes = await fetch('/api/students');
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setAllStudents(studentsData.students || []);
      }
    } catch (err) {
      console.error('Failed to fetch modal data:', err);
    }
  };

  // Title Preview
  useEffect(() => {
    if (newGroupCourseId && newGroupWeeklyDay && newGroupStartTime) {
      const course = courses.find(c => c.id === parseInt(newGroupCourseId));
      const dayShort = uk.daysShort[parseInt(newGroupWeeklyDay) as keyof typeof uk.daysShort];
      if (course && dayShort) {
        setTitlePreview(`${dayShort} ${newGroupStartTime} ${course.title}`);
      }
    } else {
      setTitlePreview('');
    }
  }, [newGroupCourseId, newGroupWeeklyDay, newGroupStartTime, courses]);

  const filteredStudents = allStudents.filter(s => {
    if (selectedStudents.some(selected => selected.id === s.id)) return false;
    if (!searchQuery.trim()) return true;
    return s.full_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleAddStudent = (student: AvailableStudent) => {
    setSelectedStudents(prev => [...prev, student]);
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleRemoveStudent = (studentId: number) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const resetForm = () => {
    setNewGroupCourseId('');
    setNewGroupTeacherId('');
    setNewGroupWeeklyDay('');
    setNewGroupStartTime('');
    setNewGroupNote('');
    setError(null);
    setTitlePreview('');
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!newGroupCourseId) return setError(uk.validation.selectCourse);
    if (!newGroupWeeklyDay) return setError(uk.validation.selectDay);
    if (!newGroupStartTime) return setError(uk.validation.selectTime);
    if (!newGroupTeacherId) return setError(uk.validation.selectTeacher);

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(newGroupStartTime)) return setError(uk.validation.invalidTime);

    setSaving(true);
    try {
      const studentIds = selectedStudents.map(s => s.id);
      
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(newGroupCourseId),
          teacher_id: parseInt(newGroupTeacherId),
          weekly_day: parseInt(newGroupWeeklyDay),
          start_time: newGroupStartTime,
          status: 'active', // Hardcoded as requested
          note: newGroupNote || null,
          photos_folder_url: null, // Hardcoded as requested
          start_date: newGroupStartDate || null,
          student_ids: studentIds // <-- We'll read this in the API
        }),
      });

      const data = await res.json();

      if (res.ok) {
        onClose();
        if (onSuccess) {
          onSuccess(data.id);
        } else {
          router.push(`/groups/${data.id}`);
        }
      } else {
        setError(data.error || uk.toasts.error);
      }
    } catch (err) {
      console.error('Group creation error:', err);
      setError(uk.toasts.error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh' }}>
        <div className="modal-header" style={{ 
          padding: '1.25rem 1.5rem', 
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#f9fafb',
          borderRadius: '12px 12px 0 0'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#111827' }}>
            {uk.modals.newGroup}
          </h2>
          <button 
            className="modal-close" 
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
              color: '#6b7280', backgroundColor: 'transparent', border: 'none',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ padding: '1.5rem', overflowY: 'auto', maxHeight: 'calc(90vh - 180px)' }}>
            {error && (
              <div style={{ padding: '0.875rem 1rem', marginBottom: '1.25rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            {titlePreview && (
              <div style={{ padding: '1rem', marginBottom: '1.5rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#1d4ed8', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                  {uk.forms.groupTitle}
                </p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem', fontWeight: '600', color: '#1e40af' }}>
                  {titlePreview}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', fontSize: '0.9rem' }}>
                {uk.forms.course} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="form-input"
                value={newGroupCourseId}
                onChange={(e) => setNewGroupCourseId(e.target.value)}
                required
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#fff' }}
              >
                <option value="">{uk.forms.selectCourse}</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', fontSize: '0.9rem' }}>
                  {uk.forms.dayOfWeek} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={newGroupWeeklyDay}
                  onChange={(e) => setNewGroupWeeklyDay(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#fff' }}
                >
                  <option value="">{uk.forms.selectDay}</option>
                  {Object.entries(uk.days).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', fontSize: '0.9rem' }}>
                  {uk.forms.startTime} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="time"
                  className="form-input"
                  value={newGroupStartTime}
                  onChange={(e) => setNewGroupStartTime(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#fff' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', fontSize: '0.9rem' }}>
                {uk.forms.teacher} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="form-input"
                value={newGroupTeacherId}
                onChange={(e) => setNewGroupTeacherId(e.target.value)}
                required
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#fff' }}
              >
                <option value="">{uk.forms.selectTeacher}</option>
                {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', fontSize: '0.9rem' }}>
                {uk.forms.startDate}
              </label>
              <input
                type="date"
                className="form-input"
                value={newGroupStartDate}
                onChange={(e) => setNewGroupStartDate(e.target.value)}
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#fff' }}
              />
            </div>

            {/* Students Selection Section */}
            <div style={{ marginBottom: '1.25rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: '#fafafa' }}>
              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '500', color: '#374151', fontSize: '0.95rem' }}>
                Учні в групі
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 'normal' }}>
                  ({selectedStudents.length})
                </span>
              </label>

              {/* Selected Students List */}
              {selectedStudents.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {selectedStudents.map(student => (
                    <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                      <div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{student.full_name}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>#{student.public_id}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(student.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                        title="Видалити"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search to add more */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Пошук або вибір учня..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}
                />

                {/* Dropdown Results */}
                {isDropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', inset: 0, zIndex: 9 }} 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.25rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map(student => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleAddStudent(student)}
                            style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', border: 'none', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <div>
                              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{student.full_name}</span>
                              <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>#{student.public_id}</span>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                        ))
                      ) : (
                        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                          Учнів не знайдено (або всі додані)
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#374151', fontSize: '0.9rem' }}>
                {uk.forms.note}
              </label>
              <textarea
                className="form-input"
                value={newGroupNote}
                onChange={(e) => setNewGroupNote(e.target.value)}
                rows={2}
                placeholder={uk.common.note}
                style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem', backgroundColor: '#fff', resize: 'vertical', minHeight: '60px' }}
              />
            </div>
          </div>

          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0 0 12px 12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: '500', fontSize: '0.9rem' }}
            >
              {uk.actions.cancel}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ padding: '0.625rem 1.5rem', borderRadius: '8px', fontWeight: '500', fontSize: '0.9rem', backgroundColor: '#2563eb' }}
            >
              {saving ? uk.common.saving : uk.actions.create}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
