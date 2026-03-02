'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Calendar, Clock, Users, BookOpen, User, Plus, Check, Search, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

interface Group {
  id: number;
  title: string;
  courseTitle: string;
}

interface Student {
  id: number;
  name: string;
  phone?: string;
}

interface Course {
  id: number;
  title: string;
}

interface Teacher {
  id: number;
  name: string;
}

interface CreateLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
}

export default function CreateLessonModal({ isOpen, onClose, onSuccess, initialDate }: CreateLessonModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  
  // Form state
  const [lessonDate, setLessonDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [selectionMode, setSelectionMode] = useState<'group' | 'students'>('group');
  
  // Dropdowns
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  
  // Load initial data
  useEffect(() => {
    if (isOpen) {
      loadGroups();
      loadCourses();
      loadTeachers();
      loadStudents('');
    }
  }, [isOpen]);
  
  const loadGroups = async () => {
    try {
      const res = await fetch('/api/groups?status=active');
      const data = await res.json();
      const groupsWithCourse = await Promise.all(
        (data.groups || []).map(async (g: any) => {
          const courseRes = await fetch(`/api/courses/${g.course_id}`);
          const courseData = await courseRes.json();
          return {
            ...g,
            courseTitle: courseData.course?.title || 'Курс'
          };
        })
      );
      setGroups(groupsWithCourse);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };
  
  const loadCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load courses:', err);
    }
  };
  
  const loadTeachers = async () => {
    try {
      const res = await fetch('/api/teachers');
      const data = await res.json();
      setTeachers(data || []);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  };
  
  const loadStudents = async (search: string) => {
    setStudentsLoading(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(search)}&limit=20`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setStudentsLoading(false);
    }
  };
  
  // Update course when group is selected
  const handleGroupSelect = (group: Group) => {
    setGroupId(group.id);
    setCourseId(null);
    setSelectedStudentIds([]);
    setShowGroupDropdown(false);
  };
  
  // Update course when course is manually selected
  const handleCourseSelect = (course: Course) => {
    setCourseId(course.id);
    setShowCourseDropdown(false);
  };
  
  // Toggle student selection
  const toggleStudent = (studentId: number) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };
  
  // Search students with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (studentSearch) {
        loadStudents(studentSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);
  
  // Get selected items for display
  const selectedGroup = groups.find(g => g.id === groupId);
  const selectedCourse = courses.find(c => c.id === courseId);
  const selectedTeacher = teachers.find(t => t.id === teacherId);
  const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));
  
  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!lessonDate || !startTime || !durationMinutes || !teacherId) {
      setError('Заповніть всі обов\'язкові поля');
      return;
    }
    
    if (selectionMode === 'group' && !groupId) {
      setError('Оберіть групу');
      return;
    }
    
    if (selectionMode === 'students' && selectedStudentIds.length === 0) {
      setError('Оберіть хоча б одного учня');
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await fetch('/api/lessons/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonDate,
          startTime,
          durationMinutes,
          courseId: courseId || (selectedGroup ? undefined : null),
          teacherId,
          groupId: selectionMode === 'group' ? groupId : null,
          studentIds: selectionMode === 'students' ? selectedStudentIds : []
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        onSuccess();
        onClose();
        resetForm();
      } else {
        setError(data.error || 'Не вдалося створити заняття');
      }
    } catch (err) {
      setError('Сталася помилка при створенні заняття');
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setLessonDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('10:00');
    setDurationMinutes(60);
    setCourseId(null);
    setTeacherId(null);
    setGroupId(null);
    setSelectedStudentIds([]);
    setSelectionMode('group');
    setError(null);
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: '1rem',
      }}
      onClick={handleClose}
    >
      <div 
        className="card"
        style={{ 
          width: '100%', 
          maxWidth: '520px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="card-body" style={{ padding: '1.5rem' }}>
          {/* Header */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 600, 
              color: '#111827',
              margin: 0
            }}>
              Створити заняття
            </h3>
            <button
              onClick={handleClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.375rem',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#111827';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              color: '#dc2626',
              fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            {/* Selection Mode Toggle */}
            <div style={{
              display: 'flex',
              gap: '0.5rem',
              marginBottom: '1.25rem'
            }}>
              <button
                type="button"
                onClick={() => setSelectionMode('group')}
                style={{
                  flex: 1,
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  border: `1.5px solid ${selectionMode === 'group' ? '#3b82f6' : '#e5e7eb'}`,
                  background: selectionMode === 'group' ? '#eff6ff' : 'white',
                  color: selectionMode === 'group' ? '#1d4ed8' : '#6b7280',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Users size={16} />
                Група
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('students')}
                style={{
                  flex: 1,
                  padding: '0.625rem 1rem',
                  borderRadius: '0.5rem',
                  border: `1.5px solid ${selectionMode === 'students' ? '#3b82f6' : '#e5e7eb'}`,
                  background: selectionMode === 'students' ? '#eff6ff' : 'white',
                  color: selectionMode === 'students' ? '#1d4ed8' : '#6b7280',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <User size={16} />
                Окремі учні
              </button>
            </div>
            
            {/* Group or Students Selection */}
            {selectionMode === 'group' ? (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Група <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowGroupDropdown(!showGroupDropdown)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1.5px solid #e5e7eb',
                      background: 'white',
                      color: selectedGroup ? '#111827' : '#9ca3af',
                      fontSize: '0.875rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}>
                      {selectedGroup ? `${selectedGroup.title} (${selectedGroup.courseTitle})` : 'Оберіть групу'}
                    </span>
                    <ChevronDown size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  </button>
                  
                  {showGroupDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.25rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      maxHeight: '200px',
                      overflow: 'auto',
                      zIndex: 10
                    }}>
                      {groups.length === 0 ? (
                        <div style={{
                          padding: '1rem',
                          textAlign: 'center',
                          color: '#9ca3af',
                          fontSize: '0.875rem'
                        }}>
                          Немає активних груп
                        </div>
                      ) : (
                        groups.map(group => (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() => handleGroupSelect(group)}
                            style={{
                              width: '100%',
                              padding: '0.625rem 1rem',
                              border: 'none',
                              background: group.id === groupId ? '#eff6ff' : 'white',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: '#111827',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (group.id !== groupId) e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              if (group.id !== groupId) e.currentTarget.style.background = 'white';
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{group.title}</div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
                              {group.courseTitle}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Учні <span style={{ color: '#ef4444' }}>*</span>
                  {selectedStudentIds.length > 0 && (
                    <span style={{ 
                      marginLeft: '0.5rem', 
                      background: '#3b82f6', 
                      color: 'white', 
                      padding: '0.125rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem'
                    }}>
                      {selectedStudentIds.length}
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    padding: '0.625rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1.5px solid #e5e7eb',
                    background: 'white',
                    minHeight: '42px'
                  }}>
                    {selectedStudents.length > 0 ? (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '0.25rem' 
                      }}>
                        {selectedStudents.map(student => (
                          <span
                            key={student.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              background: '#eff6ff',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem',
                              color: '#1d4ed8'
                            }}
                          >
                            {student.name}
                            <button
                              type="button"
                              onClick={() => toggleStudent(student.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                color: '#1d4ed8'
                              }}
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                        Оберіть учнів
                      </span>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => setShowStudentDropdown(!showStudentDropdown)}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      color: '#6b7280'
                    }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  
                  {showStudentDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.25rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      maxHeight: '240px',
                      overflow: 'hidden',
                      zIndex: 10
                    }}>
                      <div style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          position: 'relative'
                        }}>
                          <Search 
                            size={14} 
                            style={{
                              position: 'absolute',
                              left: '0.75rem',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#9ca3af'
                            }} 
                          />
                          <input
                            type="text"
                            placeholder="Пошук учнів..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem 0.75rem 0.5rem 2rem',
                              border: '1px solid #e5e7eb',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                      <div style={{
                        maxHeight: '180px',
                        overflow: 'auto'
                      }}>
                        {studentsLoading ? (
                          <div style={{
                            padding: '1rem',
                            textAlign: 'center',
                            color: '#9ca3af',
                            fontSize: '0.875rem'
                          }}>
                            Завантаження...
                          </div>
                        ) : students.length === 0 ? (
                          <div style={{
                            padding: '1rem',
                            textAlign: 'center',
                            color: '#9ca3af',
                            fontSize: '0.875rem'
                          }}>
                            Учні не знайдені
                          </div>
                        ) : (
                          students.map(student => (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => toggleStudent(student.id)}
                              style={{
                                width: '100%',
                                padding: '0.625rem 1rem',
                                border: 'none',
                                background: selectedStudentIds.includes(student.id) ? '#eff6ff' : 'white',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                color: '#111827',
                                borderBottom: '1px solid #f3f4f6',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'background 0.15s ease'
                              }}
                            >
                              <span>{student.name}</span>
                              {selectedStudentIds.includes(student.id) && (
                                <Check size={16} style={{ color: '#3b82f6' }} />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Date */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Дата <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={16} style={{
                  position: 'absolute',
                  left: '1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem 0.625rem 2.5rem',
                    borderRadius: '0.5rem',
                    border: '1.5px solid #e5e7eb',
                    fontSize: '0.875rem',
                    color: '#111827',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
            
            {/* Time and Duration Row */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '1rem',
              marginBottom: '1.25rem'
            }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Час <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Clock size={16} style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 1rem 0.625rem 2.5rem',
                      borderRadius: '0.5rem',
                      border: '1.5px solid #e5e7eb',
                      fontSize: '0.875rem',
                      color: '#111827',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Тривалість <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1.5px solid #e5e7eb',
                    fontSize: '0.875rem',
                    color: '#111827',
                    outline: 'none',
                    background: 'white',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value={30}>30 хв</option>
                  <option value={45}>45 хв</option>
                  <option value={60}>1 година</option>
                  <option value={90}>1.5 години</option>
                  <option value={120}>2 години</option>
                  <option value={180}>3 години</option>
                </select>
              </div>
            </div>
            
            {/* Course (only when students selected) */}
            {selectionMode === 'students' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  Курс <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowCourseDropdown(!showCourseDropdown)}
                    style={{
                      width: '100%',
                      padding: '0.625rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1.5px solid #e5e7eb',
                      background: 'white',
                      color: selectedCourse ? '#111827' : '#9ca3af',
                      fontSize: '0.875rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>
                      {selectedCourse ? selectedCourse.title : 'Оберіть курс'}
                    </span>
                    <ChevronDown size={16} style={{ color: '#9ca3af' }} />
                  </button>
                  
                  {showCourseDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '0.25rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      maxHeight: '200px',
                      overflow: 'auto',
                      zIndex: 10
                    }}>
                      {courses.length === 0 ? (
                        <div style={{
                          padding: '1rem',
                          textAlign: 'center',
                          color: '#9ca3af',
                          fontSize: '0.875rem'
                        }}>
                          Немає курсів
                        </div>
                      ) : (
                        courses.map(course => (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => handleCourseSelect(course)}
                            style={{
                              width: '100%',
                              padding: '0.625rem 1rem',
                              border: 'none',
                              background: course.id === courseId ? '#eff6ff' : 'white',
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              color: '#111827',
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            {course.title}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Teacher */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Викладач <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowTeacherDropdown(!showTeacherDropdown)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 1rem',
                    borderRadius: '0.5rem',
                    border: '1.5px solid #e5e7eb',
                    background: 'white',
                    color: selectedTeacher ? '#111827' : '#9ca3af',
                    fontSize: '0.875rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={14} />
                    {selectedTeacher ? selectedTeacher.name : 'Оберіть викладача'}
                  </span>
                  <ChevronDown size={16} style={{ color: '#9ca3af' }} />
                </button>
                
                {showTeacherDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    maxHeight: '200px',
                    overflow: 'auto',
                    zIndex: 10
                  }}>
                    {teachers.length === 0 ? (
                      <div style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: '#9ca3af',
                        fontSize: '0.875rem'
                      }}>
                        Немає викладачів
                      </div>
                    ) : (
                      teachers.map(teacher => (
                        <button
                          key={teacher.id}
                          type="button"
                          onClick={() => {
                            setTeacherId(teacher.id);
                            setShowTeacherDropdown(false);
                          }}
                          style={{
                            width: '100%',
                            padding: '0.625rem 1rem',
                            border: 'none',
                            background: teacher.id === teacherId ? '#eff6ff' : 'white',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            color: '#111827',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <User size={14} style={{ color: '#6b7280' }} />
                          {teacher.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Submit Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ 
                  flex: 1, 
                  fontSize: '0.875rem', 
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {loading ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid white',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    Створення...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Створити заняття
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                style={{ 
                  fontSize: '0.875rem', 
                  padding: '0.75rem 1.25rem'
                }}
              >
                Скасувати
              </button>
            </div>
          </form>
          
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
