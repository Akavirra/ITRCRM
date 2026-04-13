'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, BarChart3, BookOpen, Calendar, Check, ChevronLeft, ChevronRight, Clock, CreditCard, DollarSign,
  ExternalLink, GraduationCap, Plus, RefreshCw, SquareArrowOutUpRight, TrendingDown, TrendingUp, User as UserIcon, Users, Users2, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import CreateGroupModal from '@/components/CreateGroupModal';
import CreateLessonModal from '@/components/CreateLessonModal';
import CreateStudentModal from '@/components/CreateStudentModal';
import TransitionLink from '@/components/TransitionLink';
import AnimatedNumber from '@/components/AnimatedNumber';
import Sparkline from '@/components/Sparkline';
import { useStudentModals } from '@/components/StudentModalsContext';
import { useLessonModals } from '@/components/LessonModalsContext';
import type { DashboardStatsPayload } from '@/lib/dashboard-types';
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

const studentsLabels: Record<StudentsPeriod, string> = {
  today: 'Дітей сьогодні',
  month: 'Дітей за місяць',
  year: 'Дітей за рік',
};

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

function NextLessonCountdown({ startDatetime }: { startDatetime: string }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function update() {
      const diff = new Date(startDatetime).getTime() - Date.now();
      if (diff <= 0) { setLabel('Зараз!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(h > 0 ? `через ${h} год ${m} хв` : `через ${m} хв`);
    }
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [startDatetime]);

  return <span className={styles.nextLessonCountdown}>{label}</span>;
}

export default function DashboardPageClient({ initialData }: { initialData: DashboardStatsPayload }) {
  const router = useRouter();
  const { openStudentModal } = useStudentModals();
  const { openLessonModal } = useLessonModals();
  const [activeTab, setActiveTab] = useState<ActivityTab>('payments');
  const [statsPeriod, setStatsPeriod] = useState<PeriodTab>('month');
  const [studentsPeriod, setStudentsPeriod] = useState<StudentsPeriod>('today');
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);
  const [showDebtsModal, setShowDebtsModal] = useState(false);
  const [showAbsencesModal, setShowAbsencesModal] = useState(false);
  const [debtsTab, setDebtsTab] = useState<PeriodTab>('month');

  const [allTimeDebtors, setAllTimeDebtors] = useState<AllTimeDebtor[] | null>(null);
  const [allTimeDebtsLoading, setAllTimeDebtsLoading] = useState(false);
  const [attendanceView, setAttendanceView] = useState<AttendanceView>('month');
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStatsData | null>(null);
  const [attendanceStatsLoading, setAttendanceStatsLoading] = useState(false);
  const [attMonthFilter, setAttMonthFilter] = useState<string | null>(null);
  const [allTimeAbsences, setAllTimeAbsences] = useState<AllTimeAbsence[] | null>(null);
  const [allTimeAbsencesLoading, setAllTimeAbsencesLoading] = useState(false);

  const handleDebtsTabChange = (tab: PeriodTab) => {
    setDebtsTab(tab);
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
    if (view === 'stats') loadAttendanceStats();
    if (view === 'allTime') loadAllTimeAbsences();
  };

  const handleOpenAttendance = () => {
    setShowAbsencesModal(true);
    setAttendanceView('month');
    setAttMonthFilter(null);
  };

  const completedLessons = initialData.todaySchedule.filter((l) => l.status === 'completed' || l.status === 'done').length;
  const visiblePayments = initialData.recentPayments.slice(0, 6);
  const visibleHistory = initialData.recentHistory.slice(0, 6);

  const formattedDate = format(new Date(initialData.todayDate), 'd MMMM, EEEE', { locale: uk });
  const canUsePortal = typeof window !== 'undefined';

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
          <div className={styles.segmented}>
            <button
              type="button"
              className={`${styles.segmentButton} ${statsPeriod === 'month' ? styles.segmentButtonActive : ''}`}
              onClick={() => setStatsPeriod('month')}
            >
              За місяць
            </button>
            <button
              type="button"
              className={`${styles.segmentButton} ${statsPeriod === 'allTime' ? styles.segmentButtonActive : ''}`}
              onClick={() => setStatsPeriod('allTime')}
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
                  opacity: statsPeriod === 'month' ? 0.8 : 0,
                  transition: 'opacity 0.2s ease'
                }}
              >
                {initialData.stats.revenueTrend && <Sparkline data={initialData.stats.revenueTrend} color="#10b981" />}
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
                  onClick={() => setShowDebtsModal(true)}
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
                  onClick={handleOpenAttendance}
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
                      opacity: statsPeriod === 'month' ? 0.8 : 0,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    {initialData.stats.attendanceTrend && <Sparkline data={initialData.stats.attendanceTrend} color="#3b82f6" />}
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
                    onClick={() => setStudentsPeriod('today')}
                  >
                    День
                  </button>
                  <button
                    type="button"
                    className={`${styles.miniSegmentBtn} ${studentsPeriod === 'month' ? styles.miniSegmentBtnActive : ''}`}
                    onClick={() => setStudentsPeriod('month')}
                  >
                    Місяць
                  </button>
                  <button
                    type="button"
                    className={`${styles.miniSegmentBtn} ${studentsPeriod === 'year' ? styles.miniSegmentBtnActive : ''}`}
                    onClick={() => setStudentsPeriod('year')}
                  >
                    Рік
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Next lesson countdown */}
        {initialData.nextLesson && (
          <section className={styles.nextLessonBar}>
            <Clock size={16} />
            <span className={styles.nextLessonText}>
              Наступний урок: <strong>{initialData.nextLesson.startTimeLabel}</strong>
              {initialData.nextLesson.group_id
                ? <> — {initialData.nextLesson.group_title}</>
                : <> — {initialData.nextLesson.course_title}</>
              }
              {' · '}{initialData.nextLesson.teacher_name}
            </span>
            <NextLessonCountdown startDatetime={initialData.nextLesson.start_datetime} />
          </section>
        )}

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
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${activeTab === 'payments' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setActiveTab('payments')}
                >
                  Платежі
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${activeTab === 'history' ? styles.segmentButtonActive : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  Історія
                </button>
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
                  <div key={`${history.student_public_id}-${index}`} className={styles.activityItem}>
                    <div>
                      <div className={styles.activityTitle}>{history.student_name}</div>
                      <div className={styles.activityMeta}>
                        {history.createdAtLabel} · {history.user_name}
                      </div>
                      <div className={styles.activityDescription}>{history.action_description}</div>
                    </div>
                    <div className={styles.historyType}>{history.action_type}</div>
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
        <div className={styles.modalOverlay} onClick={() => { setShowDebtsModal(false); setDebtsTab('month'); }}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <AlertTriangle size={18} />
                {debtsTab === 'month' ? 'Борги за поточний місяць' : 'Борги за увесь період'}
              </h2>
              <button type="button" className={styles.modalClose} onClick={() => { setShowDebtsModal(false); setDebtsTab('month'); }}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalTabBar}>
              <div className={styles.segmented}>
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
                                onClick={() => { router.push(`/students/${debtor.id}`); setShowDebtsModal(false); setDebtsTab('month'); }}
                              >
                                {debtor.full_name}
                              </button>
                              <button
                                type="button"
                                className={styles.modalStudentOpenBtn}
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
            ) : allTimeDebtsLoading ? (
              <div className={styles.modalBody}>
                <div className={styles.compactEmpty}>Завантаження...</div>
              </div>
            ) : !allTimeDebtors || allTimeDebtors.length === 0 ? (
              <div className={styles.modalBody}>
                <div className={styles.compactEmpty}>Боржників немає.</div>
              </div>
            ) : (
              <>
                <div className={styles.modalBody}>
                  <div className={styles.modalList}>
                    {allTimeDebtors.map((debtor, idx) => (
                      <div key={`${debtor.id}-${debtor.group_title}-${idx}`} className={styles.modalListItem}>
                        <div className={styles.modalListItemMain}>
                          <div className={styles.modalStudentRow}>
                            <button
                              type="button"
                              className={styles.modalStudentName}
                              onClick={() => { router.push(`/students/${debtor.id}`); setShowDebtsModal(false); setDebtsTab('month'); }}
                            >
                              {debtor.full_name}
                            </button>
                            <button
                              type="button"
                              className={styles.modalStudentOpenBtn}
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
                    {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0 }).format(
                      allTimeDebtors.reduce((sum, d) => sum + d.debt, 0)
                    )}
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
        <div className={styles.modalOverlay} onClick={() => setShowAbsencesModal(false)}>
          <div className={`${styles.modalContent} ${attendanceView === 'stats' ? styles.modalWide : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {attendanceView === 'stats' && attMonthFilter ? (
                  <>
                    <button type="button" className={styles.modalClose} onClick={() => setAttMonthFilter(null)} title="Назад" style={{ marginRight: '0.25rem' }}>
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
              <button type="button" className={styles.modalClose} onClick={() => setShowAbsencesModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalTabBar}>
              <div className={styles.segmented}>
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
                              <button type="button" className={styles.modalStudentOpenBtn} title="Відкрити картку учня" onClick={() => openStudentModal(absence.student_id, absence.full_name)}>
                                <SquareArrowOutUpRight size={13} />
                              </button>
                            </div>
                            <div className={styles.activityMeta}>
                              {absence.public_id} · {absence.group_title}
                              {absence.course_title && <> · {absence.course_title}</>}
                            </div>
                          </div>
                          <div className={styles.absenceActions}>
                            <button type="button" className={styles.absenceDateLink} title="Відкрити заняття" onClick={() => openLessonModal(absence.lesson_id, `Заняття #${absence.lesson_id}`)}>
                              <BookOpen size={12} />
                              {absence.lessonDateLabel}, {absence.start_time}
                            </button>
                            <button type="button" className={styles.makeupBtn} title="Призначити відпрацювання" onClick={() => window.dispatchEvent(new CustomEvent('itrobot-open-create-lesson', { detail: { tab: 'makeup', absenceIds: [absence.id] } }))}>
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
                <div className={styles.modalBody}><div className={styles.compactEmpty}>Завантаження...</div></div>
              ) : !allTimeAbsences || allTimeAbsences.length === 0 ? (
                <div className={styles.modalBody}><div className={styles.compactEmpty}>Пропусків немає.</div></div>
              ) : (
                <>
                  <div className={styles.modalBody}>
                    <div className={styles.modalList}>
                      {allTimeAbsences.map((absence) => (
                        <div key={absence.id} className={styles.modalListItem}>
                          <div className={styles.modalListItemMain}>
                            <div className={styles.modalStudentRow}>
                              <button type="button" className={styles.modalStudentName} onClick={() => { router.push(`/students/${absence.student_id}`); setShowAbsencesModal(false); }}>
                                {absence.full_name}
                              </button>
                              <button type="button" className={styles.modalStudentOpenBtn} title="Відкрити картку учня" onClick={() => openStudentModal(absence.student_id, absence.full_name)}>
                                <SquareArrowOutUpRight size={13} />
                              </button>
                            </div>
                            <div className={styles.activityMeta}>
                              {absence.public_id} · {absence.group_title}
                              {absence.course_title && <> · {absence.course_title}</>}
                            </div>
                          </div>
                          <div className={styles.absenceActions}>
                            <button type="button" className={styles.absenceDateLink} title="Відкрити заняття" onClick={() => openLessonModal(absence.lesson_id, `Заняття #${absence.lesson_id}`)}>
                              <BookOpen size={12} />
                              {absence.lessonDateLabel}, {absence.start_time}
                            </button>
                            <button type="button" className={styles.makeupBtn} title="Призначити відпрацювання" onClick={() => window.dispatchEvent(new CustomEvent('itrobot-open-create-lesson', { detail: { tab: 'makeup', absenceIds: [absence.id] } }))}>
                              <RefreshCw size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.modalFooter}>
                    Всього пропусків: <strong>{allTimeAbsences.length}</strong>
                  </div>
                </>
              )
            )}

            {/* ── Statistics view ── */}
            {attendanceView === 'stats' && (
              attendanceStatsLoading ? (
                <div className={styles.modalBody}><div className={styles.compactEmpty}>Завантаження...</div></div>
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
                                    <button type="button" className={styles.modalStudentOpenBtn} title="Відкрити картку учня" onClick={() => openStudentModal(absence.student_id, absence.full_name)}>
                                      <SquareArrowOutUpRight size={13} />
                                    </button>
                                  </div>
                                  <div className={styles.activityMeta}>
                                    {absence.public_id} · {absence.group_title}
                                    {absence.course_title && <> · {absence.course_title}</>}
                                  </div>
                                </div>
                                <div className={styles.absenceActions}>
                                  <button type="button" className={styles.absenceDateLink} title="Відкрити заняття" onClick={() => openLessonModal(absence.lesson_id, `Заняття #${absence.lesson_id}`)}>
                                    <BookOpen size={12} />
                                    {absence.lessonDateLabel}, {absence.start_time}
                                  </button>
                                  <button type="button" className={styles.makeupBtn} title="Призначити відпрацювання" onClick={() => window.dispatchEvent(new CustomEvent('itrobot-open-create-lesson', { detail: { tab: 'makeup', absenceIds: [absence.id] } }))}>
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
    </>
  );
}
