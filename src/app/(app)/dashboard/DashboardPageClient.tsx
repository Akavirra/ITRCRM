'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, BarChart3, BookOpen, Calendar, Check, ChevronLeft, Clock, CreditCard, DollarSign,
  ChevronDown, ExternalLink, GraduationCap, Plus, RefreshCw, SquareArrowOutUpRight, TrendingDown, TrendingUp, User as UserIcon, Users, Users2, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import CreateGroupModal from '@/components/CreateGroupModal';
import CreateLessonModal from '@/components/CreateLessonModal';
import CreateStudentModal from '@/components/CreateStudentModal';
import TransitionLink from '@/components/TransitionLink';
import AnimatedNumber from '@/components/AnimatedNumber';
import Sparkline from '@/components/Sparkline';
import { useCourseModals } from '@/components/CourseModalsContext';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useStudentModals } from '@/components/StudentModalsContext';
import { useTeacherModals } from '@/components/TeacherModalsContext';
import { useLessonModals } from '@/components/LessonModalsContext';
import type { DashboardHistoryEntry, DashboardHistoryPagePayload, DashboardStatsPayload } from '@/lib/dashboard-types';
import styles from './dashboard.module.css';

type ActivityTab = 'payments' | 'history';
type PeriodTab = 'month' | 'allTime';
type StudentsPeriod = 'today' | 'month' | 'year';
type AttendanceView = 'month' | 'allTime' | 'stats';

interface AllTimeDebtor {
  id: number;
  full_name: string;
  public_id: string;
  group_title: string;
  lessons_count: number;
  expected_amount: number;
  paid_amount: number;
  discount_percent: number;
  debt: number;
}

interface AllTimeAbsence {
  id: number;
  student_id: number;
  lesson_id: number;
  full_name: string;
  public_id: string;
  lesson_date: string;
  lessonDateLabel: string;
  group_title: string;
  course_title: string;
  start_time: string;
}

interface MonthlyAttStat {
  month: string;
  monthLabel: string;
  total: number;
  present: number;
  absent: number;
  percent: number;
}

interface TopAbsentee {
  student_id: number;
  full_name: string;
  public_id: string;
  absences: number;
  total_lessons: number;
  percent: number;
}

interface AttAbsence {
  id: number;
  student_id: number;
  lesson_id: number;
  full_name: string;
  public_id: string;
  lesson_date: string;
  lessonDateLabel: string;
  month: string;
  group_title: string;
  course_title: string;
  start_time: string;
}

interface AttendanceStatsData {
  monthlyStats: MonthlyAttStat[];
  topAbsentees: TopAbsentee[];
  absencesByMonth: AttAbsence[];
}

function formatMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(date);
}

function getMonthValueFromDate(dateValue: string) {
  return dateValue.slice(0, 7);
}

function getRecentMonthValues(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
}

const studentsLabels: Record<StudentsPeriod, string> = {
  today: 'Дітей сьогодні',
  month: 'Дітей за місяць',
  year: 'Дітей за рік',
};

const HISTORY_PAGE_SIZE = 30;

/* ── Lesson card style logic — matches schedule page exactly ── */

function getLessonStyle(status: string, isMakeup?: boolean, groupId?: number | null) {
  if (status === 'done') return { background: '#f0fdf4', borderColor: '#16a34a', color: '#166534', accentColor: '#16a34a' };
  if (status === 'canceled') return { background: '#fef2f2', borderColor: '#dc2626', color: '#991b1b', accentColor: '#dc2626' };
  if (isMakeup) return { background: '#fff7ed', borderColor: '#f97316', color: '#7c2d12', accentColor: '#f97316' };
  if (!groupId) return { background: '#f5f3ff', borderColor: '#8b5cf6', color: '#4c1d95', accentColor: '#8b5cf6' };
  return { background: '#eff6ff', borderColor: '#3b82f6', color: '#1e40af', accentColor: '#3b82f6' };
}

function getStatusBadgeStyle(status: string, isMakeup?: boolean, groupId?: number | null) {
  if (status === 'done') return { background: '#16a34a', color: 'white' };
  if (status === 'canceled') return { background: '#dc2626', color: 'white' };
  if (isMakeup) return { background: '#f97316', color: 'white' };
  if (!groupId) return { background: '#8b5cf6', color: 'white' };
  return { background: '#3b82f6', color: 'white' };
}

function formatLessonDayLabel(dateValue: string) {
  const lessonDate = new Date(dateValue);
  const now = new Date();

  const lessonDay = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), lessonDate.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDiff = Math.round((lessonDay - today) / 86400000);

  if (dayDiff === 0) return 'Сьогодні';
  if (dayDiff === 1) return 'Завтра';

  const weekday = format(lessonDate, 'EEE', { locale: uk });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function CurrentNextLessonCountdown({
  startDatetime,
  endDatetime,
  state,
}: {
  startDatetime: string;
  endDatetime: string;
  state: 'live' | 'upcoming';
}) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function formatMinutes(totalMinutes: number) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours <= 0) return `${minutes} хв`;
      return minutes > 0 ? `${hours} год ${minutes} хв` : `${hours} год`;
    }

    function update() {
      const now = Date.now();
      if (state === 'live') {
        const diff = new Date(endDatetime).getTime() - now;
        if (diff <= 0) {
          setLabel('Завершується');
          return;
        }

        const minutes = Math.max(1, Math.ceil(diff / 60000));
        setLabel(`Ще ${formatMinutes(minutes)}`);
        return;
      }

      const diff = new Date(startDatetime).getTime() - now;
      if (diff <= 0) {
        setLabel('Починається');
        return;
      }

      const minutes = Math.max(1, Math.ceil(diff / 60000));
      setLabel(`Через ${formatMinutes(minutes)}`);
    }

    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [endDatetime, startDatetime, state]);

  return <span className={styles.nextLessonCountdown}>{label}</span>;
}

function getNextLessonTypeMeta(lesson: NonNullable<DashboardStatsPayload['nextLesson']>) {
  if (lesson.is_makeup) {
    return {
      label: 'Відпрацювання',
      style: { color: '#9a3412', background: 'rgba(255, 247, 237, 0.92)', border: '1px solid rgba(251, 191, 36, 0.28)' },
      title: lesson.group_id ? lesson.group_title : lesson.course_title,
      subtitle: lesson.group_id ? lesson.course_title : 'Індивідуальне заняття',
    };
  }

  if (!lesson.group_id && lesson.is_trial) {
    return {
      label: 'Пробне',
      style: { color: '#166534', background: 'rgba(240, 253, 244, 0.94)', border: '1px solid rgba(134, 239, 172, 0.34)' },
      title: lesson.course_title,
      subtitle: 'Індивідуальне заняття',
    };
  }

  if (!lesson.group_id) {
    return {
      label: 'Індивідуальне',
      style: { color: '#6b21a8', background: 'rgba(245, 243, 255, 0.96)', border: '1px solid rgba(196, 181, 253, 0.34)' },
      title: lesson.course_title,
      subtitle: 'Персональне заняття',
    };
  }

  return {
    label: 'Групове',
    style: { color: '#1e40af', background: 'rgba(239, 246, 255, 0.96)', border: '1px solid rgba(147, 197, 253, 0.42)' },
    title: lesson.group_title,
    subtitle: lesson.course_title,
  };
}

function vibrate(pattern: number | number[] = 5) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch { /* ignore */ }
  }
}

function SkeletonList() {
  return (
    <div className={styles.modalList} style={{ paddingBottom: '1rem' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLine} />
          <div className={styles.skeletonLine} />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPageClient({ initialData }: { initialData: DashboardStatsPayload }) {
  const router = useRouter();
  const createMenuId = useId();
  const { openCourseModal } = useCourseModals();
  const { openGroupModal } = useGroupModals();
  const { openStudentModal } = useStudentModals();
  const { openTeacherModal } = useTeacherModals();
  const { openLessonModal } = useLessonModals();
  const [activeTab, setActiveTab] = useState<ActivityTab>('payments');
  const [statsPeriod, setStatsPeriod] = useState<PeriodTab>('month');
  const [studentsPeriod, setStudentsPeriod] = useState<StudentsPeriod>('today');
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [showMobileCreateMenu, setShowMobileCreateMenu] = useState(false);
  const [showDebtsModal, setShowDebtsModal] = useState(false);
  const [showAbsencesModal, setShowAbsencesModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [debtsTab, setDebtsTab] = useState<PeriodTab>('month');
  const [historyPageData, setHistoryPageData] = useState<DashboardHistoryPagePayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyBodyRef = useRef<HTMLDivElement | null>(null);
  const historyLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const mobileCreateMenuRef = useRef<HTMLDivElement | null>(null);

  const [allTimeDebtors, setAllTimeDebtors] = useState<AllTimeDebtor[] | null>(null);
  const [allTimeDebtsLoading, setAllTimeDebtsLoading] = useState(false);
  const [debtMonthFilter, setDebtMonthFilter] = useState('');
  const [debtsByMonth, setDebtsByMonth] = useState<Record<string, AllTimeDebtor[]>>({});
  const [debtsByMonthLoading, setDebtsByMonthLoading] = useState(false);
  const [attendanceView, setAttendanceView] = useState<AttendanceView>('month');
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStatsData | null>(null);
  const [attendanceStatsLoading, setAttendanceStatsLoading] = useState(false);
  const [attMonthFilter, setAttMonthFilter] = useState<string | null>(null);
  const [allTimeAbsences, setAllTimeAbsences] = useState<AllTimeAbsence[] | null>(null);
  const [allTimeAbsencesLoading, setAllTimeAbsencesLoading] = useState(false);
  const [attendanceAllTimeMonthFilter, setAttendanceAllTimeMonthFilter] = useState('');

  const handleDebtsTabChange = (tab: PeriodTab) => {
    setDebtsTab(tab);
    setDebtMonthFilter('');
    if (tab === 'allTime' && allTimeDebtors === null && !allTimeDebtsLoading) {
      setAllTimeDebtsLoading(true);
      fetch('/api/reports/debts?period=all')
        .then((res) => res.json())
        .then((data) => setAllTimeDebtors(data.debtors ?? []))
        .catch(() => setAllTimeDebtors([]))
        .finally(() => setAllTimeDebtsLoading(false));
    }
  };

  const loadAttendanceStats = () => {
    if (attendanceStats !== null || attendanceStatsLoading) return;
    setAttendanceStatsLoading(true);
    fetch('/api/dashboard/attendance-stats')
      .then((res) => res.json())
      .then((data) => setAttendanceStats(data))
      .catch(() => setAttendanceStats({ monthlyStats: [], topAbsentees: [], absencesByMonth: [] }))
      .finally(() => setAttendanceStatsLoading(false));
  };

  const loadAllTimeAbsences = () => {
    if (allTimeAbsences !== null || allTimeAbsencesLoading) return;
    setAllTimeAbsencesLoading(true);
    fetch('/api/dashboard/absences')
      .then((res) => res.json())
      .then((data) => setAllTimeAbsences(data.absences ?? []))
      .catch(() => setAllTimeAbsences([]))
      .finally(() => setAllTimeAbsencesLoading(false));
  };

  const handleAttendanceViewChange = (view: AttendanceView) => {
    setAttendanceView(view);
    setAttMonthFilter(null);
    setAttendanceAllTimeMonthFilter('');
    if (view === 'stats') loadAttendanceStats();
    if (view === 'allTime') loadAllTimeAbsences();
  };

  const handleOpenAttendance = () => {
    setShowAbsencesModal(true);
    setAttendanceView('month');
    setAttMonthFilter(null);
    setAttendanceAllTimeMonthFilter('');
  };

  useEffect(() => {
    if (!showMobileCreateMenu) return undefined;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!mobileCreateMenuRef.current?.contains(event.target as Node)) {
        setShowMobileCreateMenu(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMobileCreateMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showMobileCreateMenu]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 720) {
        setShowMobileCreateMenu(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadHistoryPage = (page: number) => {
    if (historyLoading) return;

    setHistoryLoading(true);
    fetch(`/api/dashboard/history?page=${page}&pageSize=${HISTORY_PAGE_SIZE}`)
      .then((res) => res.json())
      .then((data: DashboardHistoryPagePayload) => {
        setHistoryPageData((current) => {
          if (!current || page <= 1) {
            return data;
          }

          return {
            items: [...current.items, ...data.items],
            pagination: data.pagination,
          };
        });
      })
      .catch(() => {
        setHistoryPageData({
          items: [],
          pagination: {
            page: 1,
            pageSize: HISTORY_PAGE_SIZE,
            total: 0,
            totalPages: 1,
          },
        });
      })
      .finally(() => setHistoryLoading(false));
  };

  const handleOpenHistory = () => {
    setShowHistoryModal(true);
    if (!historyPageData) {
      loadHistoryPage(1);
    }
  };

  useEffect(() => {
    if (!showHistoryModal || !historyBodyRef.current || !historyLoadMoreRef.current) return;
    if (!historyPageData || historyLoading) return;
    if (historyPageData.pagination.page >= historyPageData.pagination.totalPages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        loadHistoryPage(historyPageData.pagination.page + 1);
      },
      {
        root: historyBodyRef.current,
        rootMargin: '0px 0px 160px 0px',
        threshold: 0.1,
      }
    );

    observer.observe(historyLoadMoreRef.current);

    return () => observer.disconnect();
  }, [showHistoryModal, historyPageData, historyLoading]);

  const loadDebtMonth = (monthValue: string) => {
    if (!monthValue || debtsByMonth[monthValue] || debtsByMonthLoading) return;
    setDebtsByMonthLoading(true);
    fetch(`/api/reports/debts?month=${monthValue}-01`)
      .then((res) => res.json())
      .then((data) => {
        setDebtsByMonth((current) => ({
          ...current,
          [monthValue]: data.debtors ?? [],
        }));
      })
      .catch(() => {
        setDebtsByMonth((current) => ({
          ...current,
          [monthValue]: [],
        }));
      })
      .finally(() => setDebtsByMonthLoading(false));
  };

  const allTimeAbsenceMonths = Array.from(
    new Set((allTimeAbsences ?? []).map((absence) => getMonthValueFromDate(absence.lesson_date)))
  ).sort((a, b) => b.localeCompare(a));
  const debtMonthOptions = getRecentMonthValues(24);

  const filteredAllTimeAbsences = attendanceAllTimeMonthFilter
    ? (allTimeAbsences ?? []).filter((absence) => getMonthValueFromDate(absence.lesson_date) === attendanceAllTimeMonthFilter)
    : (allTimeAbsences ?? []);

  const visibleDebtors = debtMonthFilter
    ? (debtsByMonth[debtMonthFilter] ?? [])
    : (allTimeDebtors ?? []);

  const visibleDebtorsTotal = visibleDebtors.reduce((sum, debtor) => sum + debtor.debt, 0);

  const completedLessons = initialData.todaySchedule.filter((l) => l.status === 'completed' || l.status === 'done').length;
  const visiblePayments = initialData.recentPayments.slice(0, 6);
  const visibleHistory = initialData.recentHistory.slice(0, 6);
  const mobileCreateActions = [
    {
      key: 'student',
      label: 'Учень',
      icon: <Plus size={14} />,
      onClick: () => {
        setShowMobileCreateMenu(false);
        setShowCreateStudentModal(true);
      },
    },
    {
      key: 'group',
      label: 'Група',
      icon: <Users2 size={14} />,
      onClick: () => {
        setShowMobileCreateMenu(false);
        setShowCreateGroupModal(true);
      },
    },
    {
      key: 'lesson',
      label: 'Заняття',
      icon: <Calendar size={14} />,
      onClick: () => {
        setShowMobileCreateMenu(false);
        setShowCreateLessonModal(true);
      },
    },
    {
      key: 'payment',
      label: 'Оплата',
      icon: <CreditCard size={14} />,
      href: '/payments?newPayment=1',
    },
  ] as const;
  const historyPagination = historyPageData?.pagination ?? null;
  const historyLoadedCount = historyPageData?.items.length ?? 0;
  const historyTotalCount = historyPagination?.total ?? 0;
  const historyHasMore = historyPagination ? historyPagination.page < historyPagination.totalPages : false;

  const formattedDate = format(new Date(initialData.todayDate), 'd MMMM, EEEE', { locale: uk });
  const canUsePortal = typeof window !== 'undefined';

  const canOpenHistoryEntityModal = (history: DashboardHistoryEntry) => {
    return history.entity_id !== null
      && ['student', 'group', 'course', 'lesson', 'teacher'].includes(history.entity_type);
  };

  const openHistoryEntityModal = (history: DashboardHistoryEntry) => {
    if (history.entity_id === null) return;

    switch (history.entity_type) {
      case 'student':
        openStudentModal(history.entity_id, history.entity_title);
        break;
      case 'group':
        openGroupModal(history.entity_id, history.entity_title);
        break;
      case 'course':
        openCourseModal(history.entity_id, history.entity_title);
        break;
      case 'lesson':
        openLessonModal(history.entity_id, history.entity_title);
        break;
      case 'teacher':
        openTeacherModal(history.entity_id, history.entity_title);
        break;
      default:
        break;
    }
  };

  const renderHistoryDescription = (history: DashboardHistoryEntry) => {
    const inlineTargets = [
      history.student_id && history.student_title && history.student_title !== history.entity_title
        ? {
            key: `student-${history.student_id}`,
            title: history.student_title,
            onClick: () => openStudentModal(history.student_id as number, history.student_title as string),
            label: 'Відкрити учня',
          }
        : null,
      history.group_id && history.group_title && history.group_title !== history.entity_title
        ? {
            key: `group-${history.group_id}`,
            title: history.group_title,
            onClick: () => openGroupModal(history.group_id as number, history.group_title as string),
            label: 'Відкрити групу',
          }
        : null,
      history.course_id && history.course_title && history.course_title !== history.entity_title
        ? {
            key: `course-${history.course_id}`,
            title: history.course_title,
            onClick: () => openCourseModal(history.course_id as number, history.course_title as string),
            label: 'Відкрити курс',
          }
        : null,
    ]
      .filter((target): target is { key: string; title: string; onClick: () => void; label: string } => Boolean(target))
      .filter((target, index, array) => array.findIndex((item) => item.title === target.title) === index)
      .sort((a, b) => b.title.length - a.title.length);

    if (inlineTargets.length === 0) {
      return history.description;
    }

    let segments: Array<string | { key: string; title: string; onClick: () => void; label: string }> = [history.description];

    inlineTargets.forEach((target) => {
      segments = segments.flatMap((segment) => {
        if (typeof segment !== 'string' || !segment.includes(target.title)) {
          return [segment];
        }

        const parts = segment.split(target.title);
        const nextSegments: Array<string | { key: string; title: string; onClick: () => void; label: string }> = [];

        parts.forEach((part, index) => {
          if (part) {
            nextSegments.push(part);
          }

          if (index < parts.length - 1) {
            nextSegments.push(target);
          }
        });

        return nextSegments;
      });
    });

    return segments.map((segment, index) => (typeof segment === 'string' ? (
      <span key={`${history.created_at}-text-${index}`}>{segment}</span>
    ) : (
      <button
        key={`${history.created_at}-${segment.key}-${index}`}
        type="button"
        className={styles.historyInlineLink}
        onClick={segment.onClick}
        title={segment.label}
      >
        {segment.title}
      </button>
    )));
  };

  return (
    <>
      <div className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.heroGreeting}>{initialData.greeting}!</div>
            <h1 className={styles.heroTitle} suppressHydrationWarning>{formattedDate}</h1>
          </div>

          <div className={styles.actionsStrip}>
            <button type="button" className={styles.actionChip} onClick={() => setShowCreateStudentModal(true)}>
              <span className={styles.actionChipIcon}><Plus size={14} /></span>
              Учень
            </button>
            <button type="button" className={styles.actionChip} onClick={() => setShowCreateGroupModal(true)}>
              <span className={styles.actionChipIcon}><Users2 size={14} /></span>
              Група
            </button>
            <button type="button" className={styles.actionChip} onClick={() => setShowCreateLessonModal(true)}>
              <span className={styles.actionChipIcon}><Calendar size={14} /></span>
              Заняття
            </button>
            <TransitionLink href="/payments?newPayment=1" className={styles.actionChip}>
              <span className={styles.actionChipIcon}><CreditCard size={14} /></span>
              Оплата
            </TransitionLink>
          </div>

          <div className={styles.mobileCreateWrap} ref={mobileCreateMenuRef}>
              <button
                type="button"
                className={styles.mobileCreateButton}
                aria-expanded={showMobileCreateMenu}
                aria-controls={createMenuId}
                aria-label={showMobileCreateMenu ? 'Закрити меню створення' : 'Відкрити меню створення'}
                onClick={() => { vibrate([10, 30, 10]); setShowMobileCreateMenu((current) => !current); }}
              >
              <span className={styles.mobileCreateButtonIcon}><Plus size={20} /></span>
              <span className={styles.mobileCreateButtonText}>Створити</span>
              <ChevronDown
                size={16}
                className={`${styles.mobileCreateChevron} ${showMobileCreateMenu ? styles.mobileCreateChevronOpen : ''}`}
              />
            </button>

            <div
              id={createMenuId}
              className={`${styles.mobileCreateMenu} ${showMobileCreateMenu ? styles.mobileCreateMenuOpen : ''}`}
              aria-hidden={!showMobileCreateMenu}
            >
              {mobileCreateActions.map((action) => (
                'href' in action ? (
                  <TransitionLink
                    key={action.key}
                    href={action.href}
                    className={styles.mobileCreateItem}
                    onClick={() => setShowMobileCreateMenu(false)}
                  >
                    <span className={styles.mobileCreateItemIcon}>{action.icon}</span>
                    {action.label}
                  </TransitionLink>
                ) : (
                  <button
                    key={action.key}
                    type="button"
                    className={styles.mobileCreateItem}
                    onClick={action.onClick}
                  >
                    <span className={styles.mobileCreateItemIcon}>{action.icon}</span>
                    {action.label}
                  </button>
                )
              ))}
            </div>
          </div>
        </section>

        {/* Stats header: secondary entities + period toggle */}
        <div className={styles.statsHeader}>
          <div className={styles.secondaryStatsRow}>
            <div className={styles.secondaryStatItem}>
              <Users size={13} />
              <span className={styles.secondaryStatLabel}>Студенти</span>
              <span className={styles.secondaryStatValue}><AnimatedNumber value={initialData.stats.activeStudents} /></span>
            </div>
            <div className={styles.secondaryStatItem}>
              <Users2 size={13} />
              <span className={styles.secondaryStatLabel}>Групи</span>
              <span className={styles.secondaryStatValue}><AnimatedNumber value={initialData.stats.activeGroups} /></span>
            </div>
            <div className={styles.secondaryStatItem}>
              <GraduationCap size={13} />
              <span className={styles.secondaryStatLabel}>Курси</span>
              <span className={styles.secondaryStatValue}><AnimatedNumber value={initialData.stats.activeCourses} /></span>
            </div>
          </div>
          <div className={styles.segmented} data-active={statsPeriod}>
            <button
              type="button"
              className={`${styles.segmentButton} ${statsPeriod === 'month' ? styles.segmentButtonActive : ''}`}
              onClick={() => { vibrate(5); setStatsPeriod('month'); }}
            >
              За місяць
            </button>
            <button
              type="button"
              className={`${styles.segmentButton} ${statsPeriod === 'allTime' ? styles.segmentButtonActive : ''}`}
              onClick={() => { vibrate(5); setStatsPeriod('allTime'); }}
            >
              За увесь час
            </button>
          </div>
        </div>

        {/* Primary stats */}
        <section className={styles.statsRow}>
          <div className={styles.statsGrid}>
            {/* Revenue */}
            <div className={styles.statItem}>
              <div className={styles.statItemLabel}>
                <DollarSign size={14} />
                {statsPeriod === 'month' ? 'Дохід за місяць' : 'Дохід за увесь час'}
              </div>
              <div className={styles.statItemValue}>
                <AnimatedNumber 
                  value={statsPeriod === 'month' ? initialData.stats.monthlyRevenue : initialData.stats.allTimeRevenue}
                  formatFn={(v) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0 }).format(v)}
                />
                {(() => {
                  const prev = initialData.stats.prevMonthRevenue;
                  const curr = initialData.stats.monthlyRevenue;
                  if (prev > 0) {
                    const pct = Math.round(((curr - prev) / prev) * 100);
                    const isUp = pct >= 0;
                    return (
                      <span 
                        className={isUp ? styles.trendUp : styles.trendDown}
                        style={{ 
                          opacity: statsPeriod === 'month' ? 1 : 0, 
                          visibility: statsPeriod === 'month' ? 'visible' : 'hidden',
                          transition: 'opacity 0.2s ease, visibility 0.2s ease'
                        }}
                      >
                        {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isUp ? '+' : ''}{pct}%
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <div 
                className={styles.sparklineContainer}
                style={{ 
                  opacity: statsPeriod === 'month' || statsPeriod === 'allTime' ? 0.8 : 0,
                  transition: 'opacity 0.2s ease'
                }}
              >
                {(() => {
                  const data = statsPeriod === 'month' ? initialData.stats.revenueTrend : initialData.stats.revenueTrendAllTime;
                  return data && data.length >= 2 ? <Sparkline data={data} color="#10b981" /> : null;
                })()}
              </div>
            </div>

            {/* Debts */}
            {(() => {
              const debtsValue = statsPeriod === 'month'
                ? initialData.stats.unpaidStudents
                : initialData.stats.allTimeUnpaidStudents;
              const valueClass = debtsValue > 0
                ? `${styles.statItemValue} ${styles.statValueDanger}`
                : styles.statItemValue;
              return (
                <div
                  className={`${styles.statItem} ${styles.statItemClickable}`}
                  onClick={() => { vibrate(5); setShowDebtsModal(true); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDebtsModal(true); }}
                >
                  <div className={styles.statItemLabel}>
                    <AlertTriangle size={14} />
                    Борги
                  </div>
                  <div className={valueClass}>
                    <AnimatedNumber value={debtsValue} />
                  </div>
                  <div 
                    className={styles.sparklineContainer}
                    style={{ 
                      opacity: statsPeriod === 'month' || statsPeriod === 'allTime' ? 0.8 : 0,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    {(() => {
                      const data = statsPeriod === 'month' ? initialData.stats.debtTrend : initialData.stats.debtTrendAllTime;
                      return data && data.length >= 2 ? <Sparkline data={data} color="#dc2626" /> : null;
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* Attendance */}
            {(() => {
              const pct = statsPeriod === 'month'
                ? initialData.stats.attendancePercent
                : initialData.stats.allTimeAttendancePercent;
              const value = pct !== null ? `${pct}%` : '—';
              let valueClass = styles.statItemValue;
              if (pct !== null && pct < 70) valueClass = `${styles.statItemValue} ${styles.statValueDanger}`;
              else if (pct !== null && pct >= 90) valueClass = `${styles.statItemValue} ${styles.statValueGood}`;
              return (
                <div
                  className={`${styles.statItem} ${styles.statItemClickable}`}
                  onClick={() => { vibrate(5); handleOpenAttendance(); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenAttendance(); }}
                >
                  <div className={styles.statItemLabel}>
                    <Check size={14} />
                    Відвідуваність
                  </div>
                  <div className={valueClass}>
                    {pct !== null ? <AnimatedNumber value={pct} formatFn={(v) => `${v}%`} /> : '—'}
                  </div>
                  <div 
                    className={styles.sparklineContainer}
                    style={{ 
                      opacity: statsPeriod === 'month' || statsPeriod === 'allTime' ? 0.8 : 0,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    {(() => {
                      const data = statsPeriod === 'month' ? initialData.stats.attendanceTrend : initialData.stats.attendanceTrendAllTime;
                      return data && data.length >= 2 ? <Sparkline data={data} color="#3b82f6" /> : null;
                    })()}
                  </div>
                </div>
              );
            })()}

            {/* Students count */}
            <div className={styles.statItem}>
              <div className={styles.statItemLabel}>
                <UserIcon size={14} />
                {statsPeriod === 'allTime' ? 'Дітей за увесь час' : studentsLabels[studentsPeriod]}
              </div>
              <div className={styles.statItemValue}>
                <AnimatedNumber value={
                  statsPeriod === 'allTime'
                    ? initialData.stats.allTimeStudents
                    : studentsPeriod === 'today' ? initialData.stats.todayStudents
                    : studentsPeriod === 'month' ? initialData.stats.monthStudents
                    : initialData.stats.yearStudents
                } />
              </div>
              <div 
                style={{ 
                  position: 'relative',
                  width: '100%',
                  height: '2.25rem',
                  marginTop: '0.2rem',
                  opacity: statsPeriod === 'month' || statsPeriod === 'allTime' ? 0.8 : 0,
                  transition: 'opacity 0.2s ease'
                }}
              >
                <AnimatePresence mode="wait">
                  {(statsPeriod === 'month' || statsPeriod === 'allTime') && (() => {
                    const data = statsPeriod === 'allTime'
                      ? initialData.stats.studentsTrendAllTime
                      : studentsPeriod === 'today'
                      ? initialData.stats.studentsTrend
                      : studentsPeriod === 'month'
                      ? initialData.stats.studentsTrendMonth
                      : initialData.stats.studentsTrendYear;
                    return data && data.length >= 2 ? (
                      <motion.div
                        key={statsPeriod === 'allTime' ? 'allTime' : studentsPeriod}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        style={{ width: '100%', height: '100%' }}
                      >
                        <Sparkline data={data} color="#8b5cf6" />
                      </motion.div>
                    ) : null;
                  })()}
                </AnimatePresence>
              </div>
              <div 
                style={{ 
                  opacity: statsPeriod === 'month' ? 1 : 0, 
                  visibility: statsPeriod === 'month' ? 'visible' : 'hidden',
                  pointerEvents: statsPeriod === 'month' ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease, visibility 0.2s ease'
                }}
              >
                <div className={styles.miniSegmented}>
                  <button
                    type="button"
                    className={`${styles.miniSegmentBtn} ${studentsPeriod === 'today' ? styles.miniSegmentBtnActive : ''}`}
                    onClick={() => { vibrate(5); setStudentsPeriod('today'); }}
                  >
                    День
                  </button>
                  <button
                    type="button"
                    className={`${styles.miniSegmentBtn} ${studentsPeriod === 'month' ? styles.miniSegmentBtnActive : ''}`}
                    onClick={() => { vibrate(5); setStudentsPeriod('month'); }}
                  >
                    Місяць
                  </button>
                  <button
                    type="button"
                    className={`${styles.miniSegmentBtn} ${studentsPeriod === 'year' ? styles.miniSegmentBtnActive : ''}`}
                    onClick={() => { vibrate(5); setStudentsPeriod('year'); }}
                  >
                    Рік
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Current / next lesson */}
        {initialData.nextLesson && (() => {
          const lesson = initialData.nextLesson;
          const lessonMeta = getNextLessonTypeMeta(lesson);

          return (
            <button
              type="button"
              className={`${styles.nextLessonCard} ${lesson.state === 'live' ? styles.nextLessonCardLive : ''}`}
              onClick={() => openLessonModal(lesson.id, `Заняття #${lesson.id}`)}
            >
              <div className={styles.nextLessonCardAccent} />
              <div className={styles.nextLessonCardBody}>
                <div className={styles.nextLessonCardTopline}>
                  <div className={styles.nextLessonBadgeRow}>
                    <span className={`${styles.nextLessonBadge} ${lesson.state === 'live' ? styles.nextLessonBadgeLive : styles.nextLessonBadgeUpcoming}`}>
                      {lesson.state === 'live' ? (
                        <>
                          <span className={styles.nextLessonLiveDot} />
                          Йде зараз
                        </>
                      ) : (
                        'Найближче'
                      )}
                    </span>
                    <span className={styles.nextLessonTypeBadge} style={lessonMeta.style}>
                      {lessonMeta.label}
                    </span>
                  </div>
                  <CurrentNextLessonCountdown
                    startDatetime={lesson.start_datetime}
                    endDatetime={lesson.end_datetime}
                    state={lesson.state}
                  />
                </div>

                <div className={styles.nextLessonCardMain}>
                  <div className={styles.nextLessonTitle}>{lessonMeta.title}</div>
                  <div className={styles.nextLessonSubtitle}>{lessonMeta.subtitle}</div>
                  <div className={styles.nextLessonMeta}>
                    <span className={styles.nextLessonMetaItem}>
                      <Clock size={14} />
                      {formatLessonDayLabel(lesson.start_datetime)}, {lesson.startTimeLabel}–{lesson.endTimeLabel}
                    </span>
                    <span className={styles.nextLessonMetaDot} />
                    <span className={styles.nextLessonMetaItem}>{lesson.teacher_name}</span>
                  </div>
                </div>
              </div>

              <span className={styles.nextLessonAction}>
                Деталі
                <SquareArrowOutUpRight size={15} />
              </span>
            </button>
          );
        })()}

        {/* Two-column: Schedule + Activity */}
        <div className={styles.columns}>
          {/* Schedule */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelLabel}>Сьогодні</div>
                <h2 className={styles.panelTitle}>Розклад ({initialData.todaySchedule.length})</h2>
              </div>
              <TransitionLink href="/schedule" className={styles.textLink}>
                Відкрити розклад
              </TransitionLink>
            </div>

            {initialData.todaySchedule.length === 0 ? (
              <div className={styles.emptyState}>
                <Calendar size={20} style={{ opacity: 0.3 }} />
                <div className={styles.emptyTitle}>На сьогодні занять немає</div>
                <div className={styles.emptyText}>
                  Можна зосередитись на платежах, групах або плануванні.
                </div>
              </div>
            ) : (
              <div className={styles.lessonsList}>
                {initialData.todaySchedule.slice(0, 10).map((lesson) => {
                  const ls = getLessonStyle(lesson.status, lesson.is_makeup, lesson.group_id);
                  return (
                    <div key={lesson.id} className={styles.lessonCard}>
                      <div className={styles.lessonCardIndicator} style={{ background: ls.borderColor }} />
                      
                      <div className={styles.typeBadgeWrapper}>
                        {/* Time */}
                        <div className={styles.lessonTime} style={{ color: ls.accentColor }}>
                          {lesson.startTimeLabel} - {lesson.endTimeLabel}
                        </div>

                        {/* Type badge */}
                        {lesson.is_makeup ? (
                          <span className={styles.typeBadge} style={{ color: '#c2410c', background: '#fff7ed' }}>
                            Відпрацювання
                          </span>
                        ) : !lesson.group_id && lesson.is_trial ? (
                          <span className={styles.typeBadge} style={{ color: '#15803d', background: '#f0fdf4' }}>
                            Пробне
                          </span>
                        ) : !lesson.group_id ? (
                          <span className={styles.typeBadge} style={{ color: '#6d28d9', background: '#f5f3ff' }}>
                            Інд.
                          </span>
                        ) : null}
                      </div>

                      {/* Group and Course */}
                      {lesson.group_id && !lesson.is_makeup && (
                        <div className={styles.lessonRow}>
                          <Users size={12} />
                          <strong>{lesson.group_title}</strong> 
                          <span style={{ opacity: 0.5 }}>·</span> 
                          <span>{lesson.course_title}</span>
                        </div>
                      )}

                      {/* Teacher */}
                      <div className={styles.lessonRow}>
                        <UserIcon size={12} />
                        {lesson.teacher_name}
                        {lesson.is_replaced && (
                          <span className={styles.replacedBadge}>(Зам.)</span>
                        )}
                      </div>

                      {/* Topic */}
                      {lesson.topic && (
                        <div className={styles.lessonTopic}>{lesson.topic}</div>
                      )}

                      {/* Rescheduled info */}
                      {lesson.original_date && (
                        <span className={styles.rescheduledBadge} suppressHydrationWarning>
                          <RefreshCw size={10} />
                          Перенесено з {format(new Date(lesson.original_date), 'd MMM', { locale: uk })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Activity */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelLabel}>Операції</div>
                <h2 className={styles.panelTitle}>Останні зміни</h2>
              </div>
              <div className={styles.panelHeaderActions}>
                {activeTab === 'history' && (
                  <button type="button" className={styles.textButton} onClick={handleOpenHistory}>
                    Вся історія
                    <SquareArrowOutUpRight size={14} />
                  </button>
                )}
                <div className={styles.segmented} data-active={activeTab}>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${activeTab === 'payments' ? styles.segmentButtonActive : ''}`}
                  onClick={() => { vibrate(5); setActiveTab('payments'); }}
                >
                  Платежі
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${activeTab === 'history' ? styles.segmentButtonActive : ''}`}
                  onClick={() => { vibrate(5); setActiveTab('history'); }}
                >
                  Історія
                </button>
              </div>
            </div>

            </div>

            <div className={styles.activityList}>
              {activeTab === 'payments' ? (
                visiblePayments.length > 0 ? (
                  visiblePayments.map((payment, index) => (
                    <div key={`${payment.student_public_id}-${index}`} className={styles.activityItem}>
                      <div>
                        <div className={styles.activityTitle}>{payment.student_name}</div>
                        <div className={styles.activityMeta}>
                          {payment.student_public_id} · {payment.paidAtLabel}
                        </div>
                      </div>
                      <div className={styles.activityAmount}>{payment.amountLabel}</div>
                    </div>
                  ))
                ) : (
                  <div className={styles.compactEmpty}>Немає недавніх платежів.</div>
                )
              ) : visibleHistory.length > 0 ? (
                visibleHistory.map((history, index) => (
                  <div key={`${history.entity_type}-${history.entity_id ?? history.entity_public_id ?? index}-${index}`} className={styles.activityItem}>
                    <div>
                      <div className={styles.activityTitle}>{history.entity_title}</div>
                      <div className={styles.activityMeta}>
                        {history.entity_public_id ? `${history.entity_public_id} · ` : ''}
                        {history.createdAtLabel} · {history.user_name}
                      </div>
                      <div className={styles.activityDescription}>{history.description}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.compactEmpty}>Історія змін поки порожня.</div>
              )}
            </div>
          </section>
        </div>

      </div>

      <CreateStudentModal
        isOpen={showCreateStudentModal}
        onClose={() => setShowCreateStudentModal(false)}
        onCreated={() => {
          setShowCreateStudentModal(false);
          router.refresh();
        }}
      />

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onSuccess={() => {
          setShowCreateGroupModal(false);
          router.refresh();
        }}
      />

      <CreateLessonModal
        isOpen={showCreateLessonModal}
        onClose={() => setShowCreateLessonModal(false)}
        onSuccess={() => {
          setShowCreateLessonModal(false);
          router.refresh();
        }}
        initialDate={initialData.todayDate}
      />

      {/* Debts Modal */}
      {canUsePortal && showDebtsModal && createPortal(
        <div className={styles.modalOverlay} onClick={() => { setShowDebtsModal(false); setDebtsTab('month'); setDebtMonthFilter(''); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <AlertTriangle size={18} />
                {debtsTab === 'month' ? 'Борги за поточний місяць' : 'Борги за увесь період'}
              </h2>
              <button type="button" className={styles.modalClose} aria-label="Закрити модальне вікно боргів" onClick={() => { setShowDebtsModal(false); setDebtsTab('month'); setDebtMonthFilter(''); }}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalTabBar}>
              <div className={styles.segmented} data-active={debtsTab}>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${debtsTab === 'month' ? styles.segmentButtonActive : ''}`}
                  onClick={() => handleDebtsTabChange('month')}
                >
                  За місяць
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${debtsTab === 'allTime' ? styles.segmentButtonActive : ''}`}
                  onClick={() => handleDebtsTabChange('allTime')}
                >
                  За увесь період
                </button>
              </div>
            </div>

            {debtsTab === 'allTime' && (
              <div className={styles.modalFilterBar}>
                <label className={styles.monthPickerWrap}>
                  <span className={styles.monthPickerLabel}>Місяць</span>
                  <span className={styles.monthPickerShell}>
                    <Calendar size={15} className={styles.monthPickerIcon} />
                    <select
                      className={styles.monthPickerSelect}
                      value={debtMonthFilter}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setDebtMonthFilter(nextValue);
                        if (nextValue) loadDebtMonth(nextValue);
                      }}
                    >
                      <option value="">Усі місяці</option>
                      {debtMonthOptions.map((monthValue) => (
                        <option key={monthValue} value={monthValue}>
                          {formatMonthLabel(monthValue)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} className={styles.monthPickerChevron} />
                  </span>
                </label>
              </div>
            )}

            {debtsTab === 'month' ? (
              initialData.debtorsList.length === 0 ? (
                <div className={styles.modalBody}>
                  <div className={styles.compactEmpty}>Боржників немає.</div>
                </div>
              ) : (
                <>
                  <div className={styles.modalBody}>
                    <div className={styles.modalList}>
                      {initialData.debtorsList.map((debtor, idx) => (
                        <div key={`${debtor.id}-${debtor.group_title}-${idx}`} className={styles.modalListItem}>
                          <div className={styles.modalListItemMain}>
                            <div className={styles.modalStudentRow}>
                              <button
                                type="button"
                                className={styles.modalStudentName}
                                onClick={() => { router.push(`/students/${debtor.id}`); setShowDebtsModal(false); setDebtsTab('month'); setDebtMonthFilter(''); }}
                              >
                                {debtor.full_name}
                              </button>
                              <button
                                type="button"
                                className={styles.modalStudentOpenBtn}
                                aria-label={`Відкрити картку учня ${debtor.full_name}`}
                                title="Відкрити картку учня"
                                onClick={() => openStudentModal(debtor.id, debtor.full_name)}
                              >
                                <SquareArrowOutUpRight size={13} />
                              </button>
                            </div>
                            <div className={styles.activityMeta}>
                              {debtor.public_id} · {debtor.group_title}
                            </div>
                            <div className={styles.debtDetails}>
                              {debtor.lessons_count} ур. · очікувано {new Intl.NumberFormat('uk-UA').format(debtor.expected_amount)} ₴ · сплачено {new Intl.NumberFormat('uk-UA').format(debtor.paid_amount)} ₴
                              {debtor.discount_percent > 0 && <> · знижка {debtor.discount_percent}%</>}
                            </div>
                          </div>
                          <div className={styles.debtAmount}>{debtor.debtLabel}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.modalFooter}>
                    Загальний борг: <strong>
                      {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0 }).format(
                        initialData.debtorsList.reduce((sum, d) => sum + d.debt, 0)
                      )}
                    </strong>
                  </div>
                </>
              )
            ) : (allTimeDebtsLoading || (debtMonthFilter && debtsByMonthLoading && !debtsByMonth[debtMonthFilter])) ? (
              <div className={styles.modalBody}>
                <SkeletonList />
              </div>
            ) : visibleDebtors.length === 0 ? (
              <div className={styles.modalBody}>
                <div className={styles.compactEmpty}>Боржників немає.</div>
              </div>
            ) : (
              <>
                <div className={styles.modalBody}>
                  <div className={styles.modalList}>
                    {visibleDebtors.map((debtor, idx) => (
                      <div key={`${debtor.id}-${debtor.group_title}-${idx}`} className={styles.modalListItem}>
                        <div className={styles.modalListItemMain}>
                          <div className={styles.modalStudentRow}>
                            <button
                              type="button"
                              className={styles.modalStudentName}
                              onClick={() => { router.push(`/students/${debtor.id}`); setShowDebtsModal(false); setDebtsTab('month'); setDebtMonthFilter(''); }}
                            >
                              {debtor.full_name}
                            </button>
                            <button
                              type="button"
                              className={styles.modalStudentOpenBtn}
                              aria-label={`Відкрити картку учня ${debtor.full_name}`}
                              title="Відкрити картку учня"
                              onClick={() => openStudentModal(debtor.id, debtor.full_name)}
                            >
                              <SquareArrowOutUpRight size={13} />
                            </button>
                          </div>
                          <div className={styles.activityMeta}>
                            {debtor.public_id} · {debtor.group_title}
                          </div>
                          <div className={styles.debtDetails}>
                            {debtor.lessons_count} ур. · очікувано {new Intl.NumberFormat('uk-UA').format(debtor.expected_amount)} ₴ · сплачено {new Intl.NumberFormat('uk-UA').format(debtor.paid_amount)} ₴
                            {debtor.discount_percent > 0 && <> · знижка {debtor.discount_percent}%</>}
                          </div>
                        </div>
                        <div className={styles.debtAmount}>
                          {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0 }).format(debtor.debt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  Загальний борг: <strong>
                    {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0 }).format(visibleDebtorsTotal)}
                  </strong>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Attendance Panel */}
      {canUsePortal && showAbsencesModal && createPortal(
        <div className={styles.modalOverlay} onClick={() => { setShowAbsencesModal(false); setAttendanceAllTimeMonthFilter(''); }}>
          <div className={`${styles.modalContent} ${attendanceView === 'stats' ? styles.modalWide : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {attendanceView === 'stats' && attMonthFilter ? (
                  <>
                    <button type="button" className={styles.modalClose} aria-label="Назад до статистики відвідуваності" onClick={() => setAttMonthFilter(null)} title="Назад" style={{ marginRight: '0.25rem' }}>
                      <ChevronLeft size={18} />
                    </button>
                    {attendanceStats?.monthlyStats.find(m => m.month === attMonthFilter)?.monthLabel || 'Пропуски'}
                  </>
                ) : attendanceView === 'stats' ? (
                  <><BarChart3 size={18} /> Статистика відвідуваності</>
                ) : attendanceView === 'allTime' ? (
                  <><Check size={18} /> Пропуски за увесь час</>
                ) : (
                  <><Check size={18} /> Пропуски за місяць</>
                )}
              </h2>
              <button type="button" className={styles.modalClose} aria-label="Закрити модальне вікно пропусків" onClick={() => { setShowAbsencesModal(false); setAttendanceAllTimeMonthFilter(''); }}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalTabBar}>
              <div className={`${styles.segmented} ${styles.segmented3}`} data-active={attendanceView}>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${attendanceView === 'month' ? styles.segmentButtonActive : ''}`}
                  onClick={() => handleAttendanceViewChange('month')}
                >
                  За місяць
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${attendanceView === 'allTime' ? styles.segmentButtonActive : ''}`}
                  onClick={() => handleAttendanceViewChange('allTime')}
                >
                  За увесь час
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${attendanceView === 'stats' ? styles.segmentButtonActive : ''}`}
                  onClick={() => handleAttendanceViewChange('stats')}
                >
                  Статистика
                </button>
              </div>
            </div>

            {/* ── Current month absences ── */}
            {attendanceView === 'month' && (
              initialData.absencesList.length === 0 ? (
                <div className={styles.modalBody}>
                  <div className={styles.compactEmpty}>Пропусків за цей місяць немає.</div>
                </div>
              ) : (
                <>
                  <div className={styles.modalBody}>
                    <div className={styles.modalList}>
                      {initialData.absencesList.map((absence) => (
                        <div key={absence.id} className={styles.modalListItem}>
                          <div className={styles.modalListItemMain}>
                            <div className={styles.modalStudentRow}>
                              <button type="button" className={styles.modalStudentName} onClick={() => { router.push(`/students/${absence.student_id}`); setShowAbsencesModal(false); }}>
                                {absence.full_name}
                              </button>
                              <button type="button" className={styles.modalStudentOpenBtn} aria-label={`Відкрити картку учня ${absence.full_name}`} title="Відкрити картку учня" onClick={() => openStudentModal(absence.student_id, absence.full_name)}>
                                <SquareArrowOutUpRight size={13} />
                              </button>
                            </div>
                            <div className={styles.activityMeta}>
                              {absence.public_id} · {absence.group_title}
                              {absence.course_title && <> · {absence.course_title}</>}
                            </div>
                          </div>
                          <div className={styles.absenceActions}>
                            <button type="button" className={styles.absenceDateLink} aria-label={`Відкрити заняття ${absence.lessonDateLabel} ${absence.start_time}`} title="Відкрити заняття" onClick={() => openLessonModal(absence.lesson_id, `Заняття #${absence.lesson_id}`)}>
                              <BookOpen size={12} />
                              {absence.lessonDateLabel}, {absence.start_time}
                            </button>
                            <button type="button" className={styles.makeupBtn} aria-label={`Призначити відпрацювання для ${absence.full_name}`} title="Призначити відпрацювання" onClick={() => window.dispatchEvent(new CustomEvent('itrobot-open-create-lesson', { detail: { tab: 'makeup', absenceIds: [absence.id] } }))}>
                              <RefreshCw size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.modalFooter}>
                    Пропусків: <strong>{initialData.absencesList.length}</strong>
                  </div>
                </>
              )
            )}

            {/* ── All-time absences ── */}
            {attendanceView === 'allTime' && (
              allTimeAbsencesLoading ? (
                <div className={styles.modalBody}><SkeletonList /></div>
              ) : !allTimeAbsences || allTimeAbsences.length === 0 ? (
                <div className={styles.modalBody}><div className={styles.compactEmpty}>Пропусків немає.</div></div>
              ) : (
                <>
                  <div className={styles.modalFilterBar}>
                    <label className={styles.monthPickerWrap}>
                      <span className={styles.monthPickerLabel}>Місяць</span>
                      <span className={styles.monthPickerShell}>
                        <Calendar size={15} className={styles.monthPickerIcon} />
                        <select
                          className={styles.monthPickerSelect}
                          value={attendanceAllTimeMonthFilter}
                          onChange={(e) => setAttendanceAllTimeMonthFilter(e.target.value)}
                        >
                          <option value="">Усі місяці</option>
                          {allTimeAbsenceMonths.map((monthValue) => (
                            <option key={monthValue} value={monthValue}>
                              {formatMonthLabel(monthValue)}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={15} className={styles.monthPickerChevron} />
                      </span>
                    </label>
                  </div>
                  <div className={styles.modalBody}>
                    <div className={styles.modalList}>
                      {filteredAllTimeAbsences.map((absence) => (
                        <div key={absence.id} className={styles.modalListItem}>
                          <div className={styles.modalListItemMain}>
                            <div className={styles.modalStudentRow}>
                              <button type="button" className={styles.modalStudentName} onClick={() => { router.push(`/students/${absence.student_id}`); setShowAbsencesModal(false); }}>
                                {absence.full_name}
                              </button>
                              <button type="button" className={styles.modalStudentOpenBtn} aria-label={`Відкрити картку учня ${absence.full_name}`} title="Відкрити картку учня" onClick={() => openStudentModal(absence.student_id, absence.full_name)}>
                                <SquareArrowOutUpRight size={13} />
                              </button>
                            </div>
                            <div className={styles.activityMeta}>
                              {absence.public_id} · {absence.group_title}
                              {absence.course_title && <> · {absence.course_title}</>}
                            </div>
                          </div>
                          <div className={styles.absenceActions}>
                            <button type="button" className={styles.absenceDateLink} aria-label={`Відкрити заняття ${absence.lessonDateLabel} ${absence.start_time}`} title="Відкрити заняття" onClick={() => openLessonModal(absence.lesson_id, `Заняття #${absence.lesson_id}`)}>
                              <BookOpen size={12} />
                              {absence.lessonDateLabel}, {absence.start_time}
                            </button>
                            <button type="button" className={styles.makeupBtn} aria-label={`Призначити відпрацювання для ${absence.full_name}`} title="Призначити відпрацювання" onClick={() => window.dispatchEvent(new CustomEvent('itrobot-open-create-lesson', { detail: { tab: 'makeup', absenceIds: [absence.id] } }))}>
                              <RefreshCw size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.modalFooter}>
                    Всього пропусків: <strong>{filteredAllTimeAbsences.length}</strong>
                  </div>
                </>
              )
            )}

            {/* ── Statistics view ── */}
            {attendanceView === 'stats' && (
              attendanceStatsLoading ? (
                <div className={styles.modalBody}><SkeletonList /></div>
              ) : !attendanceStats ? (
                <div className={styles.modalBody}><div className={styles.compactEmpty}>Не вдалося завантажити дані.</div></div>
              ) : attMonthFilter ? (
                /* ── Month drill-down ── */
                (() => {
                  const monthAbsences = attendanceStats.absencesByMonth.filter(a => a.month === attMonthFilter);
                  const monthStat = attendanceStats.monthlyStats.find(m => m.month === attMonthFilter);
                  return (
                    <>
                      {monthStat && (
                        <div className={styles.attSummaryBar}>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Присутні</span>
                            <span className={`${styles.attSummaryValue} ${styles.statValueGood}`}>{monthStat.present}</span>
                          </div>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Відсутні</span>
                            <span className={`${styles.attSummaryValue} ${styles.statValueDanger}`}>{monthStat.absent}</span>
                          </div>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Всього</span>
                            <span className={styles.attSummaryValue}>{monthStat.total}</span>
                          </div>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Відвідуваність</span>
                            <span className={`${styles.attSummaryValue} ${monthStat.percent >= 90 ? styles.statValueGood : monthStat.percent < 70 ? styles.statValueDanger : ''}`}>{monthStat.percent}%</span>
                          </div>
                        </div>
                      )}
                      <div className={styles.modalBody}>
                        {monthAbsences.length === 0 ? (
                          <div className={styles.compactEmpty}>Пропусків немає.</div>
                        ) : (
                          <div className={styles.modalList}>
                            {monthAbsences.map((absence) => (
                              <div key={absence.id} className={styles.modalListItem}>
                                <div className={styles.modalListItemMain}>
                                  <div className={styles.modalStudentRow}>
                                    <button type="button" className={styles.modalStudentName} onClick={() => { router.push(`/students/${absence.student_id}`); setShowAbsencesModal(false); }}>
                                      {absence.full_name}
                                    </button>
                                    <button type="button" className={styles.modalStudentOpenBtn} aria-label={`Відкрити картку учня ${absence.full_name}`} title="Відкрити картку учня" onClick={() => openStudentModal(absence.student_id, absence.full_name)}>
                                      <SquareArrowOutUpRight size={13} />
                                    </button>
                                  </div>
                                  <div className={styles.activityMeta}>
                                    {absence.public_id} · {absence.group_title}
                                    {absence.course_title && <> · {absence.course_title}</>}
                                  </div>
                                </div>
                                <div className={styles.absenceActions}>
                                  <button type="button" className={styles.absenceDateLink} aria-label={`Відкрити заняття ${absence.lessonDateLabel} ${absence.start_time}`} title="Відкрити заняття" onClick={() => openLessonModal(absence.lesson_id, `Заняття #${absence.lesson_id}`)}>
                                    <BookOpen size={12} />
                                    {absence.lessonDateLabel}, {absence.start_time}
                                  </button>
                                  <button type="button" className={styles.makeupBtn} aria-label={`Призначити відпрацювання для ${absence.full_name}`} title="Призначити відпрацювання" onClick={() => window.dispatchEvent(new CustomEvent('itrobot-open-create-lesson', { detail: { tab: 'makeup', absenceIds: [absence.id] } }))}>
                                    <RefreshCw size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className={styles.modalFooter}>
                        Пропусків: <strong>{monthAbsences.length}</strong>
                      </div>
                    </>
                  );
                })()
              ) : (
                /* ── Overview: chart + summary + top absentees ── */
                <div className={styles.modalBody}>
                  <div className={styles.attOverview}>
                    {/* Monthly chart */}
                    <div className={styles.attSection}>
                      <div className={styles.attSectionTitle}>Відвідуваність по місяцях</div>
                      {attendanceStats.monthlyStats.length === 0 ? (
                        <div className={styles.compactEmpty}>Немає даних.</div>
                      ) : (
                        <div className={styles.attChart}>
                          {attendanceStats.monthlyStats.map((m) => {
                            const maxTotal = Math.max(...attendanceStats.monthlyStats.map(s => s.total), 1);
                            const presentHeight = (m.present / maxTotal) * 100;
                            const absentHeight = (m.absent / maxTotal) * 100;
                            const shortMonth = new Intl.DateTimeFormat('uk-UA', { month: 'short' }).format(
                              new Date(Number(m.month.split('-')[0]), Number(m.month.split('-')[1]) - 1, 15)
                            );
                            return (
                              <button
                                key={m.month}
                                type="button"
                                className={styles.attChartCol}
                                onClick={() => setAttMonthFilter(m.month)}
                                title={`${m.monthLabel}: ${m.percent}%`}
                              >
                                <div className={styles.attChartPercent}>{m.percent}%</div>
                                <div className={styles.attChartBar}>
                                  <div className={styles.attChartBarPresent} style={{ height: `${presentHeight}%` }} />
                                  <div className={styles.attChartBarAbsent} style={{ height: `${absentHeight}%` }} />
                                </div>
                                <div className={styles.attChartLabel}>{shortMonth}</div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Summary stats for current month */}
                    {attendanceStats.monthlyStats.length > 0 && (() => {
                      const current = attendanceStats.monthlyStats[attendanceStats.monthlyStats.length - 1];
                      const prev = attendanceStats.monthlyStats.length > 1
                        ? attendanceStats.monthlyStats[attendanceStats.monthlyStats.length - 2]
                        : null;
                      const trend = prev ? current.percent - prev.percent : 0;
                      return (
                        <div className={styles.attSummaryBar}>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Цей місяць</span>
                            <span className={`${styles.attSummaryValue} ${current.percent >= 90 ? styles.statValueGood : current.percent < 70 ? styles.statValueDanger : ''}`}>
                              {current.percent}%
                              {trend !== 0 && (
                                <span className={`${styles.attTrendBadge} ${trend > 0 ? styles.trendUp : styles.trendDown}`}>
                                  {trend > 0 ? '+' : ''}{trend}%
                                </span>
                              )}
                            </span>
                          </div>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Присутні</span>
                            <span className={styles.attSummaryValue}>{current.present}</span>
                          </div>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Відсутні</span>
                            <span className={styles.attSummaryValue}>{current.absent}</span>
                          </div>
                          <div className={styles.attSummaryItem}>
                            <span className={styles.attSummaryLabel}>Всього</span>
                            <span className={styles.attSummaryValue}>{current.total}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Top absentees */}
                    {attendanceStats.topAbsentees.length > 0 && (
                      <div className={styles.attSection}>
                        <div className={styles.attSectionTitle}>Найбільше пропусків (3 міс.)</div>
                        <div className={styles.attAbsenteeList}>
                          {attendanceStats.topAbsentees.map((s) => (
                            <div key={s.student_id} className={styles.attAbsenteeItem}>
                              <div className={styles.attAbsenteeInfo}>
                                <button type="button" className={styles.modalStudentName} onClick={() => openStudentModal(s.student_id, s.full_name)}>
                                  {s.full_name}
                                </button>
                                <span className={styles.activityMeta}>{s.public_id}</span>
                              </div>
                              <div className={styles.attAbsenteeStats}>
                                <div className={styles.attAbsenteeBarOuter}>
                                  <div
                                    className={`${styles.attAbsenteeBarInner} ${s.percent >= 90 ? styles.capacityBarFull : s.percent < 70 ? styles.capacityBarLow : ''}`}
                                    style={{ width: `${s.percent}%` }}
                                  />
                                </div>
                                <span className={styles.attAbsenteeStat}>
                                  <span className={styles.statValueDanger}>{s.absences}</span>
                                  <span className={styles.activityMeta}>/ {s.total_lessons}</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        </div>,
        document.body
      )}

      {canUsePortal && showHistoryModal && createPortal(
        <div className={styles.modalOverlay} onClick={() => setShowHistoryModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <Clock size={18} />
                Повна історія змін
              </h2>
              <button type="button" className={styles.modalClose} aria-label="Закрити повну історію змін" onClick={() => setShowHistoryModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div ref={historyBodyRef} className={styles.modalBody}>
              {historyLoading && !historyPageData ? (
                <SkeletonList />
              ) : historyPageData && historyPageData.items.length > 0 ? (
                <div className={styles.modalList}>
                  {historyPageData.items.map((history, index) => (
                    <div
                      key={`${history.entity_type}-${history.entity_id ?? history.entity_public_id ?? index}-${history.created_at}-${index}`}
                      className={`${styles.modalListItem} ${styles.historyListItem}`}
                    >
                      <div className={styles.modalListItemMain}>
                        {canOpenHistoryEntityModal(history) ? (
                          <button
                            type="button"
                            className={styles.historyEntityButton}
                            onClick={() => openHistoryEntityModal(history)}
                            title="Відкрити картку"
                          >
                            {history.entity_title}
                          </button>
                        ) : (
                          <div className={styles.activityTitle}>{history.entity_title}</div>
                        )}
                        <div className={styles.activityMeta}>
                          {history.entity_public_id ? (
                            canOpenHistoryEntityModal(history) ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.historyMetaLink}
                                  onClick={() => openHistoryEntityModal(history)}
                                  title="Відкрити картку"
                                >
                                  {history.entity_public_id}
                                </button>
                                {' · '}
                              </>
                            ) : `${history.entity_public_id} · `
                          ) : null}
                          {history.createdAtLabel} · {history.user_name}
                        </div>
                        <div className={styles.activityDescription}>{renderHistoryDescription(history)}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={historyLoadMoreRef} className={styles.historyLoadMoreTrigger} aria-hidden="true" />
                  {historyLoading && historyHasMore && (
                    <div className={styles.historyLoadMoreText}>Завантажуємо ще записи...</div>
                  )}
                </div>
              ) : (
                <div className={styles.compactEmpty}>Історія змін поки порожня.</div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.historyFooterMeta}>
                {historyPagination
                  ? historyHasMore
                    ? `Показано ${historyLoadedCount} із ${historyTotalCount} записів`
                    : `Усі записи завантажено: ${historyTotalCount}`
                  : 'Повна історія доступна посторінково'}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
