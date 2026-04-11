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

  const [newGroupCourseId, setNewGroupCourseId] = useState('');
  const [newGroupTeacherId, setNewGroupTeacherId] = useState('');
  const [newGroupWeeklyDay, setNewGroupWeeklyDay] = useState('');
  const [newGroupStartTime, setNewGroupStartTime] = useState('');
  const [newGroupNote, setNewGroupNote] = useState('');
  const [newGroupStartDate, setNewGroupStartDate] = useState('');

  const [selectedStudents, setSelectedStudents] = useState<AvailableStudent[]>([]);
  const [dropdownStudents, setDropdownStudents] = useState<AvailableStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titlePreview, setTitlePreview] = useState('');
  const [groupFormStep, setGroupFormStep] = useState<'schedule' | 'students' | 'extra'>('schedule');

  const initialStudentsRef = useRef(initialStudents);
  initialStudentsRef.current = initialStudents;

  useEffect(() => {
    if (isOpen) {
      setSelectedStudents([...initialStudentsRef.current]);
      resetForm();
      setGroupFormStep('schedule');
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
    } catch (err) {
      console.error('Failed to fetch modal data:', err);
    }
  };

  const fetchStudents = async (query: string = '') => {
    setSearchingStudents(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set('search', query.trim());
      }
      params.set('limit', '30');
      const res = await fetch(`/api/students?${params}`);
      if (res.ok) {
        const data = await res.json();
        const selectedIds = new Set(selectedStudents.map((s) => s.id));
        const filtered = (data.students || []).filter((s: AvailableStudent) => !selectedIds.has(s.id));
        setDropdownStudents(filtered);
      }
    } catch (err) {
      console.error('Student search failed:', err);
    } finally {
      setSearchingStudents(false);
    }
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setIsDropdownOpen(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchStudents(query);
    }, 300);
  };

  const handleDropdownOpen = () => {
    if (!isDropdownOpen) {
      setIsDropdownOpen(true);
      fetchStudents(searchQuery);
    }
  };

  useEffect(() => {
    if (newGroupCourseId && newGroupWeeklyDay && newGroupStartTime) {
      const course = courses.find((c) => c.id === parseInt(newGroupCourseId));
      const dayShort = uk.daysShort[parseInt(newGroupWeeklyDay) as keyof typeof uk.daysShort];
      if (course && dayShort) {
        setTitlePreview(`${dayShort} ${newGroupStartTime} ${course.title}`);
      }
    } else {
      setTitlePreview('');
    }
  }, [newGroupCourseId, newGroupWeeklyDay, newGroupStartTime, courses]);

  const handleAddStudent = (student: AvailableStudent) => {
    setSelectedStudents((prev) => [...prev, student]);
    setDropdownStudents((prev) => prev.filter((s) => s.id !== student.id));
    setSearchQuery('');
  };

  const handleRemoveStudent = (studentId: number) => {
    setSelectedStudents((prev) => prev.filter((s) => s.id !== studentId));
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
    setDropdownStudents([]);
    setIsDropdownOpen(false);
    setGroupFormStep('schedule');
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  };

  const closeModal = () => {
    setGroupFormStep('schedule');
    onClose();
  };

  const handleCreateGroup = async () => {
    setError(null);

    if (!newGroupCourseId) return setError(uk.validation.selectCourse);
    if (!newGroupWeeklyDay) return setError(uk.validation.selectDay);
    if (!newGroupStartTime) return setError(uk.validation.selectTime);
    if (!newGroupTeacherId) return setError(uk.validation.selectTeacher);

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(newGroupStartTime)) return setError(uk.validation.invalidTime);

    setSaving(true);
    try {
      const studentIds = selectedStudents.map((s) => s.id);

      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: parseInt(newGroupCourseId),
          teacher_id: parseInt(newGroupTeacherId),
          weekly_day: parseInt(newGroupWeeklyDay),
          start_time: newGroupStartTime,
          status: 'active',
          note: newGroupNote || null,
          photos_folder_url: null,
          start_date: newGroupStartDate || null,
          student_ids: studentIds,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        closeModal();
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

  const stepMeta = {
    schedule: 'Крок 1 з 3 · Розклад групи',
    students: 'Крок 2 з 3 · Склад групи',
    extra: 'Крок 3 з 3 · Завершення',
  } as const;

  const goToNextStep = () => {
    setGroupFormStep((prev) => (prev === 'schedule' ? 'students' : 'extra'));
  };

  const goToPreviousStep = () => {
    setGroupFormStep((prev) => (prev === 'extra' ? 'students' : 'schedule'));
  };

  return (
    <div className="modal-overlay" onClick={closeModal} style={{ zIndex: 100 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '820px',
          maxHeight: '90vh',
          overflow: groupFormStep === 'students' ? 'visible' : 'hidden',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          backgroundColor: '#f7f9fc',
          boxShadow: '0 28px 70px rgba(15, 23, 42, 0.16)',
        }}
      >
        <div
          className="modal-header"
          style={{
            alignItems: 'flex-start',
            padding: '1.4rem 1.5rem 1.2rem',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%)',
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.35rem 0.75rem', borderRadius: '999px', backgroundColor: '#eaf2ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.85rem' }}>
              Нова група
            </div>
            <h3 className="modal-title" style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
              {uk.modals.newGroup}
            </h3>
          </div>
          <button className="modal-close" onClick={closeModal} style={{ fontSize: '1.75rem', lineHeight: 1, padding: '0.25rem', color: '#94a3b8' }}>
            ×
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          <div
            className="modal-body"
            style={{
              padding: '1.5rem',
              overflowY: groupFormStep === 'students' ? 'visible' : 'auto',
              maxHeight: groupFormStep === 'students' ? undefined : 'calc(92vh - 235px)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {([
                { id: 'schedule', index: '01', title: 'Розклад', description: 'Курс, день, час, викладач' },
                { id: 'students', index: '02', title: 'Учні', description: 'Додайте склад групи' },
                { id: 'extra', index: '03', title: 'Додатково', description: 'Старт і примітка' },
              ] as const).map((step) => {
                const isActive = groupFormStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setGroupFormStep(step.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.8rem',
                      width: '100%',
                      padding: '0.95rem 1rem',
                      borderRadius: '18px',
                      border: isActive ? '1px solid #93c5fd' : '1px solid #dbe4f0',
                      backgroundColor: isActive ? '#ffffff' : 'rgba(255,255,255,0.72)',
                      boxShadow: isActive ? '0 10px 24px rgba(37, 99, 235, 0.12)' : 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', flexShrink: 0, borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 700, backgroundColor: isActive ? '#2563eb' : '#eaf2ff', color: isActive ? '#ffffff' : '#2563eb' }}>
                      {step.index}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#0f172a' }}>{step.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.35 }}>{step.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {error && (
              <div style={{ padding: '0.875rem 1rem', marginBottom: '1rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '14px', border: '1px solid #fecaca', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            {groupFormStep === 'schedule' && (
              <>
                {titlePreview && (
                  <div style={{ padding: '0.85rem 1rem', backgroundColor: '#eff6ff', borderRadius: '18px', border: '1px solid #bfdbfe', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                      {uk.forms.groupTitle}
                    </p>
                    <p style={{ margin: '0.35rem 0 0 0', fontSize: '1.1rem', fontWeight: 700, color: '#1e40af' }}>
                      {titlePreview}
                    </p>
                  </div>
                )}

                <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.5rem' }}>
                  <div className="form-group" style={{ margin: '0 0 1.25rem' }}>
                    <label className="form-label">{uk.forms.course} *</label>
                    <select className="form-input" value={newGroupCourseId} onChange={(e) => setNewGroupCourseId(e.target.value)} required>
                      <option value="">{uk.forms.selectCourse}</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{uk.forms.dayOfWeek} *</label>
                      <select className="form-input" value={newGroupWeeklyDay} onChange={(e) => setNewGroupWeeklyDay(e.target.value)} required>
                        <option value="">{uk.forms.selectDay}</option>
                        {Object.entries(uk.days).map(([key, value]) => (
                          <option key={key} value={key}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{uk.forms.startTime} *</label>
                      <input type="time" className="form-input" value={newGroupStartTime} onChange={(e) => setNewGroupStartTime(e.target.value)} required />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{uk.forms.teacher} *</label>
                    <select className="form-input" value={newGroupTeacherId} onChange={(e) => setNewGroupTeacherId(e.target.value)} required>
                      <option value="">{uk.forms.selectTeacher}</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {groupFormStep === 'students' && (
              <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Учні в групі</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                      Додавайте учнів одразу під час створення або залиште це на потім.
                    </div>
                  </div>
                  <div style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', backgroundColor: '#eef2ff', color: '#4338ca', fontSize: '0.8rem', fontWeight: 700 }}>
                    {selectedStudents.length} обрано
                  </div>
                </div>

                {selectedStudents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {selectedStudents.map((student) => (
                      <div key={student.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0.9rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{student.full_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>#{student.public_id}</div>
                        </div>
                        <button type="button" onClick={() => handleRemoveStudent(student.id)} style={{ background: '#ffffff', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', borderRadius: '8px', padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="Видалити">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Пошук або вибір учня..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onFocus={handleDropdownOpen}
                    />
                    {searchingStudents && (
                      <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    )}
                  </div>

                  {isDropdownOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setIsDropdownOpen(false)} />
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '0.4rem', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.375rem', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', zIndex: 10, maxHeight: '280px', overflowY: 'auto' }}>
                        {searchingStudents && dropdownStudents.length === 0 ? (
                          <div style={{ padding: '0.9rem', fontSize: '0.9rem', color: '#6b7280', textAlign: 'center' }}>Пошук...</div>
                        ) : dropdownStudents.length > 0 ? (
                          dropdownStudents.map((student) => (
                            <button key={student.id} type="button" onClick={() => handleAddStudent(student)} style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.625rem 0.75rem', border: 'none', borderBottom: '1px solid #f3f4f6', backgroundColor: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{student.full_name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>#{student.public_id}</div>
                              </div>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </button>
                          ))
                        ) : (
                          <div style={{ padding: '0.9rem', fontSize: '0.9rem', color: '#6b7280' }}>
                            Учнів не знайдено або всі вже додані.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {groupFormStep === 'extra' && (
              <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '1.5rem' }}>
                <div className="form-group" style={{ margin: '0 0 1.25rem' }}>
                  <label className="form-label">{uk.forms.startDate}</label>
                  <input type="date" className="form-input" value={newGroupStartDate} onChange={(e) => setNewGroupStartDate(e.target.value)} />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{uk.forms.note}</label>
                  <textarea className="form-input" value={newGroupNote} onChange={(e) => setNewGroupNote(e.target.value)} rows={4} placeholder={uk.common.note} style={{ resize: 'vertical', minHeight: '110px' }} />
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '1rem 1.5rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', backgroundColor: 'rgba(255,255,255,0.92)' }}>
            <div style={{ color: '#64748b', fontSize: '0.9rem' }}>{stepMeta[groupFormStep]}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                {uk.actions.cancel}
              </button>

              {groupFormStep !== 'schedule' && (
                <button type="button" className="btn btn-secondary" onClick={goToPreviousStep} disabled={saving}>
                  Назад
                </button>
              )}

              {groupFormStep !== 'extra' ? (
                <button type="button" className="btn btn-primary" onClick={goToNextStep}>
                  Далі
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={saving} onClick={handleCreateGroup}>
                  {saving ? uk.common.saving : uk.actions.create}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

