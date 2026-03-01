'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useLessonModals } from '@/components/LessonModalsContext';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useCourseModals } from '@/components/CourseModalsContext';
import { format, addWeeks, subWeeks, startOfWeek, addDays, parseISO, startOfMonth, endOfMonth, eachWeekOfInterval } from 'date-fns';
import { uk } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Users, BookOpen, Check, X, RefreshCw } from 'lucide-react';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

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

export default function SchedulePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1, locale: uk })
  );
  const [isNavigating, setIsNavigating] = useState(false);

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

  const fetchSchedule = useCallback(async () => {
    setIsNavigating(true);
    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const weekEndStr = format(addDays(currentWeekStart, 6), 'yyyy-MM-dd');
    
    let url = `/api/schedule?startDate=${weekStartStr}&endDate=${weekEndStr}`;
    if (groupFilter) url += `&groupId=${groupFilter}`;
    if (teacherFilter) url += `&teacherId=${teacherFilter}`;
    
    const res = await fetch(url);
    const data = await res.json();
    setSchedule(data);
    setTimeout(() => setIsNavigating(false), 300);
  }, [currentWeekStart, groupFilter, teacherFilter]);

  // Listen for lesson deletion to refresh schedule
  useEffect(() => {
    const handleLessonDeleted = () => {
      fetchSchedule();
    };
    
    window.addEventListener('itrobot-lesson-deleted', handleLessonDeleted);
    window.addEventListener('itrobot-lesson-updated', fetchSchedule);
    return () => {
      window.removeEventListener('itrobot-lesson-deleted', handleLessonDeleted);
      window.removeEventListener('itrobot-lesson-updated', fetchSchedule);
    };
  }, [fetchSchedule]);

  useEffect(() => {
    const checkAuth = async () => {
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) {
        router.push('/login');
        return;
      }
      const authData = await authRes.json();
      setUser(authData.user);
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!loading && user) {
      fetchSchedule();
    }
  }, [loading, user, fetchSchedule]);

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
    });
  };

  const handleGroupClick = (e: React.MouseEvent, lesson: Lesson) => {
    e.stopPropagation();
    openGroupModal(lesson.groupId, lesson.groupTitle);
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

  const getLessonStyle = (status: string) => {
    switch (status) {
      case 'done':
        return {
          background: '#f0fdf4',
          borderColor: '#22c55e',
          color: '#166534',
        };
      case 'canceled':
        return {
          background: '#fef2f2',
          borderColor: '#ef4444',
          color: '#991b1b',
        };
      default:
        return {
          background: '#eff6ff',
          borderColor: '#3b82f6',
          color: '#1e40af',
        };
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'done':
        return { background: '#22c55e', color: 'white' };
      case 'canceled':
        return { background: '#ef4444', color: 'white' };
      default:
        return { background: '#3b82f6', color: 'white' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, 'd MMM', { locale: uk });
  };

  const isToday = (dateStr: string) => {
    const today = new Date();
    const date = parseISO(dateStr);
    return format(today, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
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
    <Layout user={user}>
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
          <button
            onClick={() => setShowGenerateModal(true)}
            className="btn btn-primary"
            style={{ gap: '0.5rem' }}
          >
            <RefreshCw size={14} />
            Згенерувати
          </button>
        )}
      </div>

      {/* Week Navigator */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <button
              onClick={goToPreviousWeek}
              disabled={isNavigating}
              className="btn btn-secondary"
              style={{ 
                padding: '0.5rem 0.75rem', 
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                opacity: isNavigating ? 0.7 : 1,
              }}
            >
              <span style={{ 
                display: 'inline-flex',
                animation: isNavigating ? 'spin 0.6s linear infinite' : 'none',
              }}>
                <ChevronLeft size={16} />
              </span>
              {!isNavigating && 'Попередній'}
              {isNavigating && 'Завантаження...'}
            </button>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontSize: '0.9375rem', 
                fontWeight: 600, 
                color: '#111827', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px', 
                marginBottom: '0.25rem',
                transition: 'opacity 0.2s ease',
                opacity: isNavigating ? 0.5 : 1,
              }}>
                {schedule?.weekStart && format(parseISO(schedule.weekStart), 'LLLL yyyy', { locale: uk })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                {(() => {
                  if (!schedule?.weekStart) return '';
                  const monthStart = startOfMonth(parseISO(schedule.weekStart));
                  const monthEnd = endOfMonth(parseISO(schedule.weekStart));
                  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
                  return `${weeks.length} тижнів у місяці`;
                })()}
              </div>
              <div style={{ 
                fontSize: '1.125rem', 
                fontWeight: 500, 
                color: '#111827',
                transition: 'opacity 0.2s ease',
                opacity: isNavigating ? 0.5 : 1,
              }}>
                {schedule?.weekStart && formatDate(schedule.weekStart)} — {schedule?.weekEnd && formatDate(schedule.weekEnd)}
              </div>
              <button
                onClick={goToCurrentWeek}
                disabled={isNavigating}
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: '#3b82f6',
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  borderRadius: '0.5rem',
                  cursor: isNavigating ? 'not-allowed' : 'pointer',
                  padding: '0.375rem 0.75rem',
                  marginTop: '0.5rem',
                  transition: 'all 0.15s ease',
                  opacity: isNavigating ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isNavigating) {
                    e.currentTarget.style.background = '#dbeafe';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#eff6ff';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Поточний тиждень
              </button>
            </div>
            
            <button
              onClick={goToNextWeek}
              disabled={isNavigating}
              className="btn btn-secondary"
              style={{ 
                padding: '0.5rem 0.75rem', 
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease',
                opacity: isNavigating ? 0.7 : 1,
              }}
            >
              {!isNavigating && 'Наступний'}
              {isNavigating && 'Завантаження...'}
              <span style={{ 
                display: 'inline-flex',
                animation: isNavigating ? 'spin 0.6s linear infinite' : 'none',
              }}>
                <ChevronRight size={16} />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '0.75rem',
        minHeight: '400px',
        transition: 'opacity 0.2s ease',
        opacity: isNavigating ? 0.6 : 1,
      }} className="schedule-grid">
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .schedule-grid {
            animation: fadeIn 0.3s ease-out;
          }
          .schedule-day {
            animation: fadeIn 0.4s ease-out backwards;
          }
          ${[0,1,2,3,4,5,6].map(i => `.schedule-day:nth-child(${i + 1}) { animation-delay: ${i * 0.05}s; }`).join('\n')}
          @media (max-width: 1200px) {
            .schedule-grid {
              grid-template-columns: repeat(4, 1fr) !important;
            }
          }
          @media (max-width: 900px) {
            .schedule-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 600px) {
            .schedule-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
        
        {schedule?.days.map((day) => {
          const todayStyle = isToday(day.date) ? {
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
            border: '2px solid #3b82f6',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
          } : {};
          
          return (
            <div
              key={day.date}
              className="card"
              style={{ 
                minHeight: '200px',
                ...todayStyle,
              }}>
            <div className="card-body" style={{ padding: '0.75rem' }}>
              {/* Day Header */}
              <div style={{ 
                textAlign: 'center', 
                marginBottom: '0.75rem',
                paddingBottom: '0.5rem',
                borderBottom: isToday(day.date) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
              }}>
                {isToday(day.date) && (
                  <div style={{ 
                    background: '#3b82f6', 
                    color: 'white', 
                    fontSize: '0.625rem', 
                    fontWeight: 700, 
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '0.25rem',
                    marginBottom: '0.25rem',
                    display: 'inline-block',
                  }}>
                    Сьогодні
                  </div>
                )}
                <div style={{ 
                  fontSize: '0.8125rem', 
                  fontWeight: 600, 
                  color: isToday(day.date) ? '#3b82f6' : '#6b7280', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {day.dayName}
                </div>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 700, 
                  color: '#111827',
                  marginTop: '0.125rem',
                }}>
                  {format(parseISO(day.date), 'd.MM')}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: 600,
                  color: '#3b82f6',
                  marginTop: '0.25rem',
                }}>
                  {day.lessons.length} {day.lessons.length === 1 ? 'заняття' : 'занять'}
                </div>
              </div>

              {/* Lessons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {day.lessons.map((lesson) => {
                  const lessonStyle = getLessonStyle(lesson.status);
                  return (
                    <div
                      key={lesson.id}
                      onClick={() => handleLessonClick(lesson)}
                      style={{
                        padding: '0.625rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        borderLeft: '3px solid',
                        borderColor: lessonStyle.borderColor,
                        background: lessonStyle.background,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: 700, 
                        color: lessonStyle.borderColor,
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}>
                        <Clock size={10} />
                        {lesson.startTime} - {lesson.endTime}
                      </div>
                      <div
                        onClick={(e) => handleGroupClick(e, lesson)}
                        style={{
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#111827',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          cursor: 'pointer',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#3b82f6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#111827';
                        }}
                      >
                        <Users size={10} />
                        {lesson.groupTitle}
                      </div>
                      <div
                        onClick={(e) => handleCourseClick(e, lesson)}
                        style={{
                          fontSize: '0.875rem',
                          color: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          marginTop: '0.125rem',
                          cursor: 'pointer',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#3b82f6';
                        }}
                      >
                        <BookOpen size={9} />
                        {lesson.courseTitle}
                      </div>
                      <div style={{
                        fontSize: '0.8125rem',
                        color: lesson.isReplaced ? '#d97706' : '#9ca3af',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        marginTop: '0.125rem',
                      }}>
                        <User size={9} />
                        {lesson.teacherName}
                        {lesson.isReplaced && (
                          <span style={{ 
                            background: '#fef3c7', 
                            color: '#d97706', 
                            fontSize: '0.625rem', 
                            padding: '0.0625rem 0.25rem', 
                            borderRadius: '0.125rem',
                            marginLeft: '0.125rem'
                          }}>
                            (Зам.)
                          </span>
                        )}
                      </div>
                      {lesson.topic && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          marginTop: '0.25rem',
                          fontStyle: 'italic',
                        }}>
                          {lesson.topic}
                        </div>
                      )}
                      <div style={{ 
                        ...getStatusBadgeStyle(lesson.status),
                        fontSize: '0.6875rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.125rem',
                        marginTop: '0.375rem',
                      }}>
                        {lesson.status === 'done' && <Check size={8} />}
                        {lesson.status === 'canceled' && <X size={8} />}
                        {lesson.status === 'scheduled' && <Calendar size={8} />}
                        {lesson.status === 'done' ? 'Проведено' : lesson.status === 'canceled' ? 'Скасовано' : 'Заплановано'}
                      </div>
                    </div>
                  );
                })}
                
                {day.lessons.length === 0 && (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#9ca3af', 
                    fontSize: '0.875rem',
                    padding: '1rem 0',
                  }}>
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
    </Layout>
  );
}
