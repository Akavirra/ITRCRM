'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useLessonModals } from '@/components/LessonModalsContext';
import { useStudentModals } from '@/components/StudentModalsContext';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useCourseModals } from '@/components/CourseModalsContext';
import { useTeacherModals } from '@/components/TeacherModalsContext';

type AttendanceStatus = 'present' | 'absent' | 'makeup_planned' | 'makeup_done';

interface Totals {
  total_lessons: number;
  group_lessons: number;
  individual_lessons: number;
  total_records: number;
  present: number;
  absent: number;
  makeup: number;
  not_marked: number;
  overall_rate: number;
  students_count: number;
}

interface RegisterLesson {
  lesson_id: number;
  lesson_date: string;
  topic: string | null;
  teacher_name: string | null;
}

interface RegisterStudent {
  student_id: number;
  student_name: string;
  attendance: Record<number, AttendanceStatus | null>;
  present: number;
  absent: number;
  not_marked: number;
  rate: number;
}

interface GroupedLesson {
  lesson_id: number;
  lesson_date: string;
  topic: string | null;
}

interface GroupedStudent {
  student_id: number;
  student_name: string;
  attendance: Record<number, AttendanceStatus | null>;
  present: number;
  absent: number;
  rate: number;
}

interface GroupedGroup {
  group_id: number;
  group_title: string;
  course_id: number | null;
  course_title: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  weekly_day: number | null;
  start_time: string | null;
  duration_minutes: number;
  lessons: GroupedLesson[];
  students: GroupedStudent[];
  avg_rate: number;
}

interface IndividualLesson {
  lesson_id: number;
  lesson_date: string;
  start_time: string | null;
  topic: string | null;
  course_title: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  students: Array<{
    student_id: number;
    student_name: string;
    status: AttendanceStatus | null;
  }>;
}

interface LessonRecord {
  lesson_id: number;
  lesson_date: string;
  start_time: string | null;
  topic: string | null;
  group_id: number | null;
  group_title: string;
  course_id: number | null;
  course_title: string | null;
  teacher_id: number | null;
  teacher_name: string | null;
  student_id: number;
  student_name: string;
  status: AttendanceStatus | null;
}

interface Group   { id: number; title: string; }
interface Course  { id: number; title: string; }
interface Teacher { id: number; name: string; }

interface AllTimeMonth {
  year: number;
  month: number;
  lessons: RegisterLesson[];
}

interface AllTimeStudentRow {
  student_id: number;
  student_name: string;
  attendance: Record<number, AttendanceStatus | null>;
  present: number;
  absent: number;
  total: number;
  rate: number;
}

interface GroupAllTimeData {
  group_title: string;
  months: AllTimeMonth[];
  students: AllTimeStudentRow[];
}

const WEEKDAY_UK    = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAY_SHORT = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_UK      = ['', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

const now = new Date();
const YEARS = Array.from({ length: now.getFullYear() - 2019 }, (_, i) => now.getFullYear() - i);

function formatDateShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  } catch { return dateStr; }
}

function getWeekdayShort(dateStr: string): string {
  try { return WEEKDAY_SHORT[new Date(dateStr).getUTCDay()]; } catch { return ''; }
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? '#16a34a' : rate >= 60 ? '#d97706' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 80, height: 5, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${rate}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color }}>{rate}%</span>
    </div>
  );
}

function AttCell({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span style={{ color: '#d1d5db' }}>○</span>;
  if (status === 'present')     return <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>;
  if (status === 'absent')      return <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>;
  if (status === 'makeup_done') return <span style={{ color: '#2563eb', fontWeight: 700 }}>✓</span>;
  return <span style={{ color: '#d97706', fontWeight: 700 }}>↺</span>;
}

function StatusBadge({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:24, height:24, borderRadius:'50%', backgroundColor:'#f3f4f6', border:'1px solid #e5e7eb', fontSize:'0.7rem', color:'#9ca3af' }}>○</span>;
  const map: Record<AttendanceStatus, { bg:string; border:string; icon:string; color:string; title:string }> = {
    present:        { bg:'#dcfce7', border:'#86efac', icon:'✓', color:'#16a34a', title:'Присутній' },
    absent:         { bg:'#fee2e2', border:'#fca5a5', icon:'✗', color:'#dc2626', title:'Відсутній' },
    makeup_planned: { bg:'#fef3c7', border:'#fcd34d', icon:'↺', color:'#d97706', title:'Відпрацювання' },
    makeup_done:    { bg:'#dbeafe', border:'#93c5fd', icon:'✓', color:'#2563eb', title:'Відпрацьовано' },
  };
  const s = map[status];
  return <span title={s.title} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:24, height:24, borderRadius:'50%', backgroundColor:s.bg, border:`1px solid ${s.border}`, fontSize:'0.7rem', fontWeight:700, color:s.color }}>{s.icon}</span>;
}

function StatusLabel({ status }: { status: AttendanceStatus | null }) {
  if (!status) return <span style={{ color:'#9ca3af', fontSize:'0.8125rem' }}>Не відмічено</span>;
  const map: Record<AttendanceStatus, { label:string; color:string; bg:string }> = {
    present:        { label:'Присутній',     color:'#16a34a', bg:'#dcfce7' },
    absent:         { label:'Відсутній',     color:'#dc2626', bg:'#fee2e2' },
    makeup_planned: { label:'Відпрацювання', color:'#d97706', bg:'#fef3c7' },
    makeup_done:    { label:'Відпрацьовано', color:'#2563eb', bg:'#dbeafe' },
  };
  const s = map[status];
  return <span style={{ padding:'2px 8px', borderRadius:6, fontSize:'0.75rem', fontWeight:600, color:s.color, backgroundColor:s.bg }}>{s.label}</span>;
}

const selectStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem',
  fontSize: '0.875rem', color: '#374151', backgroundColor: 'white', cursor: 'pointer',
};

const OpenLessonBtn = ({ lessonId }: { lessonId: number }) => {
  const { openLessonModal } = useLessonModals();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openLessonModal(lessonId, `Заняття #${lessonId}`, undefined); }}
      style={{ padding:'0.375rem', borderRadius:'0.5rem', backgroundColor:'transparent', border:'none', cursor:'pointer', color:'#94a3b8', display:'flex', alignItems:'center' }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor='#eef2ff'; e.currentTarget.style.color='#6366f1'; }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor='transparent'; e.currentTarget.style.color='#94a3b8'; }}
      title="Відкрити в модальному вікні"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </button>
  );
};

export default function AttendancePage() {
  const router = useRouter();
  const { openLessonModal } = useLessonModals();
  const { openStudentModal } = useStudentModals();
  const { openGroupModal } = useGroupModals();
  const { openCourseModal } = useCourseModals();
  const { openTeacherModal } = useTeacherModals();

  const [user,          setUser]          = useState<{ id:number; name:string; email:string; role:'admin'|'teacher' }|null>(null);
  const [year,          setYear]          = useState(now.getFullYear());
  const [month,         setMonth]         = useState(now.getMonth() + 1);
  const [viewMode,      setViewMode]      = useState<'grouped'|'summary'>('grouped');
  const [totals,        setTotals]        = useState<Totals|null>(null);
  const [lessonRecords, setLessonRecords] = useState<LessonRecord[]>([]);
  const [register,      setRegister]      = useState<{ lessons:RegisterLesson[]; students:RegisterStudent[] }|null>(null);
  const [groupedData,   setGroupedData]   = useState<{ groups:GroupedGroup[]; individual_lessons:IndividualLesson[] }|null>(null);
  const [groups,          setGroups]          = useState<Group[]>([]);
  const [courses,         setCourses]         = useState<Course[]>([]);
  const [teachers,        setTeachers]        = useState<Teacher[]>([]);
  const [selectedGroup,   setSelectedGroup]   = useState('');
  const [selectedCourse,  setSelectedCourse]  = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [search,        setSearch]        = useState('');
  const [allTime,       setAllTime]       = useState(false);
  const [journalMode,   setJournalMode]   = useState(false);
  const [journalData,   setJournalData]   = useState<GroupAllTimeData | null>(null);
  const [openMonths,    setOpenMonths]    = useState<Set<string>>(new Set());
  // all-time extra filters
  const [statusFilter, setStatusFilter] = useState('');
  const [atYear,      setAtYear]      = useState('');
  const [atMonth,     setAtMonth]     = useState('');
  const [atStartDate, setAtStartDate] = useState('');
  const [atEndDate,   setAtEndDate]   = useState('');
  const [loading,           setLoading]           = useState(false);
  const [studentSuggestions, setStudentSuggestions] = useState<{id:number;full_name:string}[]>([]);
  const [showSuggestions,    setShowSuggestions]    = useState(false);
  const searchTimeout    = useRef<ReturnType<typeof setTimeout>>();
  const suggestTimeout   = useRef<ReturnType<typeof setTimeout>>();
  const suggestBoxRef    = useRef<HTMLDivElement>(null);

  // Auth
  useEffect(() => {
    fetch('/api/auth/me').then(r => { if (!r.ok) { router.push('/login'); return null; } return r.json(); })
      .then(d => d && setUser(d.user));
  }, [router]);

  // Load groups, courses & teachers
  useEffect(() => {
    fetch('/api/groups?limit=200').then(r => r.json())
      .then(d => setGroups((d.groups || []).map((g: Group) => ({ id: g.id, title: g.title }))))
      .catch(() => {});
    fetch('/api/courses?limit=200').then(r => r.json())
      .then(d => setCourses((d.courses || []).map((c: Course) => ({ id: c.id, title: c.title }))))
      .catch(() => {});
    fetch('/api/teachers').then(r => r.json())
      .then(d => setTeachers((Array.isArray(d) ? d : (d.teachers || [])).map((t: { id: number; name: string }) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, []);

  const loadJournalData = useCallback(async () => {
    if (!selectedGroup) { setJournalData(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?view=groupRegisterAllTime&groupId=${selectedGroup}`);
      if (res.ok) {
        const d = await res.json();
        const data: GroupAllTimeData = d.data;
        setJournalData(data);
        // Auto-open the most recent month
        if (data.months.length > 0) {
          const last = data.months[data.months.length - 1];
          setOpenMonths(new Set([`${last.year}-${last.month}`]));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (journalMode) loadJournalData();
  }, [journalMode, loadJournalData]);

  // Load data
  const loadData = useCallback(async () => {
    if (journalMode) return;
    setLoading(true);
    try {
      if (allTime) {
        // ── All-time flat list with extended filters ──
        const params = new URLSearchParams({ view: 'lessonRecords', allTime: 'true' });
        if (atStartDate || atEndDate) {
          if (atStartDate) params.set('startDate', atStartDate);
          if (atEndDate)   params.set('endDate', atEndDate);
        } else {
          if (atYear)  params.set('year', atYear);
          if (atYear && atMonth) params.set('month', atMonth);
        }
        if (selectedCourse)  params.set('courseId',  selectedCourse);
        if (selectedTeacher) params.set('teacherId', selectedTeacher);
        if (selectedGroup)   params.set('groupId',   selectedGroup);
        if (search)          params.set('search',    search);
        const res = await fetch(`/api/attendance?${params}`);
        if (res.ok) { const d = await res.json(); setLessonRecords(d.records || []); }

      } else if (viewMode === 'grouped') {
        const params = new URLSearchParams({ view: 'groupedMonthly', year: String(year), month: String(month) });
        if (selectedGroup)   params.set('groupId',   selectedGroup);
        if (selectedCourse)  params.set('courseId',  selectedCourse);
        if (selectedTeacher) params.set('teacherId', selectedTeacher);
        if (search) params.set('search', search);
        const res = await fetch(`/api/attendance?${params}`);
        if (res.ok) {
          const d = await res.json();
          setGroupedData({ groups: d.groups || [], individual_lessons: d.individual_lessons || [] });
          if (d.totals) setTotals(d.totals);
        }

      } else {
        // summary (non-allTime)
        const params = new URLSearchParams({ view: 'lessonRecords', year: String(year), month: String(month) });
        if (selectedGroup)   params.set('groupId',   selectedGroup);
        if (selectedCourse)  params.set('courseId',  selectedCourse);
        if (selectedTeacher) params.set('teacherId', selectedTeacher);
        if (search) params.set('search', search);
        const [recordsRes, totalsRes] = await Promise.all([
          fetch(`/api/attendance?${params}`),
          fetch(`/api/attendance?view=monthlyTotals&year=${year}&month=${month}`),
        ]);
        if (recordsRes.ok) { const d = await recordsRes.json(); setLessonRecords(d.records || []); }
        if (totalsRes.ok)  { const d = await totalsRes.json();  if (d.totals) setTotals(d.totals); }
      }
    } finally {
      setLoading(false);
    }
  }, [year, month, viewMode, selectedGroup, selectedCourse, selectedTeacher, search, allTime, journalMode, atYear, atMonth, atStartDate, atEndDate]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(loadData, 250);
    return () => clearTimeout(searchTimeout.current);
  }, [loadData]);

  const prevMonth = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const nextMonth = () => {
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth()+1)) return;
    if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()+1;

  const toggleAllTime = () => {
    setAllTime(v => !v);
    setJournalMode(false);
    setStatusFilter('');
    // reset all-time specific filters when toggling off
    if (allTime) { setAtYear(''); setAtMonth(''); setAtStartDate(''); setAtEndDate(''); setSelectedCourse(''); setSelectedTeacher(''); }
  };

  const toggleJournal = () => {
    setJournalMode(v => !v);
    setAllTime(false);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setShowSuggestions(true);
    clearTimeout(suggestTimeout.current);
    if (value.trim().length >= 1) {
      suggestTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(`/api/students?search=${encodeURIComponent(value)}&limit=8`);
          if (res.ok) {
            const d = await res.json();
            setStudentSuggestions(d.students || []);
          }
        } catch { /* ignore */ }
      }, 200);
    } else {
      setStudentSuggestions([]);
    }
  };

  const selectSuggestion = (name: string) => {
    setSearch(name);
    setShowSuggestions(false);
    setStudentSuggestions([]);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestBoxRef.current && !suggestBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // helpers to keep year/month and date-range mutually exclusive
  const setDateRange = (start: string, end: string) => {
    setAtStartDate(start); setAtEndDate(end);
    if (start || end) { setAtYear(''); setAtMonth(''); }
  };
  const setYearFilter = (v: string) => {
    setAtYear(v); if (!v) setAtMonth('');
    setAtStartDate(''); setAtEndDate('');
  };
  const setMonthFilter = (v: string) => {
    setAtMonth(v);
    setAtStartDate(''); setAtEndDate('');
  };

  // ── Export CSV ──
  const exportCSV = () => {
    let csvRows: (string|number)[][];
    if (!allTime && viewMode === 'grouped' && groupedData) {
      csvRows = [['Тип', 'Група', 'Учень', 'Дата', 'День', 'Статус']];
      for (const g of groupedData.groups)
        for (const s of g.students)
          for (const l of g.lessons) {
            const st = s.attendance[l.lesson_id];
            csvRows.push(['Групове', g.group_title, s.student_name, formatDateShort(l.lesson_date), getWeekdayShort(l.lesson_date), !st ? '—' : st === 'present' ? 'П' : st === 'absent' ? 'В' : 'Відп']);
          }
      for (const il of groupedData.individual_lessons)
        for (const s of il.students)
          csvRows.push(['Індивідуальне', il.topic||'—', s.student_name, formatDateShort(il.lesson_date), getWeekdayShort(il.lesson_date), !s.status ? '—' : s.status === 'present' ? 'П' : s.status === 'absent' ? 'В' : 'Відп']);
    } else {
      csvRows = [['Дата', 'День', 'Час', 'Тип', 'Курс', 'Група', 'Учень', 'Тема', 'Статус']];
      for (const r of lessonRecords) {
        const statusLabel = r.status === 'present' ? 'Присутній' : r.status === 'absent' ? 'Відсутній' : r.status === 'makeup_done' ? 'Відпрацьовано' : r.status === 'makeup_planned' ? 'Відпрацювання' : 'Не відмічено';
        csvRows.push([formatDateShort(r.lesson_date), getWeekdayShort(r.lesson_date), r.start_time||'', r.group_id ? 'Групове' : 'Індивід.', r.course_title||'', r.group_title, r.student_name, r.topic||'', statusLabel]);
      }
    }
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = allTime ? `attendance_all_time.csv` : `attendance_${year}_${String(month).padStart(2,'0')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (!user) return null;

  return (
    <Layout user={user}>
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* ── Page header ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
          <h1 style={{ fontSize:'1.75rem', fontWeight:700, margin:0, color:'var(--gray-900)' }}>Відвідуваність</h1>
          <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
            <button onClick={toggleAllTime} style={{
              display:'flex', alignItems:'center', gap:'0.5rem',
              padding:'0.625rem 1.25rem',
              border:`1px solid ${allTime ? '#1565c0' : '#e5e7eb'}`,
              borderRadius:'0.625rem',
              backgroundColor: allTime ? '#1565c0' : 'white',
              color: allTime ? 'white' : '#374151',
              fontSize:'0.875rem', fontWeight:500, cursor:'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              За весь час
            </button>
            <button onClick={toggleJournal} style={{
              display:'flex', alignItems:'center', gap:'0.5rem',
              padding:'0.625rem 1.25rem',
              border:`1px solid ${journalMode ? '#7c3aed' : '#e5e7eb'}`,
              borderRadius:'0.625rem',
              backgroundColor: journalMode ? '#7c3aed' : 'white',
              color: journalMode ? 'white' : '#374151',
              fontSize:'0.875rem', fontWeight:500, cursor:'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              Журнал групи
            </button>
            <button onClick={exportCSV} style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.625rem 1.25rem', border:'1px solid #e5e7eb', borderRadius:'0.625rem', backgroundColor:'white', color:'#374151', fontSize:'0.875rem', fontWeight:500, cursor:'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Експорт CSV
            </button>
          </div>
        </div>

        {/* ══ ALL-TIME MODE ══ */}
        {allTime ? (
          <div className="card" style={{ borderRadius:'1rem', overflow:'hidden' }}>

            {/* Filter panel */}
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #e5e7eb', backgroundColor:'#fafafa' }}>
              <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>
                Фільтри — За весь час
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.625rem', alignItems:'flex-end' }}>

                {/* Year */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Рік</label>
                  <select value={atYear} onChange={e => setYearFilter(e.target.value)} style={selectStyle}>
                    <option value="">Всі роки</option>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {/* Month (only if year selected) */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color: atYear ? '#6b7280' : '#d1d5db', fontWeight:500 }}>Місяць</label>
                  <select value={atMonth} onChange={e => setMonthFilter(e.target.value)} disabled={!atYear} style={{ ...selectStyle, opacity: atYear ? 1 : 0.5, cursor: atYear ? 'pointer' : 'not-allowed' }}>
                    <option value="">Всі місяці</option>
                    {MONTH_UK.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>

                {/* Divider */}
                <div style={{ display:'flex', alignItems:'center', padding:'0 0.25rem', color:'#d1d5db', fontSize:'0.75rem', marginTop:'auto', paddingBottom:'0.5rem' }}>або</div>

                {/* Date from */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Дата від</label>
                  <input type="date" value={atStartDate} onChange={e => setDateRange(e.target.value, atEndDate)}
                    style={{ ...selectStyle, minWidth: 140 }} />
                </div>

                {/* Date to */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Дата до</label>
                  <input type="date" value={atEndDate} onChange={e => setDateRange(atStartDate, e.target.value)}
                    style={{ ...selectStyle, minWidth: 140 }} />
                </div>

                {/* Separator */}
                <div style={{ width: 1, height: 36, backgroundColor: '#e5e7eb', margin: 'auto 0.125rem', marginTop: 'auto' }} />

                {/* Course */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Курс</label>
                  <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} style={selectStyle}>
                    <option value="">Всі курси</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>

                {/* Teacher */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Викладач</label>
                  <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} style={selectStyle}>
                    <option value="">Всі викладачі</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                {/* Group */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Група</label>
                  <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={selectStyle}>
                    <option value="">Всі групи</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>

                {/* Student search */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', flex:1, minWidth:180 }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Учень</label>
                  <div ref={suggestBoxRef} style={{ position:'relative', width:'100%' }}>
                    <input type="text" placeholder="Пошук за іменем..." value={search}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => { if (studentSuggestions.length > 0) setShowSuggestions(true); }}
                      style={{ ...selectStyle, width:'100%', boxSizing:'border-box' }} />
                    {showSuggestions && studentSuggestions.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, backgroundColor:'white', border:'1px solid #e5e7eb', borderRadius:'0.5rem', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', marginTop:2, overflow:'hidden' }}>
                        {studentSuggestions.map(s => (
                          <div key={s.id} onMouseDown={() => selectSuggestion(s.full_name)}
                            style={{ padding:'0.5rem 0.75rem', fontSize:'0.875rem', color:'#374151', cursor:'pointer', borderBottom:'1px solid #f3f4f6' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                            {s.full_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status filter */}
                <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                  <label style={{ fontSize:'0.6875rem', color:'#6b7280', fontWeight:500 }}>Статус</label>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                    <option value="">Всі статуси</option>
                    <option value="absent">Відсутній</option>
                    <option value="present">Присутній</option>
                    <option value="makeup_planned">Відпрацювання</option>
                    <option value="makeup_done">Відпрацьовано</option>
                    <option value="null">Не відмічено</option>
                  </select>
                </div>

                {/* Reset button */}
                {(atYear || atMonth || atStartDate || atEndDate || selectedCourse || selectedTeacher || selectedGroup || search || statusFilter) && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem' }}>
                    <label style={{ fontSize:'0.6875rem', color:'transparent', fontWeight:500 }}>.</label>
                    <button onClick={() => { setAtYear(''); setAtMonth(''); setAtStartDate(''); setAtEndDate(''); setSelectedCourse(''); setSelectedTeacher(''); setSelectedGroup(''); setSearch(''); setStatusFilter(''); }}
                      style={{ padding:'0.5rem 0.875rem', border:'1px solid #fca5a5', borderRadius:'0.5rem', backgroundColor:'#fef2f2', color:'#dc2626', fontSize:'0.8125rem', fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' as const }}>
                      ✕ Скинути
                    </button>
                  </div>
                )}
              </div>

              {/* Active filter summary */}
              {(atYear || atStartDate || atEndDate || selectedCourse || selectedTeacher || selectedGroup) && (
                <div style={{ marginTop:'0.75rem', display:'flex', flexWrap:'wrap', gap:'0.375rem', alignItems:'center' }}>
                  <span style={{ fontSize:'0.75rem', color:'#9ca3af' }}>Активні фільтри:</span>
                  {atStartDate && atEndDate && <span style={{ padding:'2px 8px', borderRadius:99, backgroundColor:'#dbeafe', color:'#1d4ed8', fontSize:'0.75rem', fontWeight:500 }}>📅 {atStartDate} — {atEndDate}</span>}
                  {atStartDate && !atEndDate  && <span style={{ padding:'2px 8px', borderRadius:99, backgroundColor:'#dbeafe', color:'#1d4ed8', fontSize:'0.75rem', fontWeight:500 }}>📅 від {atStartDate}</span>}
                  {!atStartDate && atEndDate  && <span style={{ padding:'2px 8px', borderRadius:99, backgroundColor:'#dbeafe', color:'#1d4ed8', fontSize:'0.75rem', fontWeight:500 }}>📅 до {atEndDate}</span>}
                  {atYear && !atStartDate && <span style={{ padding:'2px 8px', borderRadius:99, backgroundColor:'#dbeafe', color:'#1d4ed8', fontSize:'0.75rem', fontWeight:500 }}>
                    📅 {atYear}{atMonth ? ` · ${MONTH_UK[Number(atMonth)]}` : ''}
                  </span>}
                  {selectedCourse && <span style={{ padding:'2px 8px', borderRadius:99, backgroundColor:'#ede9fe', color:'#7c3aed', fontSize:'0.75rem', fontWeight:500 }}>
                    Курс: {courses.find(c => String(c.id) === selectedCourse)?.title}
                  </span>}
                  {selectedTeacher && <span style={{ padding:'2px 8px', borderRadius:99, backgroundColor:'#fef3c7', color:'#b45309', fontSize:'0.75rem', fontWeight:500 }}>
                    Викладач: {teachers.find(t => String(t.id) === selectedTeacher)?.name}
                  </span>}
                  {selectedGroup && <span style={{ padding:'2px 8px', borderRadius:99, backgroundColor:'#dcfce7', color:'#16a34a', fontSize:'0.75rem', fontWeight:500 }}>
                    Група: {groups.find(g => String(g.id) === selectedGroup)?.title}
                  </span>}
                </div>
              )}
            </div>

            {/* Results */}
            {loading
              ? <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}>Завантаження...</div>
              : renderSummaryView()
            }
          </div>

        ) : journalMode ? renderJournalView() : (
          /* ══ REGULAR MONTHLY MODE ══ */
          <>
            {/* Month navigation */}
            <div className="card" style={{ padding:'0.875rem 1.5rem', marginBottom:'1.25rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'1rem', borderRadius:'0.875rem', flexWrap:'wrap' }}>
              <button onClick={prevMonth} style={{ width:34, height:34, border:'1px solid #e5e7eb', borderRadius:'50%', backgroundColor:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.125rem', color:'#374151', flexShrink:0 }}>‹</button>
              <span style={{ fontWeight:700, fontSize:'1.125rem', color:'#111827', minWidth:200, textAlign:'center' }}>
                {MONTH_UK[month]} {year}
              </span>
              <button onClick={nextMonth} disabled={isCurrentMonth} style={{ width:34, height:34, border:'1px solid #e5e7eb', borderRadius:'50%', backgroundColor:'white', cursor: isCurrentMonth ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.125rem', color: isCurrentMonth ? '#d1d5db' : '#374151', opacity: isCurrentMonth ? 0.4 : 1, flexShrink:0 }}>›</button>
            </div>

            {/* KPI cards */}
            {totals && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:'0.75rem', marginBottom:'1.25rem' }}>
                {[
                  { label:'Всього занять',   value: totals.total_lessons,      color:'#374151', bg:'#f9fafb' },
                  { label:'Групових',        value: totals.group_lessons,       color:'#1d4ed8', bg:'#dbeafe' },
                  { label:'Індивідуальних',  value: totals.individual_lessons,  color:'#7c3aed', bg:'#ede9fe' },
                  { label:'Пропуски',        value: totals.absent,              color:'#dc2626', bg:'#fee2e2' },
                  { label:'Відпрацювань',    value: totals.makeup,              color:'#d97706', bg:'#fef3c7' },
                  { label:'Не відмічено',    value: totals.not_marked,          color:'#6b7280', bg:'#f3f4f6' },
                  { label:'Загальний %',     value:`${totals.overall_rate}%`,   color: totals.overall_rate >= 80 ? '#16a34a' : totals.overall_rate >= 60 ? '#d97706' : '#dc2626', bg:'#f9fafb' },
                ].map((kpi, i) => (
                  <div key={i} className="card" style={{ padding:'0.875rem 1rem', borderRadius:'0.875rem', backgroundColor:kpi.bg, border:'none' }}>
                    <div style={{ fontSize:'1.375rem', fontWeight:700, color:kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize:'0.6875rem', color:'#6b7280', marginTop:2 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tabs + filters + content */}
            <div className="card" style={{ borderRadius:'1rem', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'1rem 1.5rem', borderBottom:'1px solid #e5e7eb', flexWrap:'wrap' }}>
                <div style={{ display:'flex', border:'1px solid #e5e7eb', borderRadius:'0.625rem', overflow:'hidden', flexShrink:0 }}>
                  {(['grouped','summary'] as const).map(mode => (
                    <button key={mode} onClick={() => { setViewMode(mode); setStatusFilter(''); }} style={{
                      padding:'0.5rem 1rem', border:'none', cursor:'pointer', fontSize:'0.875rem', fontWeight:500,
                      backgroundColor: viewMode === mode ? '#1565c0' : 'white',
                      color: viewMode === mode ? 'white' : '#374151',
                    }}>
                      {mode === 'grouped' ? 'По групах' : 'Загальна таблиця'}
                    </button>
                  ))}
                </div>

                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={selectStyle}>
                  <option value="">Всі групи</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>

                {(
                  <select value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)} style={selectStyle}>
                    <option value="">Всі курси</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                )}

                {(
                  <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} style={selectStyle}>
                    <option value="">Всі викладачі</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                )}

                {(
                  <div ref={suggestBoxRef} style={{ position:'relative', flex:1, minWidth:180 }}>
                    <input type="text" placeholder="Пошук учня..." value={search}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => { if (studentSuggestions.length > 0) setShowSuggestions(true); }}
                      style={{ width:'100%', boxSizing:'border-box', ...selectStyle }} />
                    {showSuggestions && studentSuggestions.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:100, backgroundColor:'white', border:'1px solid #e5e7eb', borderRadius:'0.5rem', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', marginTop:2, overflow:'hidden' }}>
                        {studentSuggestions.map(s => (
                          <div key={s.id} onMouseDown={() => selectSuggestion(s.full_name)}
                            style={{ padding:'0.5rem 0.75rem', fontSize:'0.875rem', color:'#374151', cursor:'pointer', borderBottom:'1px solid #f3f4f6' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                            {s.full_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {viewMode === 'summary' && (
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
                    <option value="">Всі статуси</option>
                    <option value="absent">Відсутній</option>
                    <option value="present">Присутній</option>
                    <option value="makeup_planned">Відпрацювання</option>
                    <option value="makeup_done">Відпрацьовано</option>
                    <option value="null">Не відмічено</option>
                  </select>
                )}
              </div>

              {loading ? (
                <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}>Завантаження...</div>
              ) : viewMode === 'grouped' ? renderGroupedView()
                : renderSummaryView()
              }
            </div>
          </>
        )}
      </div>
    </Layout>
  );

  // ── Grouped view ─────────────────────────────────────────────────────────

  function renderGroupedView() {
    if (!groupedData || (groupedData.groups.length === 0 && groupedData.individual_lessons.length === 0)) {
      return <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
        <p style={{ margin:'0 0 0.5rem 0' }}>Даних про відвідуваність немає</p>
        <p style={{ margin:0, fontSize:'0.8125rem' }}>Відвідуваність з&apos;явиться після проведення занять</p>
      </div>;
    }
    return (
      <div style={{ padding:'1.25rem 1.5rem', display:'flex', flexDirection:'column', gap:'1.5rem' }}>
        {groupedData.groups.length > 0 && (
          <div>
            <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>
              Групові заняття ({groupedData.groups.length} {groupedData.groups.length === 1 ? 'група' : groupedData.groups.length < 5 ? 'групи' : 'груп'})
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {groupedData.groups.map(g => (
                <div key={g.group_id} style={{ border:'1px solid #e5e7eb', borderRadius:'0.875rem', overflow:'hidden' }}>
                  <div style={{ padding:'0.875rem 1.25rem', backgroundColor:'#f8fafc', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:'0.5rem' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'1rem', color:'#111827', cursor:'pointer' }}
                        onClick={() => openGroupModal(g.group_id, g.group_title)}
                        onMouseEnter={e => (e.currentTarget.style.color='#1d4ed8')}
                        onMouseLeave={e => (e.currentTarget.style.color='#111827')}>{g.group_title}</div>
                      <div style={{ fontSize:'0.8125rem', color:'#6b7280', marginTop:2, display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap' }}>
                        {g.course_title && <span style={{ cursor:'pointer', textDecoration:'none' }}
                          onClick={() => g.course_id && openCourseModal(g.course_id, g.course_title!)}
                          onMouseEnter={e => (e.currentTarget.style.color='#7c3aed')}
                          onMouseLeave={e => (e.currentTarget.style.color='#6b7280')}>{g.course_title}</span>}
                        {g.teacher_name && <span style={{ padding:'2px 8px', backgroundColor:'#fef3c7', borderRadius:6, fontSize:'0.75rem', color:'#92400e', fontWeight:500, cursor:'pointer' }}
                          onClick={() => g.teacher_id && openTeacherModal(g.teacher_id, g.teacher_name!)}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor='#fde68a'; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor='#fef3c7'; }}>{g.teacher_name}</span>}
                        <span style={{ padding:'2px 8px', backgroundColor:'#f3f4f6', borderRadius:6, fontSize:'0.75rem', color:'#6b7280' }}>
                          {g.lessons.length} {g.lessons.length === 1 ? 'заняття' : 'занять'} у місяці
                        </span>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      <span style={{ fontSize:'0.8125rem', color:'#6b7280' }}>{g.students.length} учнів</span>
                      <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:44, height:26, padding:'0 0.625rem', backgroundColor: g.avg_rate >= 80 ? '#16a34a' : g.avg_rate >= 60 ? '#d97706' : '#dc2626', color:'white', borderRadius:13, fontSize:'0.8125rem', fontWeight:600 }}>{g.avg_rate}%</span>
                    </div>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
                      <thead>
                        <tr style={{ backgroundColor:'#fafafa', borderBottom:'1px solid #f3f4f6' }}>
                          <th style={{ padding:'0.625rem 1.25rem', textAlign:'left', fontWeight:600, color:'#374151', fontSize:'0.8125rem', position:'sticky', left:0, backgroundColor:'#fafafa', minWidth:160, whiteSpace:'nowrap' }}>Учень</th>
                          {g.lessons.map(l => (
                            <th key={l.lesson_id} style={{ padding:'0.375rem 0.625rem', textAlign:'center', fontWeight:600, color:'#374151', whiteSpace:'nowrap', cursor:'pointer' }}
                              title={l.topic ? `${l.topic} — відкрити заняття` : 'Відкрити заняття'}
                              onClick={() => openLessonModal(l.lesson_id, `Заняття #${l.lesson_id}`, undefined)}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor='#eef2ff')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor='')}>
                              <div style={{ fontSize:'0.65rem', color:'#9ca3af', fontWeight:500 }}>{getWeekdayShort(l.lesson_date)}</div>
                              <div style={{ fontSize:'0.75rem' }}>{formatDateShort(l.lesson_date)}</div>
                              {l.topic && <div style={{ fontSize:'0.55rem', color:'#9ca3af', fontWeight:400, maxWidth:44, overflow:'hidden', textOverflow:'ellipsis' }}>{l.topic}</div>}
                            </th>
                          ))}
                          <th style={{ padding:'0.625rem 1rem', textAlign:'center', fontWeight:600, color:'#374151', fontSize:'0.8125rem', whiteSpace:'nowrap' }}>Всього</th>
                          <th style={{ padding:'0.625rem 1.25rem', textAlign:'left', fontWeight:600, color:'#374151', fontSize:'0.8125rem', minWidth:110 }}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.students.map(s => (
                          <tr key={s.student_id} style={{ borderBottom:'1px solid #f9fafb' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor='#f9fafb')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}>
                            <td style={{ padding:'0.625rem 1.25rem', fontWeight:500, color:'#1d4ed8', position:'sticky', left:0, backgroundColor:'white', whiteSpace:'nowrap', cursor:'pointer' }}
                              onClick={() => openStudentModal(s.student_id, s.student_name)}>{s.student_name}</td>
                            {g.lessons.map(l => (
                              <td key={l.lesson_id} style={{ padding:'0.5rem 0.625rem', textAlign:'center' }}>
                                <AttCell status={s.attendance[l.lesson_id]??null} />
                              </td>
                            ))}
                            <td style={{ padding:'0.625rem 1rem', textAlign:'center', color:'#374151' }}>
                              <span style={{ fontWeight:600, color:'#16a34a' }}>{s.present}</span>
                              <span style={{ color:'#9ca3af' }}>/{g.lessons.length}</span>
                              {s.absent > 0 && <span style={{ color:'#dc2626', marginLeft:4, fontSize:'0.8125rem' }}>({s.absent}✗)</span>}
                            </td>
                            <td style={{ padding:'0.625rem 1.25rem' }}><RateBar rate={s.rate} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {groupedData.individual_lessons.length > 0 && (
          <div>
            <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.75rem' }}>
              Індивідуальні заняття ({groupedData.individual_lessons.length})
            </div>
            <div style={{ border:'1px solid #e8d5ff', borderRadius:'0.875rem', overflow:'hidden', backgroundColor:'#fdf8ff' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor:'#f5eeff', borderBottom:'1px solid #e8d5ff' }}>
                    <th style={{ padding:'0.625rem 1.25rem', textAlign:'left', fontWeight:600, color:'#374151', fontSize:'0.8125rem', whiteSpace:'nowrap' }}>Дата</th>
                    <th style={{ padding:'0.625rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151', fontSize:'0.8125rem', whiteSpace:'nowrap' }}>Час</th>
                    <th style={{ padding:'0.625rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151', fontSize:'0.8125rem', whiteSpace:'nowrap' }}>Викладач</th>
                    <th style={{ padding:'0.625rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151', fontSize:'0.8125rem' }}>Учні та відвідуваність</th>
                    <th style={{ padding:'0.625rem 1.25rem', textAlign:'left', fontWeight:600, color:'#374151', fontSize:'0.8125rem' }}>Тема</th>
                    <th style={{ padding:'0.625rem 0.5rem', width:36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {groupedData.individual_lessons.map(il => (
                    <tr key={il.lesson_id} style={{ borderBottom:'1px solid #f3e8ff' }}>
                      <td style={{ padding:'0.75rem 1.25rem', whiteSpace:'nowrap' }}>
                        <div style={{ fontWeight:600, fontSize:'0.875rem', color:'#111827' }}>{formatDateShort(il.lesson_date)}</div>
                        <div style={{ fontSize:'0.7rem', color:'#9ca3af', marginTop:1 }}>{getWeekdayShort(il.lesson_date)}</div>
                      </td>
                      <td style={{ padding:'0.75rem 0.75rem', whiteSpace:'nowrap' }}>
                        {il.start_time
                          ? <span style={{ padding:'2px 8px', borderRadius:6, backgroundColor:'#f3e8ff', color:'#7c3aed', fontSize:'0.8125rem', fontWeight:600 }}>{il.start_time}</span>
                          : <span style={{ color:'#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding:'0.75rem 0.75rem', whiteSpace:'nowrap', fontSize:'0.8125rem' }}>
                        {il.teacher_name
                          ? <span style={{ color:'#92400e', cursor:'pointer', fontWeight:500 }}
                              onClick={() => il.teacher_id && openTeacherModal(il.teacher_id, il.teacher_name!)}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration='underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration='none')}>{il.teacher_name}</span>
                          : <span style={{ color:'#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding:'0.75rem 0.75rem' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:'0.375rem' }}>
                          {il.students.map(s => (
                            <div key={s.student_id} style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                              <StatusBadge status={s.status} />
                              <span style={{ fontSize:'0.8125rem', color:'#1d4ed8', cursor:'pointer', fontWeight:500 }}
                                onClick={() => openStudentModal(s.student_id, s.student_name)}>{s.student_name}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding:'0.75rem 1.25rem', color:'#6b7280', fontSize:'0.8125rem', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={il.topic||undefined}>
                        {il.topic||<span style={{ color:'#9ca3af' }}>—</span>}
                      </td>
                      <td style={{ padding:'0.75rem 0.5rem' }}>
                        <OpenLessonBtn lessonId={il.lesson_id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Journal (all-time group register) ────────────────────────────────────

  function renderJournalView() {
    return (
      <div className="card" style={{ borderRadius:'1rem', overflow:'hidden' }}>
        {/* Header with group selector */}
        <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #e5e7eb', backgroundColor:'#fafafa', display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' }}>
          <span style={{ fontSize:'0.6875rem', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em' }}>Журнал групи — вся історія</span>
          <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} style={selectStyle}>
            <option value="">Оберіть групу...</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}>Завантаження...</div>
        ) : !selectedGroup ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
            <p style={{ margin:0 }}>Оберіть групу для перегляду журналу</p>
          </div>
        ) : !journalData || journalData.months.length === 0 ? (
          <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
            <p style={{ margin:0 }}>Немає занять для цієї групи</p>
          </div>
        ) : (
          <div>
            {/* Summary stats */}
            <div style={{ padding:'0.75rem 1.5rem', borderBottom:'1px solid #e5e7eb', backgroundColor:'#f8fafc', display:'flex', gap:'1.5rem', flexWrap:'wrap', fontSize:'0.8125rem', color:'#6b7280' }}>
              <span>Група: <strong style={{ color:'#111827' }}>{journalData.group_title}</strong></span>
              <span>Всього місяців: <strong style={{ color:'#111827' }}>{journalData.months.length}</strong></span>
              <span>Всього занять: <strong style={{ color:'#111827' }}>{journalData.months.reduce((s, m) => s + m.lessons.length, 0)}</strong></span>
              <span>Учнів: <strong style={{ color:'#111827' }}>{journalData.students.length}</strong></span>
            </div>

            {/* Months accordion (newest first) */}
            {[...journalData.months].reverse().map(m => {
              const key = `${m.year}-${m.month}`;
              const isOpen = openMonths.has(key);
              const toggle = () => setOpenMonths(prev => {
                const next = new Set(prev);
                if (isOpen) next.delete(key); else next.add(key);
                return next;
              });
              return (
                <div key={key} style={{ borderBottom:'1px solid #e5e7eb' }}>
                  {/* Month header */}
                  <button onClick={toggle} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.875rem 1.5rem', backgroundColor: isOpen ? '#f0f4ff' : 'white', border:'none', cursor:'pointer', textAlign:'left' }}>
                    <span style={{ fontWeight:600, fontSize:'0.9375rem', color:'#111827' }}>
                      {MONTH_UK[m.month]} {m.year}
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
                      <span style={{ fontSize:'0.8125rem', color:'#6b7280' }}>{m.lessons.length} занять</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </button>

                  {/* Matrix table */}
                  {isOpen && (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.8125rem' }}>
                        <thead>
                          <tr style={{ backgroundColor:'#f9fafb' }}>
                            <th style={{ padding:'0.625rem 1.25rem', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', position:'sticky', left:0, backgroundColor:'#f9fafb', minWidth:160, whiteSpace:'nowrap' }}>Учень</th>
                            {m.lessons.map(l => (
                              <th key={l.lesson_id} style={{ padding:'0.375rem 0.625rem', textAlign:'center', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap', minWidth:44, cursor:'pointer' }}
                                title={[l.topic, l.teacher_name].filter(Boolean).join(' · ') || 'Відкрити заняття'}
                                onClick={() => openLessonModal(l.lesson_id, `Заняття #${l.lesson_id}`, undefined)}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor='#eef2ff')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor='')}>
                                <div style={{ fontSize:'0.6rem', color:'#9ca3af', fontWeight:500 }}>{getWeekdayShort(l.lesson_date)}</div>
                                <div>{formatDateShort(l.lesson_date)}</div>
                                {l.topic && <div style={{ fontSize:'0.55rem', color:'#9ca3af', fontWeight:400, maxWidth:44, overflow:'hidden', textOverflow:'ellipsis' }}>{l.topic}</div>}
                                {l.teacher_name && <div style={{ fontSize:'0.5rem', color:'#92400e', fontWeight:500, maxWidth:44, overflow:'hidden', textOverflow:'ellipsis' }}>{l.teacher_name}</div>}
                              </th>
                            ))}
                            <th style={{ padding:'0.625rem 0.875rem', textAlign:'center', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' }}>За місяць</th>
                            <th style={{ padding:'0.625rem 1.25rem', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', minWidth:100, whiteSpace:'nowrap' }}>Всього %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {journalData.students.map(s => {
                            const monthPresent = m.lessons.filter(l => { const st = s.attendance[l.lesson_id]; return st === 'present' || st === 'makeup_done'; }).length;
                            return (
                              <tr key={s.student_id} style={{ borderBottom:'1px solid #f3f4f6' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor='#f9fafb')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}>
                                <td style={{ padding:'0.625rem 1.25rem', fontWeight:500, color:'#1d4ed8', position:'sticky', left:0, backgroundColor:'white', whiteSpace:'nowrap', cursor:'pointer' }}
                                  onClick={() => openStudentModal(s.student_id, s.student_name)}>{s.student_name}</td>
                                {m.lessons.map(l => (
                                  <td key={l.lesson_id} style={{ padding:'0.625rem 0.5rem', textAlign:'center' }}>
                                    <AttCell status={s.attendance[l.lesson_id] ?? null} />
                                  </td>
                                ))}
                                <td style={{ padding:'0.625rem 0.875rem', textAlign:'center', color:'#374151', fontSize:'0.8125rem' }}>
                                  <span style={{ fontWeight:600, color:'#16a34a' }}>{monthPresent}</span>
                                  <span style={{ color:'#9ca3af' }}>/{m.lessons.length}</span>
                                </td>
                                <td style={{ padding:'0.625rem 1.25rem' }}><RateBar rate={s.rate} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Register ─────────────────────────────────────────────────────────────

  function renderRegisterView() {
    if (!selectedGroup) return <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}><p style={{ margin:'0 0 0.5rem 0' }}>Оберіть групу для перегляду журналу</p></div>;
    if (!register || register.lessons.length === 0) return <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}><p style={{ margin:0 }}>У цьому місяці немає занять для обраної групи</p></div>;
    return (
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor:'#f9fafb' }}>
              <th style={{ padding:'0.875rem 1.5rem', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', position:'sticky', left:0, backgroundColor:'#f9fafb', minWidth:180, whiteSpace:'nowrap' }}>Учень</th>
              {register.lessons.map(l => (
                <th key={l.lesson_id} style={{ padding:'0.5rem 0.875rem', textAlign:'center', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' }} title={l.topic||undefined}>
                  <div style={{ fontSize:'0.65rem', color:'#9ca3af', fontWeight:500 }}>{getWeekdayShort(l.lesson_date)}</div>
                  <div>{formatDateShort(l.lesson_date)}</div>
                  {l.topic && <div style={{ fontSize:'0.6rem', color:'#9ca3af', fontWeight:400, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis' }}>{l.topic}</div>}
                </th>
              ))}
              <th style={{ padding:'0.875rem 1rem', textAlign:'center', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', whiteSpace:'nowrap' }}>Всього</th>
              <th style={{ padding:'0.875rem 1.5rem', textAlign:'left', fontWeight:600, color:'#374151', borderBottom:'2px solid #e5e7eb', minWidth:120, whiteSpace:'nowrap' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {register.students.map(s => (
              <tr key={s.student_id} style={{ borderBottom:'1px solid #f3f4f6' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor='#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}>
                <td style={{ padding:'0.875rem 1.5rem', fontWeight:500, color:'#1d4ed8', position:'sticky', left:0, backgroundColor:'white', whiteSpace:'nowrap', cursor:'pointer' }}
                  onClick={() => openStudentModal(s.student_id, s.student_name)}>{s.student_name}</td>
                {register.lessons.map(l => (
                  <td key={l.lesson_id} style={{ padding:'0.875rem 1rem', textAlign:'center' }}>
                    <AttCell status={s.attendance[l.lesson_id]??null} />
                  </td>
                ))}
                <td style={{ padding:'0.875rem 1rem', textAlign:'center', color:'#374151' }}>
                  <span style={{ fontWeight:600, color:'#16a34a' }}>{s.present}</span>
                  <span style={{ color:'#9ca3af' }}>/{register.lessons.length}</span>
                  {s.absent > 0 && <span style={{ color:'#dc2626', marginLeft:6 }}>({s.absent}✗)</span>}
                </td>
                <td style={{ padding:'0.875rem 1.5rem' }}><RateBar rate={s.rate} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Summary / All-time flat list ──────────────────────────────────────────

  function renderSummaryView() {
    const filteredRecords = statusFilter === 'null'
      ? lessonRecords.filter(r => r.status === null)
      : statusFilter
        ? lessonRecords.filter(r => r.status === statusFilter)
        : lessonRecords;
    if (filteredRecords.length === 0) {
      return <div style={{ padding:'3rem', textAlign:'center', color:'#9ca3af' }}>
        <p style={{ margin:'0 0 0.5rem 0' }}>Даних про відвідуваність немає</p>
        <p style={{ margin:0, fontSize:'0.8125rem' }}>
          {allTime ? 'Спробуйте змінити фільтри або зачекайте, поки заняття буде проведено' : 'Відвідуваність з\'явиться після того, як викладач відмітить присутність'}
        </p>
      </div>;
    }
    return (
      <div style={{ overflowX:'auto' }}>
        <div style={{ padding:'0.5rem 1.25rem', borderBottom:'1px solid #f3f4f6', backgroundColor:'#fafafa', fontSize:'0.75rem', color:'#6b7280' }}>
          Знайдено: <strong style={{ color:'#374151' }}>{filteredRecords.length}</strong> записів
          {statusFilter && lessonRecords.length !== filteredRecords.length && (
            <span style={{ marginLeft:'0.5rem', color:'#9ca3af' }}>(з {lessonRecords.length})</span>
          )}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor:'#f9fafb', borderBottom:'2px solid #e5e7eb' }}>
              <th style={{ padding:'0.75rem 1.25rem', textAlign:'left', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>Дата</th>
              <th style={{ padding:'0.75rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>Час</th>
              <th style={{ padding:'0.75rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151' }}>Тип / Група</th>
              {allTime && <th style={{ padding:'0.75rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151' }}>Курс</th>}
              <th style={{ padding:'0.75rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151' }}>Викладач</th>
              <th style={{ padding:'0.75rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151' }}>Учень</th>
              <th style={{ padding:'0.75rem 0.75rem', textAlign:'left', fontWeight:600, color:'#374151' }}>Тема</th>
              <th style={{ padding:'0.75rem 1.25rem', textAlign:'center', fontWeight:600, color:'#374151' }}>Статус</th>
              <th style={{ padding:'0.75rem 0.5rem', width:36 }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((r, i) => (
              <tr key={`${r.lesson_id}-${r.student_id}-${i}`}
                style={{ borderBottom:'1px solid #f3f4f6' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor='#f9fafb')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor='transparent')}>
                <td style={{ padding:'0.625rem 1.25rem', whiteSpace:'nowrap' }}>
                  <div style={{ fontWeight:500, color:'#111827' }}>{formatDateShort(r.lesson_date)}</div>
                  <div style={{ fontSize:'0.7rem', color:'#9ca3af' }}>{getWeekdayShort(r.lesson_date)}</div>
                </td>
                <td style={{ padding:'0.625rem 0.75rem', color:'#6b7280', whiteSpace:'nowrap' }}>
                  {r.start_time
                    ? <span style={{ padding:'1px 7px', borderRadius:4, backgroundColor:'#f3f4f6', color:'#374151', fontSize:'0.8125rem' }}>{r.start_time}</span>
                    : '—'}
                </td>
                <td style={{ padding:'0.625rem 0.75rem' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.375rem', flexWrap:'wrap' }}>
                    <span style={{ padding:'1px 7px', borderRadius:4, fontSize:'0.7rem', fontWeight:600, backgroundColor: r.group_id ? '#dbeafe' : '#f3e8ff', color: r.group_id ? '#1d4ed8' : '#7c3aed' }}>
                      {r.group_id ? 'Групове' : 'Індив.'}
                    </span>
                    {r.group_id
                      ? <span style={{ color:'#1d4ed8', fontSize:'0.8125rem', cursor:'pointer', fontWeight:500 }}
                          onClick={() => openGroupModal(r.group_id!, r.group_title)}>{r.group_title}</span>
                      : <span style={{ color:'#6b7280', fontSize:'0.8125rem' }}>{r.group_title}</span>}
                  </div>
                </td>
                {allTime && <td style={{ padding:'0.625rem 0.75rem', fontSize:'0.8125rem' }}>
                  {r.course_title && r.course_id
                    ? <span style={{ color:'#7c3aed', cursor:'pointer', fontWeight:500 }}
                        onClick={() => openCourseModal(r.course_id!, r.course_title!)}>{r.course_title}</span>
                    : <span style={{ color:'#6b7280' }}>{r.course_title||'—'}</span>}
                </td>}
                <td style={{ padding:'0.625rem 0.75rem', fontSize:'0.8125rem', whiteSpace:'nowrap' }}>
                  {r.teacher_name && r.teacher_id
                    ? <span style={{ color:'#92400e', cursor:'pointer', fontWeight:500 }}
                        onClick={() => openTeacherModal(r.teacher_id!, r.teacher_name!)}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration='underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration='none')}>{r.teacher_name}</span>
                    : <span style={{ color:'#6b7280' }}>—</span>}
                </td>
                <td style={{ padding:'0.625rem 0.75rem', fontWeight:500 }}>
                  <span style={{ color:'#1d4ed8', cursor:'pointer' }}
                    onClick={() => openStudentModal(r.student_id, r.student_name)}>{r.student_name}</span>
                </td>
                <td style={{ padding:'0.625rem 0.75rem', color:'#6b7280', fontSize:'0.8125rem', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.topic||undefined}>{r.topic||'—'}</td>
                <td style={{ padding:'0.625rem 1.25rem', textAlign:'center' }}>
                  <StatusLabel status={r.status} />
                </td>
                <td style={{ padding:'0.625rem 0.5rem' }}>
                  <OpenLessonBtn lessonId={r.lesson_id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
}
