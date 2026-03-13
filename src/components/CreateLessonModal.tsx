'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Calendar, Clock, User, Plus, Check, Search, ChevronDown,
  AlertCircle, RefreshCw, BookOpen, Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Student {
  id: number;
  full_name: string;
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

interface AbsenceRecord {
  attendance_id: number;
  student_id: number;
  student_name: string;
  status: 'absent' | 'makeup_planned';
  lesson_id: number;
  lesson_date: string;
  lesson_start_time: string | null;
  group_id: number | null;
  group_title: string | null;
  course_title: string | null;
}

interface CreateLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  initialTab?: ModalTab;
  initialAbsenceIds?: number[];
}

type ModalTab = 'lesson' | 'makeup';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLessonDate(isoDate: string) {
  try {
    return format(parseISO(isoDate), 'd MMM yyyy', { locale: uk });
  } catch {
    return isoDate;
  }
}

function formatStartTime(isoDatetime: string | null) {
  if (!isoDatetime) return '';
  try {
    return format(parseISO(isoDatetime), 'HH:mm');
  } catch {
    return '';
  }
}

// ─── Shared styles (static — defined outside to avoid recreation) ─────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 1rem',
  borderRadius: '0.5rem',
  border: '1.5px solid #e5e7eb',
  fontSize: '0.875rem',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
  background: 'white',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '0.5rem',
};

const dropdownContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  marginTop: '0.25rem',
  background: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '0.5rem',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  maxHeight: '200px',
  overflow: 'auto',
  zIndex: 20,
};

const dropdownItemStyle = (active: boolean): React.CSSProperties => ({
  width: '100%',
  padding: '0.625rem 1rem',
  border: 'none',
  background: active ? '#eff6ff' : 'white',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: '0.875rem',
  color: '#111827',
  borderBottom: '1px solid #f3f4f6',
  transition: 'background 0.15s ease',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

// ─── Sub-components (defined outside to prevent remount on parent re-render) ──

function DateTimeRow({
  date, onDate, time, onTime, duration, onDuration,
}: {
  date: string; onDate: (v: string) => void;
  time: string; onTime: (v: string) => void;
  duration: number; onDuration: (v: number) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
      <div>
        <label style={labelStyle}>Дата <span style={{ color: '#ef4444' }}>*</span></label>
        <div style={{ position: 'relative' }}>
          <Calendar size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="date"
            value={date}
            onChange={e => onDate(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.25rem' }}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Час <span style={{ color: '#ef4444' }}>*</span></label>
        <div style={{ position: 'relative' }}>
          <Clock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="time"
            value={time}
            onChange={e => onTime(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '2.25rem' }}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Тривалість <span style={{ color: '#ef4444' }}>*</span></label>
        <select
          value={duration}
          onChange={e => onDuration(Number(e.target.value))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value={30}>30 хв</option>
          <option value={45}>45 хв</option>
          <option value={60}>1 год</option>
          <option value={90}>1.5 год</option>
          <option value={120}>2 год</option>
          <option value={180}>3 год</option>
        </select>
      </div>
    </div>
  );
}

function TeacherDropdown({
  teachers, value, onChange, show, onToggle,
}: {
  teachers: Teacher[];
  value: number | null;
  onChange: (id: number) => void;
  show: boolean;
  onToggle: () => void;
}) {
  const selected = teachers.find(t => t.id === value);
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          ...inputStyle,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={14} style={{ color: '#9ca3af' }} />
          <span style={{ color: selected ? '#111827' : '#9ca3af' }}>
            {selected ? selected.name : 'Оберіть викладача'}
          </span>
        </span>
        <ChevronDown size={16} style={{ color: '#9ca3af' }} />
      </button>
      {show && (
        <div style={dropdownContainerStyle}>
          {teachers.length === 0
            ? <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Немає викладачів</div>
            : teachers.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                style={dropdownItemStyle(t.id === value)}
              >
                <User size={14} style={{ color: '#6b7280' }} />
                {t.name}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

function CourseDropdown({
  courses, value, onChange, show, onToggle,
}: {
  courses: Course[];
  value: number | null;
  onChange: (id: number | null) => void;
  show: boolean;
  onToggle: () => void;
}) {
  const selected = courses.find(c => c.id === value);
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          ...inputStyle,
          textAlign: 'left',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={14} style={{ color: '#9ca3af' }} />
          <span style={{ color: selected ? '#111827' : '#9ca3af' }}>
            {selected ? selected.title : "Оберіть курс (необов'язково)"}
          </span>
        </span>
        <ChevronDown size={16} style={{ color: '#9ca3af' }} />
      </button>
      {show && (
        <div style={dropdownContainerStyle}>
          <button
            type="button"
            onClick={() => onChange(null)}
            style={dropdownItemStyle(value === null)}
          >
            <span style={{ color: '#9ca3af' }}>— Без курсу —</span>
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              style={dropdownItemStyle(c.id === value)}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateLessonModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTab,
  initialAbsenceIds,
}: CreateLessonModalProps) {
  const [tab, setTab] = useState<ModalTab>('lesson');

  // ── Shared data ──────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // ── "Нове заняття" tab state ─────────────────────────────────────────────────
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [lessonDate, setLessonDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [courseId, setCourseId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // ── "Відпрацювання" tab state ─────────────────────────────────────────────────
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [absencesLoading, setAbsencesLoading] = useState(false);
  const [absenceSearch, setAbsenceSearch] = useState('');
  const [absenceStatusFilter, setAbsenceStatusFilter] = useState<'all' | 'absent' | 'makeup_planned'>('all');
  const [selectedAbsenceIds, setSelectedAbsenceIds] = useState<number[]>([]);
  const [makeupDate, setMakeupDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [makeupTime, setMakeupTime] = useState('10:00');
  const [makeupDuration, setMakeupDuration] = useState(60);
  const [makeupTeacherId, setMakeupTeacherId] = useState<number | null>(null);
  const [makeupLoading, setMakeupLoading] = useState(false);
  const [makeupError, setMakeupError] = useState<string | null>(null);
  const [showMakeupTeacherDropdown, setShowMakeupTeacherDropdown] = useState(false);

  // ── Load shared data on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    loadCourses();
    loadTeachers();
    loadAllStudents();
  }, [isOpen]);

  // Apply initial tab and pre-selected absences when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) setTab(initialTab);
    if (initialAbsenceIds?.length) setSelectedAbsenceIds(initialAbsenceIds);
  }, [isOpen]);

  // Load absences when switching to makeup tab
  useEffect(() => {
    if (isOpen && tab === 'makeup') {
      loadAbsences();
    }
  }, [isOpen, tab]);

  // ── Data loaders ──────────────────────────────────────────────────────────────

  const loadAllStudents = async () => {
    setStudentsLoading(true);
    try {
      const res = await fetch('/api/students?limit=50');
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      // silent
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadStudentsBySearch = useCallback(async (q: string) => {
    setStudentsLoading(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(q)}&limit=50`);
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      // silent
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const loadCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      setCourses(data.courses || []);
    } catch {
      // silent
    }
  };

  const loadTeachers = async () => {
    try {
      const res = await fetch('/api/teachers');
      const data = await res.json();
      setTeachers(data || []);
    } catch {
      // silent
    }
  };

  const loadAbsences = async () => {
    setAbsencesLoading(true);
    try {
      const res = await fetch('/api/attendance/absences');
      const data = await res.json();
      setAbsences(data.absences || []);
    } catch {
      // silent
    } finally {
      setAbsencesLoading(false);
    }
  };

  // Student search debounce
  useEffect(() => {
    if (!studentSearch) return;
    const t = setTimeout(() => loadStudentsBySearch(studentSearch), 300);
    return () => clearTimeout(t);
  }, [studentSearch, loadStudentsBySearch]);

  // ── Derived values ────────────────────────────────────────────────────────────

  const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));

  const filteredAbsences = absences.filter(a => {
    const matchSearch = !absenceSearch ||
      a.student_name.toLowerCase().includes(absenceSearch.toLowerCase());
    const matchStatus = absenceStatusFilter === 'all' || a.status === absenceStatusFilter;
    return matchSearch && matchStatus;
  });

  const selectedAbsences = absences.filter(a => selectedAbsenceIds.includes(a.attendance_id));
  const selectedStudentNames = Array.from(new Set(selectedAbsences.map(a => a.student_name)));

  // ── Handlers: new lesson tab ──────────────────────────────────────────────────

  const toggleStudent = (id: number) =>
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLessonError(null);
    if (!lessonDate || !startTime || !durationMinutes || !teacherId) {
      setLessonError("Заповніть всі обов'язкові поля");
      return;
    }
    if (selectedStudentIds.length === 0) {
      setLessonError('Оберіть хоча б одного учня');
      return;
    }
    setLessonLoading(true);
    try {
      const res = await fetch('/api/lessons/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonDate,
          startTime,
          durationMinutes,
          courseId,
          teacherId,
          groupId: null,
          studentIds: selectedStudentIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
        resetAll();
      } else {
        setLessonError(data.error || 'Не вдалося створити заняття');
      }
    } catch {
      setLessonError('Сталася помилка при створенні заняття');
    } finally {
      setLessonLoading(false);
    }
  };

  // ── Handlers: makeup tab ──────────────────────────────────────────────────────

  const toggleAbsence = (id: number) =>
    setSelectedAbsenceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const toggleAllFiltered = () => {
    const allIds = filteredAbsences.map(a => a.attendance_id);
    const allSelected = allIds.every(id => selectedAbsenceIds.includes(id));
    if (allSelected) {
      setSelectedAbsenceIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedAbsenceIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };

  const handleMakeupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMakeupError(null);
    if (!makeupDate || !makeupTime || !makeupDuration || !makeupTeacherId) {
      setMakeupError("Заповніть всі обов'язкові поля");
      return;
    }
    if (selectedAbsenceIds.length === 0) {
      setMakeupError('Оберіть хоча б один пропуск');
      return;
    }
    setMakeupLoading(true);
    try {
      const res = await fetch('/api/lessons/makeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonDate: makeupDate,
          startTime: makeupTime,
          durationMinutes: makeupDuration,
          teacherId: makeupTeacherId,
          attendanceIds: selectedAbsenceIds,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
        resetAll();
      } else {
        setMakeupError(data.error || 'Не вдалося створити відпрацювання');
      }
    } catch {
      setMakeupError('Сталася помилка при створенні відпрацювання');
    } finally {
      setMakeupLoading(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────

  const resetAll = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setLessonDate(today);
    setStartTime('10:00');
    setDurationMinutes(60);
    setCourseId(null);
    setTeacherId(null);
    setSelectedStudentIds([]);
    setStudentSearch('');
    setLessonError(null);
    setMakeupDate(today);
    setMakeupTime('10:00');
    setMakeupDuration(60);
    setMakeupTeacherId(null);
    setSelectedAbsenceIds([]);
    setAbsenceSearch('');
    setAbsenceStatusFilter('all');
    setMakeupError(null);
    setTab('lesson');
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  if (!isOpen) return null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: '1rem',
      }}
      onClick={handleClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: '580px', maxHeight: '92vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="card-body" style={{ padding: '1.5rem' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', margin: 0 }}>
              Створити заняття
            </h3>
            <button
              onClick={handleClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#6b7280', borderRadius: '0.375rem', display: 'flex' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#f3f4f6', borderRadius: '0.625rem', padding: '0.25rem' }}>
            {([
              { key: 'lesson', label: 'Нове заняття', icon: <Plus size={15} /> },
              { key: 'makeup', label: 'Відпрацювання', icon: <RefreshCw size={15} /> },
            ] as { key: ModalTab; label: string; icon: React.ReactNode }[]).map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  background: tab === t.key ? 'white' : 'transparent',
                  color: tab === t.key ? '#111827' : '#6b7280',
                  fontWeight: tab === t.key ? 600 : 400,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.375rem',
                  boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* ── TAB: Нове заняття ────────────────────────────────────────────── */}
          {tab === 'lesson' && (
            <form onSubmit={handleLessonSubmit}>
              {lessonError && <ErrorBanner msg={lessonError} />}

              {/* Students */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>
                  Учні <span style={{ color: '#ef4444' }}>*</span>
                  {selectedStudentIds.length > 0 && (
                    <span style={{ marginLeft: '0.5rem', background: '#3b82f6', color: 'white', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem' }}>
                      {selectedStudentIds.length}
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{ ...inputStyle, minHeight: '42px', cursor: 'text' }}>
                    {selectedStudents.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {selectedStudents.map(s => (
                          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: '#eff6ff', borderRadius: '0.25rem', fontSize: '0.75rem', color: '#1d4ed8' }}>
                            {s.full_name}
                            <button type="button" onClick={() => toggleStudent(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#1d4ed8' }}><X size={12} /></button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Оберіть учнів</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStudentDropdown(p => !p)}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#6b7280' }}
                  >
                    <ChevronDown size={16} />
                  </button>
                  {showStudentDropdown && (
                    <div style={{ ...dropdownContainerStyle, maxHeight: '260px' }}>
                      <div style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: 'white' }}>
                        <div style={{ position: 'relative' }}>
                          <Search size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                          <input
                            type="text"
                            placeholder="Пошук..."
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: '2rem', padding: '0.4rem 0.75rem 0.4rem 2rem' }}
                          />
                        </div>
                      </div>
                      <div style={{ maxHeight: '180px', overflow: 'auto' }}>
                        {studentsLoading
                          ? <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Завантаження...</div>
                          : students.length === 0
                            ? <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Не знайдено</div>
                            : students.map(s => (
                              <button key={s.id} type="button" onClick={() => toggleStudent(s.id)}
                                style={dropdownItemStyle(selectedStudentIds.includes(s.id))}>
                                <span style={{ flex: 1 }}>{s.full_name}</span>
                                {selectedStudentIds.includes(s.id) && <Check size={14} style={{ color: '#3b82f6' }} />}
                              </button>
                            ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DateTimeRow
                date={lessonDate} onDate={setLessonDate}
                time={startTime} onTime={setStartTime}
                duration={durationMinutes} onDuration={setDurationMinutes}
              />

              {/* Course */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Курс</label>
                <CourseDropdown
                  courses={courses}
                  value={courseId}
                  onChange={v => { setCourseId(v); setShowCourseDropdown(false); }}
                  show={showCourseDropdown}
                  onToggle={() => setShowCourseDropdown(p => !p)}
                />
              </div>

              {/* Teacher */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Викладач <span style={{ color: '#ef4444' }}>*</span></label>
                <TeacherDropdown
                  teachers={teachers}
                  value={teacherId}
                  onChange={v => { setTeacherId(v); setShowTeacherDropdown(false); }}
                  show={showTeacherDropdown}
                  onToggle={() => setShowTeacherDropdown(p => !p)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" disabled={lessonLoading} className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.875rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {lessonLoading
                    ? <><Spinner /> Створення...</>
                    : <><Plus size={16} /> Створити заняття</>
                  }
                </button>
                <button type="button" onClick={handleClose} className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.75rem 1.25rem' }}>
                  Скасувати
                </button>
              </div>
            </form>
          )}

          {/* ── TAB: Відпрацювання ───────────────────────────────────────────── */}
          {tab === 'makeup' && (
            <form onSubmit={handleMakeupSubmit}>
              {makeupError && <ErrorBanner msg={makeupError} />}

              {/* Search + filter bar */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Пошук учня..."
                    value={absenceSearch}
                    onChange={e => setAbsenceSearch(e.target.value)}
                    style={{ ...inputStyle, paddingLeft: '2rem' }}
                  />
                </div>
                <select
                  value={absenceStatusFilter}
                  onChange={e => setAbsenceStatusFilter(e.target.value as typeof absenceStatusFilter)}
                  style={{ ...inputStyle, width: 'auto', cursor: 'pointer', flexShrink: 0 }}
                >
                  <option value="all">Всі пропуски</option>
                  <option value="absent">Відсутній</option>
                  <option value="makeup_planned">Зап. відпрац.</option>
                </select>
                <button
                  type="button"
                  onClick={loadAbsences}
                  title="Оновити список"
                  style={{ background: 'none', border: '1.5px solid #e5e7eb', borderRadius: '0.5rem', cursor: 'pointer', padding: '0.5rem', color: '#6b7280', display: 'flex', flexShrink: 0 }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Absences list */}
              <div style={{
                border: '1.5px solid #e5e7eb',
                borderRadius: '0.625rem',
                overflow: 'hidden',
                marginBottom: '1rem',
              }}>
                {/* List header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1fr auto',
                  alignItems: 'center',
                  padding: '0.5rem 0.75rem',
                  background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#6b7280',
                  gap: '0.5rem',
                }}>
                  <input
                    type="checkbox"
                    checked={filteredAbsences.length > 0 && filteredAbsences.every(a => selectedAbsenceIds.includes(a.attendance_id))}
                    onChange={toggleAllFiltered}
                    style={{ cursor: 'pointer' }}
                    title="Вибрати всі"
                  />
                  <span>Учень / Заняття</span>
                  <span>Статус</span>
                </div>

                {/* List body */}
                <div style={{ maxHeight: '240px', overflow: 'auto' }}>
                  {absencesLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                      <RefreshCw size={18} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <div>Завантаження...</div>
                    </div>
                  ) : filteredAbsences.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                      <AlertCircle size={18} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <div>Пропусків не знайдено</div>
                    </div>
                  ) : (
                    filteredAbsences.map(a => {
                      const checked = selectedAbsenceIds.includes(a.attendance_id);
                      return (
                        <label
                          key={a.attendance_id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '32px 1fr auto',
                            alignItems: 'center',
                            padding: '0.625rem 0.75rem',
                            borderBottom: '1px solid #f3f4f6',
                            cursor: 'pointer',
                            background: checked ? '#eff6ff' : 'white',
                            transition: 'background 0.1s ease',
                            gap: '0.5rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAbsence(a.attendance_id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <User size={12} style={{ color: '#6b7280' }} />
                              {a.student_name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Calendar size={10} />
                              {formatLessonDate(a.lesson_date)}
                              {a.lesson_start_time && (
                                <><Clock size={10} style={{ marginLeft: '0.25rem' }} />{formatStartTime(a.lesson_start_time)}</>
                              )}
                              {(a.group_title || a.course_title) && (
                                <>
                                  <span style={{ marginLeft: '0.25rem', color: '#d1d5db' }}>·</span>
                                  <Users size={10} />
                                  <span>{a.group_title || a.course_title}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={a.status} />
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Footer counter */}
                {filteredAbsences.length > 0 && (
                  <div style={{
                    padding: '0.4rem 0.75rem',
                    background: '#f9fafb',
                    borderTop: '1px solid #e5e7eb',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span>Всього: {filteredAbsences.length}</span>
                    {selectedAbsenceIds.length > 0 && (
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                        Вибрано: {selectedAbsenceIds.length} ({selectedStudentNames.length} учн{selectedStudentNames.length === 1 ? 'я' : 'ів'})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Selected summary */}
              {selectedAbsences.length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', fontSize: '0.8125rem', color: '#166534' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Check size={14} />
                    Вибрані пропуски:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {selectedStudentNames.map(name => {
                      const count = selectedAbsences.filter(a => a.student_name === name).length;
                      return (
                        <span key={name} style={{ background: '#dcfce7', padding: '0.125rem 0.5rem', borderRadius: '0.25rem' }}>
                          {name}{count > 1 ? ` ×${count}` : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <DateTimeRow
                date={makeupDate} onDate={setMakeupDate}
                time={makeupTime} onTime={setMakeupTime}
                duration={makeupDuration} onDuration={setMakeupDuration}
              />

              {/* Teacher */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Викладач <span style={{ color: '#ef4444' }}>*</span></label>
                <TeacherDropdown
                  teachers={teachers}
                  value={makeupTeacherId}
                  onChange={v => { setMakeupTeacherId(v); setShowMakeupTeacherDropdown(false); }}
                  show={showMakeupTeacherDropdown}
                  onToggle={() => setShowMakeupTeacherDropdown(p => !p)}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="submit"
                  disabled={makeupLoading || selectedAbsenceIds.length === 0}
                  className="btn btn-primary"
                  style={{
                    flex: 1, fontSize: '0.875rem', padding: '0.75rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    opacity: selectedAbsenceIds.length === 0 ? 0.5 : 1,
                  }}
                >
                  {makeupLoading
                    ? <><Spinner /> Створення...</>
                    : <><RefreshCw size={16} /> Створити відпрацювання{selectedAbsenceIds.length > 0 ? ` (${selectedAbsenceIds.length})` : ''}</>
                  }
                </button>
                <button type="button" onClick={handleClose} className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.75rem 1.25rem' }}>
                  Скасувати
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div style={{
      background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem',
      padding: '0.75rem 1rem', marginBottom: '1rem', color: '#dc2626', fontSize: '0.875rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
    }}>
      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '0.0625rem' }} />
      {msg}
    </div>
  );
}

function StatusBadge({ status }: { status: 'absent' | 'makeup_planned' }) {
  if (status === 'absent') {
    return (
      <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '0.25rem', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
        Відсутній
      </span>
    );
  }
  return (
    <span style={{ background: '#fff7ed', color: '#d97706', border: '1px solid #fed7aa', borderRadius: '0.25rem', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      Зап. відпрац.
    </span>
  );
}

function Spinner() {
  return (
    <div style={{
      width: '14px', height: '14px',
      border: '2px solid white', borderTopColor: 'transparent',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0,
    }} />
  );
}
