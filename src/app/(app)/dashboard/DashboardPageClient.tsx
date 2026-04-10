'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, BookOpen, Calendar, Check, Clock, CreditCard, DollarSign,
  Plus, RefreshCw, TrendingDown, TrendingUp, User as UserIcon, Users, Users2, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import CreateGroupModal from '@/components/CreateGroupModal';
import CreateLessonModal from '@/components/CreateLessonModal';
import CreateStudentModal from '@/components/CreateStudentModal';
import TransitionLink from '@/components/TransitionLink';
import type { DashboardStatsPayload } from '@/lib/dashboard-types';
import styles from './dashboard.module.css';

type ActivityTab = 'payments' | 'history';

const statCards = [
  { key: 'activeStudents', label: 'Активні студенти', icon: Users },
  { key: 'activeGroups', label: 'Активні групи', icon: Users2 },
  { key: 'todayLessons', label: 'Уроків сьогодні', icon: BookOpen },
  { key: 'monthlyRevenue', label: 'Дохід за місяць', icon: DollarSign },
  { key: 'unpaidStudents', label: 'Борги', icon: AlertTriangle },
  { key: 'attendancePercent', label: 'Відвідуваність', icon: Check },
] as const;

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
  const [activeTab, setActiveTab] = useState<ActivityTab>('payments');
  const [showCreateStudentModal, setShowCreateStudentModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);

  const completedLessons = initialData.todaySchedule.filter((l) => l.status === 'completed' || l.status === 'done').length;
  const visiblePayments = initialData.recentPayments.slice(0, 6);
  const visibleHistory = initialData.recentHistory.slice(0, 6);

  const formattedDate = format(new Date(initialData.todayDate), 'd MMMM, EEEE', { locale: uk });

  return (
    <>
      <div className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.heroGreeting}>{initialData.greeting}!</div>
            <h1 className={styles.heroTitle}>{formattedDate}</h1>
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

        {/* Stats */}
        <section className={styles.statsRow}>
          {statCards.map((card) => {
            const Icon = card.icon;
            let value: string | number;
            let trend: React.ReactNode = null;
            let valueClass = styles.statItemValue;

            if (card.key === 'monthlyRevenue') {
              value = initialData.stats.monthlyRevenueLabel;
              const prev = initialData.stats.prevMonthRevenue;
              const curr = initialData.stats.monthlyRevenue;
              if (prev > 0) {
                const pct = Math.round(((curr - prev) / prev) * 100);
                const isUp = pct >= 0;
                trend = (
                  <span className={isUp ? styles.trendUp : styles.trendDown}>
                    {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {isUp ? '+' : ''}{pct}%
                  </span>
                );
              }
            } else if (card.key === 'unpaidStudents') {
              value = initialData.stats.unpaidStudents;
              if (initialData.stats.unpaidStudents > 0) {
                valueClass = `${styles.statItemValue} ${styles.statValueDanger}`;
              }
            } else if (card.key === 'attendancePercent') {
              const pct = initialData.stats.attendancePercent;
              value = pct !== null ? `${pct}%` : '—';
              if (pct !== null && pct < 70) {
                valueClass = `${styles.statItemValue} ${styles.statValueDanger}`;
              } else if (pct !== null && pct >= 90) {
                valueClass = `${styles.statItemValue} ${styles.statValueGood}`;
              }
            } else {
              value = initialData.stats[card.key];
            }

            return (
              <div key={card.key} className={styles.statItem}>
                <div className={styles.statItemLabel}>
                  <Icon size={14} />
                  {card.label}
                </div>
                <div className={valueClass}>
                  {value}
                  {trend}
                </div>
              </div>
            );
          })}
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
                        <span className={styles.rescheduledBadge}>
                          <RefreshCw size={10} />
                          Перенесено з {format(new Date(lesson.original_date + 'T00:00:00'), 'd MMM', { locale: uk })}
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

        {/* Bottom row: Group Capacity + Problem Students */}
        <div className={styles.columns}>
          {/* Group Capacity */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelLabel}>Заповненість</div>
                <h2 className={styles.panelTitle}>Групи</h2>
              </div>
              <TransitionLink href="/groups" className={styles.textLink}>
                Усі групи
              </TransitionLink>
            </div>

            {initialData.groupCapacity.length === 0 ? (
              <div className={styles.compactEmpty}>Немає активних груп.</div>
            ) : (
              <div className={styles.capacityList}>
                {initialData.groupCapacity.map((group) => {
                  const cap = group.capacity || 0;
                  const pct = cap > 0 ? Math.round((group.student_count / cap) * 100) : null;
                  const isFull = pct !== null && pct >= 100;
                  const isLow = pct !== null && pct < 50;
                  return (
                    <div key={group.id} className={styles.capacityItem}>
                      <div className={styles.capacityInfo}>
                        <div className={styles.capacityTitle}>{group.title}</div>
                        <div className={styles.capacityMeta}>{group.course_title}</div>
                      </div>
                      <div className={styles.capacityRight}>
                        <span className={`${styles.capacityCount} ${isFull ? styles.capacityFull : isLow ? styles.capacityLow : ''}`}>
                          {group.student_count}{cap > 0 ? `/${cap}` : ''}
                        </span>
                        {cap > 0 && (
                          <div className={styles.capacityBarOuter}>
                            <div
                              className={`${styles.capacityBarInner} ${isFull ? styles.capacityBarFull : isLow ? styles.capacityBarLow : ''}`}
                              style={{ width: `${Math.min(pct!, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Problem Students */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelLabel}>Увага</div>
                <h2 className={styles.panelTitle}>Проблемні учні</h2>
              </div>
              <TransitionLink href="/students" className={styles.textLink}>
                Усі учні
              </TransitionLink>
            </div>

            {initialData.problemStudents.length === 0 ? (
              <div className={styles.compactEmpty}>Все добре! Проблемних учнів немає.</div>
            ) : (
              <div className={styles.activityList}>
                {initialData.problemStudents.map((student) => (
                  <div key={student.id} className={styles.activityItem}>
                    <div>
                      <div className={styles.activityTitle}>{student.full_name}</div>
                      <div className={styles.activityMeta}>{student.public_id}</div>
                    </div>
                    <div className={styles.problemBadges}>
                      {student.absences_this_month >= 2 && (
                        <span className={styles.badgeDanger}>
                          {student.absences_this_month} пропуск.
                        </span>
                      )}
                      {student.has_debt && (
                        <span className={styles.badgeWarning}>
                          Борг
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
    </>
  );
}
