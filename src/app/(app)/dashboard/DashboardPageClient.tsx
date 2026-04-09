'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Calendar, CreditCard, DollarSign, Plus, Users, Users2 } from 'lucide-react';
import CreateGroupModal from '@/components/CreateGroupModal';
import CreateLessonModal from '@/components/CreateLessonModal';
import ScheduleLessonCard from '@/components/ScheduleLessonCard';
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

export default function DashboardPageClient({ initialData }: { initialData: DashboardStatsPayload }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>('payments');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);

  const completedLessons = initialData.todaySchedule.filter((lesson) => lesson.status === 'done').length;
  const visiblePayments = initialData.recentPayments.slice(0, 6);
  const visibleHistory = initialData.recentHistory.slice(0, 6);

  return (
    <>
      <div className={styles.page}>
        {/* Hero — clean greeting + quick actions */}
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
                  <span className={styles.statIcon}>
                    <Icon size={16} />
                  </span>
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
                <BookOpen size={20} />
                <div className={styles.emptyTitle}>На сьогодні занять немає</div>
                <div className={styles.emptyText}>
                  Можна зосередитись на платежах, групах або плануванні наступних уроків.
                </div>
              </div>
            ) : (
              <div className={styles.scheduleCards}>
                {initialData.todaySchedule.slice(0, 10).map((lesson) => (
                  <ScheduleLessonCard
                    key={lesson.id}
                    lesson={{
                      id: lesson.id,
                      groupId: lesson.groupId,
                      groupTitle: lesson.groupTitle || lesson.courseTitle,
                      courseId: lesson.courseId,
                      courseTitle: lesson.courseTitle,
                      teacherId: lesson.teacherId,
                      teacherName: lesson.teacherName,
                      startTime: lesson.startTimeLabel,
                      endTime: lesson.endTimeLabel,
                      status: lesson.status as 'scheduled' | 'done' | 'canceled',
                      topic: lesson.topic,
                      originalDate: lesson.originalDate,
                      isRescheduled: lesson.isRescheduled,
                      isMakeup: lesson.isMakeup,
                      isTrial: lesson.isTrial,
                      isReplaced: lesson.isReplaced,
                    }}
                    onClick={() => router.push('/schedule')}
                  />
                ))}
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
