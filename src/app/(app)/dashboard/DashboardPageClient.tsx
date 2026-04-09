'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen, Calendar, Check, Clock, CreditCard, DollarSign,
  Plus, RefreshCw, User as UserIcon, Users, Users2, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import CreateGroupModal from '@/components/CreateGroupModal';
import CreateLessonModal from '@/components/CreateLessonModal';
import TransitionLink from '@/components/TransitionLink';
import type { DashboardStatsPayload } from '@/lib/dashboard-types';
import styles from './dashboard.module.css';

type ActivityTab = 'payments' | 'history';

const statCards = [
  { key: 'activeStudents', label: 'Активні студенти', icon: Users },
  { key: 'activeGroups', label: 'Активні групи', icon: Users2 },
  { key: 'todayLessons', label: 'Уроків сьогодні', icon: BookOpen },
  { key: 'monthlyRevenue', label: 'Дохід за місяць', icon: DollarSign },
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

export default function DashboardPageClient({ initialData }: { initialData: DashboardStatsPayload }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>('payments');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);

  const completedLessons = initialData.todaySchedule.filter((l) => l.status === 'completed' || l.status === 'done').length;
  const visiblePayments = initialData.recentPayments.slice(0, 6);
  const visibleHistory = initialData.recentHistory.slice(0, 6);

  return (
    <>
      <div className={styles.page}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <h1 className={styles.heroTitle}>{initialData.greeting}!</h1>
            <span className={styles.heroDate}>{initialData.generatedAtLabel}</span>
          </div>

          <div className={styles.actionsStrip}>
            <TransitionLink href="/students?create=1" className={styles.actionChip}>
              <span className={styles.actionChipIcon}><Plus size={14} /></span>
              Учень
            </TransitionLink>
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
        <section className={styles.statsGrid}>
          {statCards.map((card) => {
            const Icon = card.icon;
            const value = card.key === 'monthlyRevenue' ? initialData.stats.monthlyRevenueLabel : initialData.stats[card.key];
            const hint =
              card.key === 'todayLessons'
                ? `${completedLessons} із ${initialData.stats.todayLessons} завершено`
                : card.key === 'monthlyRevenue'
                  ? 'За поточний місяць'
                  : card.key === 'activeGroups'
                    ? 'Зараз працюють'
                    : 'Активна база';

            return (
              <article key={card.key} className={styles.statCard}>
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>{card.label}</span>
                  <span className={styles.statIcon}><Icon size={16} /></span>
                </div>
                <div className={styles.statValue}>{value}</div>
                <div className={styles.statHint}>{hint}</div>
              </article>
            );
          })}
        </section>

        {/* Two-column: Schedule + Activity */}
        <div className={styles.columns}>
          {/* Schedule */}
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelLabel}>Сьогодні</div>
                <h2 className={styles.panelTitle}>Розклад</h2>
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
                    <div
                      key={lesson.id}
                      className={styles.lessonCard}
                      style={{
                        borderLeft: `3px solid ${ls.borderColor}`,
                        background: ls.background,
                      }}
                    >
                      {/* Type badge */}
                      {lesson.is_makeup ? (
                        <span className={styles.typeBadge} style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                          <RefreshCw size={8} /> Відпрацювання
                        </span>
                      ) : !lesson.group_id && lesson.is_trial ? (
                        <span className={styles.typeBadge} style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>
                          <Check size={8} /> Пробне
                        </span>
                      ) : !lesson.group_id ? (
                        <span className={styles.typeBadge} style={{ background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }}>
                          <UserIcon size={8} /> Індивідуальне
                        </span>
                      ) : null}

                      {/* Time */}
                      <div className={styles.lessonTime} style={{ color: ls.accentColor }}>
                        <Clock size={10} />
                        {lesson.startTimeLabel} - {lesson.endTimeLabel}
                      </div>

                      {/* Group */}
                      {lesson.group_id && !lesson.is_makeup && (
                        <div className={styles.lessonRow}>
                          <Users size={10} />
                          <span style={{ fontWeight: 600, color: '#111827' }}>{lesson.group_title}</span>
                        </div>
                      )}

                      {/* Course */}
                      {lesson.group_id && !lesson.is_makeup && (
                        <div className={styles.lessonRow} style={{ color: ls.accentColor, opacity: 0.85 }}>
                          <BookOpen size={9} />
                          {lesson.course_title}
                        </div>
                      )}

                      {/* Teacher */}
                      <div className={styles.lessonRow} style={{ color: lesson.is_replaced ? '#d97706' : '#9ca3af' }}>
                        <UserIcon size={9} />
                        {lesson.teacher_name}
                        {lesson.is_replaced && (
                          <span className={styles.replacedBadge}>(Зам.)</span>
                        )}
                      </div>

                      {/* Rescheduled info */}
                      {lesson.original_date && (
                        <span className={styles.rescheduledBadge}>
                          <RefreshCw size={8} />
                          Перенесено з {format(new Date(lesson.original_date + 'T00:00:00'), 'd MMM', { locale: uk })}
                        </span>
                      )}

                      {/* Topic */}
                      {lesson.topic && (
                        <div className={styles.lessonTopic}>{lesson.topic}</div>
                      )}

                      {/* Status badge */}
                      <span
                        className={styles.lessonStatusBadge}
                        style={getStatusBadgeStyle(lesson.status, lesson.is_makeup, lesson.group_id)}
                      >
                        {lesson.status === 'done' && <Check size={8} />}
                        {lesson.status === 'canceled' && <X size={8} />}
                        {lesson.status === 'scheduled' && <Calendar size={8} />}
                        {lesson.status === 'done' ? 'Проведено' : lesson.status === 'canceled' ? 'Скасовано' : 'Заплановано'}
                      </span>
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
