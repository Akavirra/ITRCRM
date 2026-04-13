'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, useUser } from '@/components/UserContext';
import { useLessonModals } from '@/components/LessonModalsContext';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useCourseModals } from '@/components/CourseModalsContext';
import { format, addWeeks, subWeeks, addMonths, subMonths, startOfWeek, endOfWeek, addDays, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval, isSameMonth } from 'date-fns';
import { uk } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, CalendarDays, Clock, User as UserIcon, Users, BookOpen, Check, X, RefreshCw, Plus } from 'lucide-react';
import PageLoading from '@/components/PageLoading';
import CreateLessonModal from '@/components/CreateLessonModal';


interface Lesson {
  id: number;
  groupId: number;
  groupTitle: string;
  courseId: number;
  courseTitle: string;
  teacherId: number;
  teacherName: string;
  originalTeacherId?: number;
  isReplaced?: boolean;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic: string | null;
  originalDate?: string | null;
  isRescheduled?: boolean;
  isMakeup?: boolean;
  isTrial?: boolean;
}

interface DaySchedule {
  date: string;
  dayOfWeek: number;
  dayName: string;
  lessons: Lesson[];
}

interface ScheduleResponse {
  weekStart: string;
  weekEnd: string;
  days: DaySchedule[];
  totalLessons: number;
}

const HYDRATION_SAFE_DATE = new Date('2000-01-03T00:00:00');

export default function SchedulePage() {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    HYDRATION_SAFE_DATE
  );
  const [currentMonth, setCurrentMonth] = useState<Date>(HYDRATION_SAFE_DATE);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [isNavigating, setIsNavigating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDateContextReady, setIsDateContextReady] = useState(false);
  const [todayKey, setTodayKey] = useState('');

  // Filters
  const [groupFilter, setGroupFilter] = useState<string>('');
  const [teacherFilter, setTeacherFilter] = useState<string>('');

  // Use global lesson modals instead of local state
  const { openLessonModal } = useLessonModals();
  const { openGroupModal } = useGroupModals();
  const { openCourseModal } = useCourseModals();

  // Generate modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Create lesson modal state
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);

  const buildScheduleUrl = useCallback(() => {
    let startDateStr: string;
    let endDateStr: string;

    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      startDateStr = format(calendarStart, 'yyyy-MM-dd');
      endDateStr = format(calendarEnd, 'yyyy-MM-dd');
    } else {
      startDateStr = format(currentWeekStart, 'yyyy-MM-dd');
      endDateStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
    }

    let url = `/api/schedule?startDate=${startDateStr}&endDate=${endDateStr}`;
    if (groupFilter) url += `&groupId=${groupFilter}`;
    if (teacherFilter) url += `&teacherId=${teacherFilter}`;
    return url;
  }, [viewMode, currentWeekStart, currentMonth, groupFilter, teacherFilter]);

  // Full navigation fetch — dims the grid, shows loading state
  const fetchSchedule = useCallback(async () => {
    setIsNavigating(true);
    try {
      const res = await fetch(buildScheduleUrl());
      const data = await res.json();
      setSchedule(data);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoading(false);
      setTimeout(() => setIsNavigating(false), 200);
    }
  }, [buildScheduleUrl]);

  // Silent background refresh — no visual dimming, just a thin indicator
  const silentRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(buildScheduleUrl());
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [buildScheduleUrl]);

  // Listen for lesson changes from modals
  useEffect(() => {
    window.addEventListener('itrobot-lesson-deleted', silentRefresh);
    window.addEventListener('itrobot-lesson-updated', silentRefresh);
    return () => {
      window.removeEventListener('itrobot-lesson-deleted', silentRefresh);
      window.removeEventListener('itrobot-lesson-updated', silentRefresh);
    };
  }, [silentRefresh]);

  useEffect(() => {
    const now = new Date();
    setCurrentWeekStart(startOfWeek(now, { weekStartsOn: 1, locale: uk }));
    setCurrentMonth(now);
    setTodayKey(format(now, 'yyyy-MM-dd'));
    setIsDateContextReady(true);
  }, []);

  useEffect(() => {
    if (user && isDateContextReady) {
      fetchSchedule();
    }
  }, [user, fetchSchedule, isDateContextReady]);

  const goToPreviousWeek = () => {
    setIsNavigating(true);
    setCurrentWeekStart(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setIsNavigating(true);
    setCurrentWeekStart(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setIsNavigating(true);
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1, locale: uk }));
  };

  const goToPreviousMonth = () => {
    setIsNavigating(true);
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setIsNavigating(true);
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const goToCurrentMonth = () => {
    setIsNavigating(true);
    setCurrentMonth(new Date());
  };

  const handleLessonClick = (lesson: Lesson) => {
    openLessonModal(lesson.id, `Заняття #${lesson.id}`, {
      id: lesson.id,
      courseId: lesson.courseId,
      groupId: lesson.groupId,
      groupTitle: lesson.groupTitle,
      courseTitle: lesson.courseTitle,
      teacherId: lesson.teacherId,
      teacherName: lesson.teacherName,
      originalTeacherId: lesson.originalTeacherId,
      isReplaced: lesson.isReplaced,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      status: lesson.status,
      topic: lesson.topic,
      isMakeup: lesson.isMakeup,
      isTrial: lesson.isTrial,
    });
  };

  const handleGroupClick = (e: React.MouseEvent, lesson: Lesson) => {
    e.stopPropagation();
    if (lesson.groupId) openGroupModal(lesson.groupId, lesson.groupTitle);
  };

  const handleCourseClick = (e: React.MouseEvent, lesson: Lesson) => {
    e.stopPropagation();
    openCourseModal(lesson.courseId, lesson.courseTitle);
  };

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/schedule/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(`Згенеровано ${data.totalGenerated} занять (${data.monthsLabel}), пропущено ${data.totalSkipped}`);
        fetchSchedule();
        setShowGenerateModal(false);
      } else {
        alert(data.error || 'Не вдалося згенерувати заняття');
      }
    } catch (error) {
      console.error('Failed to generate lessons:', error);
      alert('Сталася помилка при генерації занять');
    } finally {
      setGenerating(false);
    }
  };

  // Returns card background/border based on lesson TYPE (for scheduled)
  // and lesson STATUS (for done/canceled — status overrides type color)
  const getLessonStyle = (status: string, isMakeup?: boolean, groupId?: number | null) => {
    if (status === 'done')    return { background: '#f0fdf4', borderColor: '#16a34a', color: '#166534', accentColor: '#16a34a' };
    if (status === 'canceled') return { background: '#fef2f2', borderColor: '#dc2626', color: '#991b1b', accentColor: '#dc2626' };
    // Scheduled — differentiate by type
    if (isMakeup)  return { background: '#fff7ed', borderColor: '#f97316', color: '#7c2d12', accentColor: '#f97316' };
    if (!groupId)  return { background: '#f5f3ff', borderColor: '#8b5cf6', color: '#4c1d95', accentColor: '#8b5cf6' };
    return               { background: '#eff6ff', borderColor: '#3b82f6', color: '#1e40af', accentColor: '#3b82f6' };
  };

  const getStatusBadgeStyle = (status: string, isMakeup?: boolean, groupId?: number | null) => {
    if (status === 'done')    return { background: '#16a34a', color: 'white' };
    if (status === 'canceled') return { background: '#dc2626', color: 'white' };
    if (isMakeup)  return { background: '#f97316', color: 'white' };
    if (!groupId)  return { background: '#8b5cf6', color: 'white' };
    return               { background: '#3b82f6', color: 'white' };
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, 'd MMM', { locale: uk });
  };

  const isToday = (dateStr: string) => {
    const date = parseISO(dateStr);
    return todayKey !== '' && todayKey === format(date, 'yyyy-MM-dd');
  };

  if (loading) {
    return <PageLoading />;
  }

  if (!user) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
      }}>
        <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Перенаправлення...</div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <h1 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 600, 
          margin: 0, 
          color: '#111827',
        }}>
          Розклад занять
        </h1>
        
        {(user?.role === 'admin' || user?.role === 'teacher') && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {user?.role === 'admin' && (
              <button
                onClick={() => setShowCreateLessonModal(true)}
                className="btn btn-primary"
                style={{ gap: '0.5rem' }}
              >
                <Plus size={14} />
                Створити
              </button>
            )}
            <button
              onClick={() => setShowGenerateModal(true)}
              className="btn btn-secondary"
              style={{ gap: '0.5rem' }}
            >
              <RefreshCw size={14} />
              Згенерувати
            </button>
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: '#f3f4f6', borderRadius: '0.5rem', padding: '0.25rem', width: 'fit-content' }}>
        <button
          onClick={() => setViewMode('week')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 500,
            borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
            background: viewMode === 'week' ? 'white' : 'transparent',
            color: viewMode === 'week' ? '#111827' : '#6b7280',
            boxShadow: viewMode === 'week' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <Calendar size={14} />
          Тиждень
        </button>
        <button
          onClick={() => setViewMode('month')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 500,
            borderRadius: '0.375rem', border: 'none', cursor: 'pointer',
            background: viewMode === 'month' ? 'white' : 'transparent',
            color: viewMode === 'month' ? '#111827' : '#6b7280',
            boxShadow: viewMode === 'month' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <CalendarDays size={14} />
          Місяць
        </button>
      </div>

      {/* Navigator */}
      <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden', position: 'relative' }}>
        {/* Loading bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          overflow: 'hidden', borderRadius: '0.5rem 0.5rem 0 0',
          opacity: (isNavigating || isRefreshing) ? 1 : 0, transition: 'opacity 0.3s ease',
        }}>
          <div style={{
            width: '40%', height: '100%',
            background: isNavigating
              ? 'linear-gradient(90deg, transparent, #3b82f6, transparent)'
              : 'linear-gradient(90deg, transparent, #10b981, transparent)',
            animation: 'nav-loading 1.2s ease-in-out infinite',
          }} />
        </div>

        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <button
              onClick={viewMode === 'week' ? goToPreviousWeek : goToPreviousMonth}
              disabled={isNavigating}
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.2s ease', opacity: isNavigating ? 0.6 : 1, minWidth: '110px',
              }}
            >
              <ChevronLeft size={16} style={{ flexShrink: 0 }} />
              Попередній
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '0.9375rem', fontWeight: 600, color: '#111827',
                textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem',
                transition: 'opacity 0.2s ease', opacity: isNavigating ? 0.4 : 1,
              }}>
                {viewMode === 'week'
                  ? schedule?.weekStart && format(parseISO(schedule.weekStart), 'LLLL yyyy', { locale: uk })
                  : format(currentMonth, 'LLLL yyyy', { locale: uk })
                }
              </div>
              {viewMode === 'week' && (
                <div style={{ fontSize: '1.125rem', fontWeight: 500, color: '#111827', transition: 'opacity 0.2s ease', opacity: isNavigating ? 0.4 : 1 }}>
                  {schedule?.weekStart && formatDate(schedule.weekStart)} — {schedule?.weekEnd && formatDate(schedule.weekEnd)}
                </div>
              )}
              {viewMode === 'month' && schedule && (
                <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                  {schedule.totalLessons} {schedule.totalLessons === 1 ? 'заняття' : 'занять'} за період
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  onClick={viewMode === 'week' ? goToCurrentWeek : goToCurrentMonth}
                  disabled={isNavigating}
                  style={{
                    fontSize: '0.8125rem', fontWeight: 500, color: '#3b82f6',
                    background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '0.5rem',
                    cursor: isNavigating ? 'not-allowed' : 'pointer',
                    padding: '0.375rem 0.75rem', transition: 'all 0.15s ease',
                    opacity: isNavigating ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => { if (!isNavigating) { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {viewMode === 'week' ? 'Поточний тиждень' : 'Поточний місяць'}
                </button>
                {isRefreshing && !isNavigating && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: '#10b981', fontWeight: 500, animation: 'fadeIn 0.2s ease' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 1s ease-in-out infinite', flexShrink: 0 }} />
                    оновлення
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={viewMode === 'week' ? goToNextWeek : goToNextMonth}
              disabled={isNavigating}
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 0.75rem', fontSize: '0.8125rem',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                transition: 'all 0.2s ease', opacity: isNavigating ? 0.6 : 1,
                minWidth: '110px', justifyContent: 'flex-end',
              }}
            >
              Наступний
              <ChevronRight size={16} style={{ flexShrink: 0 }} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes nav-loading { 0% { transform: translateX(-120%); } 100% { transform: translateX(300%); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .schedule-scroll { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
        .schedule-scroll::-webkit-scrollbar { height: 6px; }
        .schedule-scroll::-webkit-scrollbar-track { background: transparent; }
        .schedule-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .schedule-grid { animation: fadeIn 0.3s ease-out; }
        .schedule-day { animation: fadeIn 0.4s ease-out backwards; }
        ${[0,1,2,3,4,5,6].map(i => `.schedule-day:nth-child(${i + 1}) { animation-delay: ${i * 0.05}s; }`).join('\n')}
        @media (max-width: 900px) { .schedule-grid { grid-template-columns: repeat(7, minmax(160px, 1fr)) !important; } }
        @media (max-width: 600px) { .schedule-grid { grid-template-columns: repeat(7, minmax(140px, 1fr)) !important; } }
        .month-cell:hover { background: #f9fafb !important; }
      `}</style>

      {/* ========== WEEK VIEW ========== */}
      {viewMode === 'week' && (
        <div className="schedule-scroll" style={{ overflowX: 'auto', marginLeft: '-0.5rem', marginRight: '-0.5rem', paddingLeft: '0.5rem', paddingRight: '0.5rem', paddingBottom: '0.5rem' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, minmax(180px, 1fr))',
            gap: '0.75rem', minHeight: '400px',
            transition: 'opacity 0.25s ease', opacity: isNavigating ? 0.5 : 1,
          }} className="schedule-grid">
            {schedule?.days.map((day) => {
              const todayStyle = isToday(day.date) ? {
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                border: '2px solid #3b82f6',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              } : {};

              return (
                <div key={day.date} className="card" style={{ minHeight: '200px', ...todayStyle }}>
                  <div className="card-body" style={{ padding: '0.75rem' }}>
                    {/* Day Header */}
                    <div style={{ textAlign: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: isToday(day.date) ? '2px solid #3b82f6' : '1px solid #e5e7eb' }}>
                      {isToday(day.date) && (
                        <div style={{ background: '#3b82f6', color: 'white', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', marginBottom: '0.25rem', display: 'inline-block' }}>
                          Сьогодні
                        </div>
                      )}
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: isToday(day.date) ? '#3b82f6' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {day.dayName}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginTop: '0.125rem' }}>
                        {format(parseISO(day.date), 'd.MM')}
                      </div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#3b82f6', marginTop: '0.25rem' }}>
                        {day.lessons.length} {day.lessons.length === 1 ? 'заняття' : 'занять'}
                      </div>
                    </div>

                    {/* Lessons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {day.lessons.map((lesson) => {
                        const lessonStyle = getLessonStyle(lesson.status, lesson.isMakeup, lesson.groupId);
                        return (
                          <div
                            key={lesson.id}
                            onClick={() => handleLessonClick(lesson)}
                            style={{
                              padding: '0.625rem', borderRadius: '0.5rem', cursor: 'pointer',
                              borderLeft: '3px solid', borderColor: lessonStyle.borderColor,
                              background: lessonStyle.background, transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            {lesson.isMakeup ? (
                              <div style={{ fontSize: '0.625rem', fontWeight: 700, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '0.25rem', padding: '0.125rem 0.375rem', marginBottom: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                <RefreshCw size={8} /> Відпрацювання
                              </div>
                            ) : !lesson.groupId && lesson.isTrial ? (
                              <div style={{ fontSize: '0.625rem', fontWeight: 700, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: '0.25rem', padding: '0.125rem 0.375rem', marginBottom: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                <Check size={8} /> Пробне
                              </div>
                            ) : !lesson.groupId ? (
                              <div style={{ fontSize: '0.625rem', fontWeight: 700, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', borderRadius: '0.25rem', padding: '0.125rem 0.375rem', marginBottom: '0.3rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                <UserIcon size={8} /> Індивідуальне
                              </div>
                            ) : null}

                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: lessonStyle.accentColor, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={10} /> {lesson.startTime} - {lesson.endTime}
                            </div>

                            {lesson.groupId && !lesson.isMakeup && (
                              <div onClick={(e) => handleGroupClick(e, lesson)} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', transition: 'color 0.15s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#3b82f6'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#111827'; }}
                              >
                                <Users size={10} /> {lesson.groupTitle}
                              </div>
                            )}

                            {lesson.courseTitle && (
                              <div onClick={(e) => handleCourseClick(e, lesson)} style={{ fontSize: '0.8125rem', color: lessonStyle.accentColor, display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem', cursor: 'pointer', transition: 'color 0.15s ease', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                              >
                                <BookOpen size={9} /> {lesson.courseTitle}
                              </div>
                            )}
                            <div style={{ fontSize: '0.8125rem', color: lesson.isReplaced ? '#d97706' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.125rem' }}>
                              <UserIcon size={9} /> {lesson.teacherName}
                              {lesson.isReplaced && (
                                <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.625rem', padding: '0.0625rem 0.25rem', borderRadius: '0.125rem', marginLeft: '0.125rem' }}>(Зам.)</span>
                              )}
                            </div>
                            {lesson.isRescheduled && lesson.originalDate && (
                              <div style={{ fontSize: '0.6875rem', color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '0.25rem', padding: '0.125rem 0.375rem', marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <RefreshCw size={8} /> Перенесено з {format(new Date(lesson.originalDate + 'T00:00:00'), 'd MMM', { locale: uk })}
                              </div>
                            )}
                            {lesson.topic && (
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem', fontStyle: 'italic' }}>{lesson.topic}</div>
                            )}
                            <div style={{ ...getStatusBadgeStyle(lesson.status, lesson.isMakeup, lesson.groupId), fontSize: '0.6875rem', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.125rem', marginTop: '0.375rem' }}>
                              {lesson.status === 'done' && <Check size={8} />}
                              {lesson.status === 'canceled' && <X size={8} />}
                              {lesson.status === 'scheduled' && <Calendar size={8} />}
                              {lesson.status === 'done' ? 'Проведено' : lesson.status === 'canceled' ? 'Скасовано' : 'Заплановано'}
                            </div>
                          </div>
                        );
                      })}

                      {day.lessons.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', padding: '1rem 0' }}>
                          <Calendar size={20} style={{ opacity: 0.3, marginBottom: '0.25rem' }} />
                          <div>Немає занять</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========== MONTH VIEW ========== */}
      {viewMode === 'month' && (
        <div style={{ transition: 'opacity 0.25s ease', opacity: isNavigating ? 0.5 : 1 }}>
          {/* Day-of-week header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '1px' }}>
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
              <div key={d} style={{
                textAlign: 'center', padding: '0.5rem', fontSize: '0.75rem', fontWeight: 600,
                color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px',
                background: '#f9fafb', borderRadius: d === 'Пн' ? '0.5rem 0 0 0' : d === 'Нд' ? '0 0.5rem 0 0' : '0',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb', borderRadius: '0 0 0.5rem 0.5rem' }}>
            {(() => {
              if (!schedule?.days) return null;
              const daysMap: Record<string, DaySchedule> = {};
              schedule.days.forEach(d => { daysMap[d.date] = d; });

              const mStart = startOfMonth(currentMonth);
              const mEnd = endOfMonth(currentMonth);
              const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
              const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 });

              const cells: React.ReactNode[] = [];
              let cursor = calStart;
              while (cursor <= calEnd) {
                const dateStr = format(cursor, 'yyyy-MM-dd');
                const dayData = daysMap[dateStr];
                const inMonth = isSameMonth(cursor, currentMonth);
                const today = isToday(dateStr);
                const dayNum = cursor.getDate();

                cells.push(
                  <div
                    key={dateStr}
                    className="month-cell"
                    style={{
                      background: today ? '#eff6ff' : 'white',
                      minHeight: '110px',
                      padding: '0.375rem',
                      display: 'flex',
                      flexDirection: 'column',
                      opacity: inMonth ? 1 : 0.4,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Date number */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{
                        fontSize: '0.8125rem', fontWeight: today ? 700 : 500,
                        color: today ? 'white' : '#374151',
                        background: today ? '#3b82f6' : 'transparent',
                        borderRadius: '50%',
                        width: today ? '24px' : 'auto',
                        height: today ? '24px' : 'auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {dayNum}
                      </span>
                      {dayData && dayData.lessons.length > 0 && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#3b82f6' }}>
                          {dayData.lessons.length}
                        </span>
                      )}
                    </div>

                    {/* Compact lesson list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', flex: 1 }}>
                      {dayData?.lessons.slice(0, 4).map(lesson => {
                        const style = getLessonStyle(lesson.status, lesson.isMakeup, lesson.groupId);
                        return (
                          <div
                            key={lesson.id}
                            onClick={() => handleLessonClick(lesson)}
                            style={{
                              fontSize: '0.6875rem',
                              padding: '0.125rem 0.25rem',
                              borderRadius: '0.25rem',
                              background: style.background,
                              borderLeft: `2px solid ${style.borderColor}`,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: style.color,
                              lineHeight: '1.4',
                              transition: 'all 0.1s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                            title={`${lesson.startTime}-${lesson.endTime} ${lesson.groupTitle} — ${lesson.courseTitle}`}
                          >
                            <span style={{ fontWeight: 600 }}>{lesson.startTime}</span>
                            {' '}
                            {lesson.groupId ? lesson.groupTitle : lesson.courseTitle}
                          </div>
                        );
                      })}
                      {dayData && dayData.lessons.length > 4 && (
                        <div style={{ fontSize: '0.625rem', color: '#6b7280', textAlign: 'center', paddingTop: '1px' }}>
                          +{dayData.lessons.length - 4} ще
                        </div>
                      )}
                    </div>
                  </div>
                );
                cursor = addDays(cursor, 1);
              }
              return cells;
            })()}
          </div>
        </div>
      )}

      {showGenerateModal && (
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
          onClick={() => setShowGenerateModal(false)}
        >
          <div 
            className="card"
            style={{ width: '100%', maxWidth: '380px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="card-body" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>
                Генерація занять
              </h3>
              
              <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                Це створить заняття для всіх активних груп на поточний та наступний місяць.
              </p>
              
              <div style={{ 
                marginBottom: '1.25rem', 
                padding: '0.75rem', 
                background: '#eff6ff', 
                borderRadius: '0.5rem',
                border: '1px solid #dbeafe'
              }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#1e40af' }}>
                  Період генерації:
                </div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#3b82f6', marginTop: '0.25rem' }}>
                  Поточний місяць + Наступний місяць
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleGenerateAll}
                  disabled={generating}
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.8125rem', padding: '0.625rem' }}
                >
                  <RefreshCw size={14} className={generating ? 'spin' : ''} />
                  {generating ? 'Генерація...' : 'Згенерувати'}
                </button>
                
                <button
                  onClick={() => setShowGenerateModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', padding: '0.625rem 1rem' }}
                >
                  Скасувати
                </button>
              </div>
              
              <style>{`
                .spin {
                  animation: spin 1s linear infinite;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          </div>
        </div>
      )}

      {/* Create Lesson Modal */}
      <CreateLessonModal
        isOpen={showCreateLessonModal}
        onClose={() => setShowCreateLessonModal(false)}
        onSuccess={() => fetchSchedule()}
      />
    </>
  );
}
