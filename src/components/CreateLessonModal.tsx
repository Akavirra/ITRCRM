'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Calendar, Clock, User, Plus, Check, Search, ChevronDown,
  AlertCircle, RefreshCw, BookOpen, Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

// РІвЂќР‚РІвЂќР‚РІвЂќР‚ Types РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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
  initialTeacherId?: number | null;
  initialCourseId?: number | null;
  initialStudentIds?: number[];
}

type ModalTab = 'lesson' | 'makeup';

// РІвЂќР‚РІвЂќР‚РІвЂќР‚ Helpers РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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

// РІвЂќР‚РІвЂќР‚РІвЂќР‚ Shared styles (static РІР‚вЂќ defined outside to avoid recreation) РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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

// РІвЂќР‚РІвЂќР‚РІвЂќР‚ Sub-components (defined outside to prevent remount on parent re-render) РІвЂќР‚РІвЂќР‚

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
        <label style={labelStyle}>Р вЂќР В°РЎвЂљР В° <span style={{ color: '#ef4444' }}>*</span></label>
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
        <label style={labelStyle}>Р В§Р В°РЎРѓ <span style={{ color: '#ef4444' }}>*</span></label>
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
        <label style={labelStyle}>Р СћРЎР‚Р С‘Р Р†Р В°Р В»РЎвЂ“РЎРѓРЎвЂљРЎРЉ <span style={{ color: '#ef4444' }}>*</span></label>
        <select
          value={duration}
          onChange={e => onDuration(Number(e.target.value))}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value={30}>30 РЎвЂ¦Р Р†</option>
          <option value={45}>45 РЎвЂ¦Р Р†</option>
          <option value={60}>1 Р С–Р С•Р Т‘</option>
          <option value={90}>1.5 Р С–Р С•Р Т‘</option>
          <option value={120}>2 Р С–Р С•Р Т‘</option>
          <option value={180}>3 Р С–Р С•Р Т‘</option>
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
            {selected ? selected.name : 'Р С›Р В±Р ВµРЎР‚РЎвЂ“РЎвЂљРЎРЉ Р Р†Р С‘Р С”Р В»Р В°Р Т‘Р В°РЎвЂЎР В°'}
          </span>
        </span>
        <ChevronDown size={16} style={{ color: '#9ca3af' }} />
      </button>
      {show && (
        <div style={dropdownContainerStyle}>
          {teachers.length === 0
            ? <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Р СњР ВµР СР В°РЎвЂќ Р Р†Р С‘Р С”Р В»Р В°Р Т‘Р В°РЎвЂЎРЎвЂ“Р Р†</div>
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
            {selected ? selected.title : "Р С›Р В±Р ВµРЎР‚РЎвЂ“РЎвЂљРЎРЉ Р С”РЎС“РЎР‚РЎРѓ (Р Р…Р ВµР С•Р В±Р С•Р Р†'РЎРЏР В·Р С”Р С•Р Р†Р С•)"}
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
            <span style={{ color: '#9ca3af' }}>РІР‚вЂќ Р вЂР ВµР В· Р С”РЎС“РЎР‚РЎРѓРЎС“ РІР‚вЂќ</span>
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

// РІвЂќР‚РІвЂќР‚РІвЂќР‚ Component РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

export default function CreateLessonModal({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  initialTab,
  initialAbsenceIds,
  initialTeacherId,
  initialCourseId,
  initialStudentIds,
}: CreateLessonModalProps) {
  const [tab, setTab] = useState<ModalTab>('lesson');

  // РІвЂќР‚РІвЂќР‚ Shared data РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  // РІвЂќР‚РІвЂќР‚ "Р СњР С•Р Р†Р Вµ Р В·Р В°Р Р…РЎРЏРЎвЂљРЎвЂљРЎРЏ" tab state РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [lessonDate, setLessonDate] = useState(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [additionalLessonSlotsText, setAdditionalLessonSlotsText] = useState('');
  const [courseId, setCourseId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [isTrial, setIsTrial] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // РІвЂќР‚РІвЂќР‚ "Р вЂ™РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ РЎР‹Р Р†Р В°Р Р…Р Р…РЎРЏ" tab state РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
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

  // РІвЂќР‚РІвЂќР‚ Load shared data on open РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚
  useEffect(() => {
    if (!isOpen) return;
    loadCourses();
    loadTeachers();
    loadAllStudents();
    // Pre-load specific students if IDs are provided (they may not be in the first 50)
    if (initialStudentIds?.length) {
      Promise.all(
        initialStudentIds.map(id =>
          fetch(`/api/students/${id}`).then(r => r.json()).catch(() => null)
        )
      ).then(results => {
        const fetched: Student[] = results
          .filter(Boolean)
          .map((r: any) => r.student)
          .filter(Boolean);
        if (fetched.length) {
          setStudents(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            return [...prev, ...fetched.filter(s => !existingIds.has(s.id))];
          });
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Apply initial values when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isOpen) return;
    if (initialTab) setTab(initialTab);
    if (initialAbsenceIds?.length) setSelectedAbsenceIds(initialAbsenceIds);
    setLessonDate(initialDate || format(new Date(), 'yyyy-MM-dd'));
    setStartTime('10:00');
    setDurationMinutes(60);
    setAdditionalLessonSlotsText('');
    if (initialTeacherId != null) {
      setTeacherId(initialTeacherId);
      setMakeupTeacherId(initialTeacherId);
    }
    if (initialCourseId !== undefined) setCourseId(initialCourseId);
    if (initialStudentIds?.length) setSelectedStudentIds(initialStudentIds);
  }, [isOpen]);


  // Load absences when switching to makeup tab
  useEffect(() => {
    if (isOpen && tab === 'makeup') {
      loadAbsences();
    }
  }, [isOpen, tab]);

  // РІвЂќР‚РІвЂќР‚ Data loaders РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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

  // РІвЂќР‚РІвЂќР‚ Derived values РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

  const selectedStudents = students.filter(s => selectedStudentIds.includes(s.id));

  const filteredAbsences = absences.filter(a => {
    const matchSearch = !absenceSearch ||
      a.student_name.toLowerCase().includes(absenceSearch.toLowerCase());
    const matchStatus = absenceStatusFilter === 'all' || a.status === absenceStatusFilter;
    return matchSearch && matchStatus;
  });

  const selectedAbsences = absences.filter(a => selectedAbsenceIds.includes(a.attendance_id));
  const selectedStudentNames = Array.from(new Set(selectedAbsences.map(a => a.student_name)));

  // РІвЂќР‚РІвЂќР‚ Handlers: new lesson tab РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

  const toggleStudent = (id: number) =>
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLessonError(null);
    if (!lessonDate || !startTime || !durationMinutes || !teacherId) {
      setLessonError("Р—Р°РїРѕРІРЅС–С‚СЊ РІСЃС– РѕР±РѕРІ'СЏР·РєРѕРІС– РїРѕР»СЏ");
      return;
    }
    if (selectedStudentIds.length === 0) {
      setLessonError('РћР±РµСЂС–С‚СЊ С…РѕС‡Р° Р± РѕРґРЅРѕРіРѕ СѓС‡РЅСЏ');
      return;
    }

    let additionalSlots: Array<{ lessonDate: string; startTime: string; durationMinutes: number }> = [];
    try {
      additionalSlots = additionalLessonSlotsText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, index) => {
          const match = line.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})(?:\s+(\d+))?$/);
          if (!match) {
            throw new Error(`РќРµРІС–СЂРЅРёР№ С„РѕСЂРјР°С‚ Сѓ РґРѕРґР°С‚РєРѕРІРѕРјСѓ СЃР»РѕС‚С– ${index + 1}`);
          }

          return {
            lessonDate: match[1],
            startTime: match[2],
            durationMinutes: match[3] ? Number(match[3]) : durationMinutes,
          };
        });
    } catch (error) {
      setLessonError(error instanceof Error ? error.message : 'РќРµ РІРґР°Р»РѕСЃСЏ СЂРѕР·С–Р±СЂР°С‚Рё РґРѕРґР°С‚РєРѕРІС– Р·Р°РЅСЏС‚С‚СЏ');
      return;
    }

    const slots = [
      { lessonDate, startTime, durationMinutes },
      ...additionalSlots,
    ];

    if (isTrial && slots.length > 1) {
      setLessonError('РџСЂРѕР±РЅРµ Р·Р°РЅСЏС‚С‚СЏ РјРѕР¶РЅР° Р·Р°РїР»Р°РЅСѓРІР°С‚Рё Р»РёС€Рµ СЏРє РѕРґРЅРµ Р·Р°РЅСЏС‚С‚СЏ');
      return;
    }

    setLessonLoading(true);
    try {
      const res = await fetch('/api/lessons/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          teacherId,
          groupId: null,
          studentIds: selectedStudentIds,
          isTrial,
          slots,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
        resetAll();
      } else {
        setLessonError(data.error || 'РќРµ РІРґР°Р»РѕСЃСЏ СЃС‚РІРѕСЂРёС‚Рё Р·Р°РЅСЏС‚С‚СЏ');
      }
    } catch {
      setLessonError('РЎС‚Р°Р»Р°СЃСЏ РїРѕРјРёР»РєР° РїСЂРё СЃС‚РІРѕСЂРµРЅРЅС– Р·Р°РЅСЏС‚С‚СЏ');
    } finally {
      setLessonLoading(false);
    }
  };

  // РІвЂќР‚РІвЂќР‚ Handlers: makeup tab РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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
      setMakeupError("Р вЂ”Р В°Р С—Р С•Р Р†Р Р…РЎвЂ“РЎвЂљРЎРЉ Р Р†РЎРѓРЎвЂ“ Р С•Р В±Р С•Р Р†'РЎРЏР В·Р С”Р С•Р Р†РЎвЂ“ Р С—Р С•Р В»РЎРЏ");
      return;
    }
    if (selectedAbsenceIds.length === 0) {
      setMakeupError('Р С›Р В±Р ВµРЎР‚РЎвЂ“РЎвЂљРЎРЉ РЎвЂ¦Р С•РЎвЂЎР В° Р В± Р С•Р Т‘Р С‘Р Р… Р С—РЎР‚Р С•Р С—РЎС“РЎРѓР С”');
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
        setMakeupError(data.error || 'Р СњР Вµ Р Р†Р Т‘Р В°Р В»Р С•РЎРѓРЎРЏ РЎРѓРЎвЂљР Р†Р С•РЎР‚Р С‘РЎвЂљР С‘ Р Р†РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ РЎР‹Р Р†Р В°Р Р…Р Р…РЎРЏ');
      }
    } catch {
      setMakeupError('Р РЋРЎвЂљР В°Р В»Р В°РЎРѓРЎРЏ Р С—Р С•Р СР С‘Р В»Р С”Р В° Р С—РЎР‚Р С‘ РЎРѓРЎвЂљР Р†Р С•РЎР‚Р ВµР Р…Р Р…РЎвЂ“ Р Р†РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ РЎР‹Р Р†Р В°Р Р…Р Р…РЎРЏ');
    } finally {
      setMakeupLoading(false);
    }
  };

  // РІвЂќР‚РІвЂќР‚ Reset РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

  const resetAll = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    setLessonDate(today);
    setStartTime('10:00');
    setDurationMinutes(60);
    setAdditionalLessonSlotsText('');
    setCourseId(null);
    setTeacherId(null);
    setSelectedStudentIds([]);
    setStudentSearch('');
    setIsTrial(false);
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

  // РІвЂќР‚РІвЂќР‚РІвЂќР‚ Render РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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
              Р РЋРЎвЂљР Р†Р С•РЎР‚Р С‘РЎвЂљР С‘ Р В·Р В°Р Р…РЎРЏРЎвЂљРЎвЂљРЎРЏ
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
              { key: 'lesson', label: 'Р СњР С•Р Р†Р Вµ Р В·Р В°Р Р…РЎРЏРЎвЂљРЎвЂљРЎРЏ', icon: <Plus size={15} /> },
              { key: 'makeup', label: 'Р вЂ™РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ РЎР‹Р Р†Р В°Р Р…Р Р…РЎРЏ', icon: <RefreshCw size={15} /> },
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

          {/* РІвЂќР‚РІвЂќР‚ TAB: Р СњР С•Р Р†Р Вµ Р В·Р В°Р Р…РЎРЏРЎвЂљРЎвЂљРЎРЏ РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */}
          {tab === 'lesson' && (
            <form onSubmit={handleLessonSubmit}>
              {lessonError && <ErrorBanner msg={lessonError} />}

              {/* Students */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>
                  Р Р€РЎвЂЎР Р…РЎвЂ“ <span style={{ color: '#ef4444' }}>*</span>
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
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Р С›Р В±Р ВµРЎР‚РЎвЂ“РЎвЂљРЎРЉ РЎС“РЎвЂЎР Р…РЎвЂ“Р Р†</span>
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
                            placeholder="Р СџР С•РЎв‚¬РЎС“Р С”..."
                            value={studentSearch}
                            onChange={e => setStudentSearch(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: '2rem', padding: '0.4rem 0.75rem 0.4rem 2rem' }}
                          />
                        </div>
                      </div>
                      <div style={{ maxHeight: '180px', overflow: 'auto' }}>
                        {studentsLoading
                          ? <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Р вЂ”Р В°Р Р†Р В°Р Р…РЎвЂљР В°Р В¶Р ВµР Р…Р Р…РЎРЏ...</div>
                          : students.length === 0
                            ? <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>Р СњР Вµ Р В·Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р С•</div>
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

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Додаткові заняття</label>
                <textarea
                  value={additionalLessonSlotsText}
                  onChange={e => setAdditionalLessonSlotsText(e.target.value)}
                  placeholder={"Кожен рядок: YYYY-MM-DD HH:MM або YYYY-MM-DD HH:MM 90\n2026-04-15 10:00\n2026-04-22 10:00\n2026-04-24 16:30 90"}
                  style={{
                    ...inputStyle,
                    minHeight: '110px',
                    resize: 'vertical',
                    fontFamily: 'monospace',
                    lineHeight: 1.5,
                  }}
                />
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
                  Перше заняття вище лишається одноразовим за замовчуванням.
                  Тут можна додати ще кілька занять одразу: у різні дати й години або, наприклад, щотижня в той самий час.
                  Якщо тривалість у рядку не вказати, буде використано тривалість основного заняття.
                </div>
              </div>

              {/* Course */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Р С™РЎС“РЎР‚РЎРѓ</label>
                <CourseDropdown
                  courses={courses}
                  value={courseId}
                  onChange={v => { setCourseId(v); setShowCourseDropdown(false); }}
                  show={showCourseDropdown}
                  onToggle={() => setShowCourseDropdown(p => !p)}
                />
              </div>

              {/* Teacher */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={labelStyle}>Р вЂ™Р С‘Р С”Р В»Р В°Р Т‘Р В°РЎвЂЎ <span style={{ color: '#ef4444' }}>*</span></label>
                <TeacherDropdown
                  teachers={teachers}
                  value={teacherId}
                  onChange={v => { setTeacherId(v); setShowTeacherDropdown(false); }}
                  show={showTeacherDropdown}
                  onToggle={() => setShowTeacherDropdown(p => !p)}
                />
              </div>

              {/* Trial lesson checkbox */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={isTrial}
                    onChange={e => setIsTrial(e.target.checked)}
                    style={{ width: '1rem', height: '1rem', cursor: 'pointer', accentColor: '#15803d' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                    Р СџРЎР‚Р С•Р В±Р Р…Р Вµ Р В·Р В°Р Р…РЎРЏРЎвЂљРЎвЂљРЎРЏ
                  </span>
                  {isTrial && (
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700,
                      background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                      borderRadius: '0.25rem', padding: '0.125rem 0.375rem',
                      textTransform: 'uppercase', letterSpacing: '0.4px',
                    }}>
                      Р СџРЎР‚Р С•Р В±Р Р…Р Вµ
                    </span>
                  )}
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="submit" disabled={lessonLoading} className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.875rem', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  {lessonLoading
                    ? <><Spinner /> Р РЋРЎвЂљР Р†Р С•РЎР‚Р ВµР Р…Р Р…РЎРЏ...</>
                    : <><Plus size={16} /> Р РЋРЎвЂљР Р†Р С•РЎР‚Р С‘РЎвЂљР С‘ Р В·Р В°Р Р…РЎРЏРЎвЂљРЎвЂљРЎРЏ</>
                  }
                </button>
                <button type="button" onClick={handleClose} className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.75rem 1.25rem' }}>
                  Р РЋР С”Р В°РЎРѓРЎС“Р Р†Р В°РЎвЂљР С‘
                </button>
              </div>
            </form>
          )}

          {/* РІвЂќР‚РІвЂќР‚ TAB: Р вЂ™РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ РЎР‹Р Р†Р В°Р Р…Р Р…РЎРЏ РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚ */}
          {tab === 'makeup' && (
            <form onSubmit={handleMakeupSubmit}>
              {makeupError && <ErrorBanner msg={makeupError} />}

              {/* Search + filter bar */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={13} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                  <input
                    type="text"
                    placeholder="Р СџР С•РЎв‚¬РЎС“Р С” РЎС“РЎвЂЎР Р…РЎРЏ..."
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
                  <option value="all">Р вЂ™РЎРѓРЎвЂ“ Р С—РЎР‚Р С•Р С—РЎС“РЎРѓР С”Р С‘</option>
                  <option value="absent">Р вЂ™РЎвЂ“Р Т‘РЎРѓРЎС“РЎвЂљР Р…РЎвЂ“Р в„–</option>
                  <option value="makeup_planned">Р вЂ”Р В°Р С—. Р Р†РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ .</option>
                </select>
                <button
                  type="button"
                  onClick={loadAbsences}
                  title="Р С›Р Р…Р С•Р Р†Р С‘РЎвЂљР С‘ РЎРѓР С—Р С‘РЎРѓР С•Р С”"
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
                    title="Р вЂ™Р С‘Р В±РЎР‚Р В°РЎвЂљР С‘ Р Р†РЎРѓРЎвЂ“"
                  />
                  <span>Р Р€РЎвЂЎР ВµР Р…РЎРЉ / Р вЂ”Р В°Р Р…РЎРЏРЎвЂљРЎвЂљРЎРЏ</span>
                  <span>Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ</span>
                </div>

                {/* List body */}
                <div style={{ maxHeight: '240px', overflow: 'auto' }}>
                  {absencesLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                      <RefreshCw size={18} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <div>Р вЂ”Р В°Р Р†Р В°Р Р…РЎвЂљР В°Р В¶Р ВµР Р…Р Р…РЎРЏ...</div>
                    </div>
                  ) : filteredAbsences.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                      <AlertCircle size={18} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                      <div>Р СџРЎР‚Р С•Р С—РЎС“РЎРѓР С”РЎвЂ“Р Р† Р Р…Р Вµ Р В·Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р С•</div>
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
                                  <span style={{ marginLeft: '0.25rem', color: '#d1d5db' }}>Р’В·</span>
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
                    <span>Р вЂ™РЎРѓРЎРЉР С•Р С–Р С•: {filteredAbsences.length}</span>
                    {selectedAbsenceIds.length > 0 && (
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                        Р вЂ™Р С‘Р В±РЎР‚Р В°Р Р…Р С•: {selectedAbsenceIds.length} ({selectedStudentNames.length} РЎС“РЎвЂЎР Р…{selectedStudentNames.length === 1 ? 'РЎРЏ' : 'РЎвЂ“Р Р†'})
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
                    Р вЂ™Р С‘Р В±РЎР‚Р В°Р Р…РЎвЂ“ Р С—РЎР‚Р С•Р С—РЎС“РЎРѓР С”Р С‘:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {selectedStudentNames.map(name => {
                      const count = selectedAbsences.filter(a => a.student_name === name).length;
                      return (
                        <span key={name} style={{ background: '#dcfce7', padding: '0.125rem 0.5rem', borderRadius: '0.25rem' }}>
                          {name}{count > 1 ? ` Р“вЂ”${count}` : ''}
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
                <label style={labelStyle}>Р вЂ™Р С‘Р С”Р В»Р В°Р Т‘Р В°РЎвЂЎ <span style={{ color: '#ef4444' }}>*</span></label>
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
                    ? <><Spinner /> Р РЋРЎвЂљР Р†Р С•РЎР‚Р ВµР Р…Р Р…РЎРЏ...</>
                    : <><RefreshCw size={16} /> Р РЋРЎвЂљР Р†Р С•РЎР‚Р С‘РЎвЂљР С‘ Р Р†РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ РЎР‹Р Р†Р В°Р Р…Р Р…РЎРЏ{selectedAbsenceIds.length > 0 ? ` (${selectedAbsenceIds.length})` : ''}</>
                  }
                </button>
                <button type="button" onClick={handleClose} className="btn btn-secondary"
                  style={{ fontSize: '0.875rem', padding: '0.75rem 1.25rem' }}>
                  Р РЋР С”Р В°РЎРѓРЎС“Р Р†Р В°РЎвЂљР С‘
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

// РІвЂќР‚РІвЂќР‚РІвЂќР‚ Small helpers РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚РІвЂќР‚

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
        Р вЂ™РЎвЂ“Р Т‘РЎРѓРЎС“РЎвЂљР Р…РЎвЂ“Р в„–
      </span>
    );
  }
  return (
    <span style={{ background: '#fff7ed', color: '#d97706', border: '1px solid #fed7aa', borderRadius: '0.25rem', fontSize: '0.6875rem', padding: '0.125rem 0.375rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      Р вЂ”Р В°Р С—. Р Р†РЎвЂ“Р Т‘Р С—РЎР‚Р В°РЎвЂ .
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
