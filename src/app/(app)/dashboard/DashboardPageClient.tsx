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
  { key: 'activeStudents', label: 'Активні учні', icon: Users },
  { key: 'activeGroups', label: 'Активні групи', icon: Users2 },
  { key: 'todayLessons', label: 'Занять сьогодні', icon: BookOpen },
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
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>Огляд дня</div>
            <h1 className={styles.heroTitle}>{initialData.greeting}!</h1>
            <p className={styles.heroText}>
              {initialData.generatedAtLabel} · {initialData.stats.todayLessons} занять у розкладі
            </p>
          </div>

          <div className={styles.heroActions}>
            <TransitionLink href="/students?create=1" className={styles.actionButton}>
              <span className={styles.actionButtonIcon}>
                <Plus size={16} />
              </span>
              Учень
            </TransitionLink>

            <button type="button" className={styles.actionButton} onClick={() => setShowCreateGroupModal(true)}>
              <span className={styles.actionButtonIcon}>
                <Users2 size={16} />
              </span>
              Група
            </button>

            <button type="button" className={styles.actionButton} onClick={() => setShowCreateLessonModal(true)}>
              <span className={styles.actionButtonIcon}>
                <Calendar size={16} />
              </span>
              Заняття
            </button>

            <TransitionLink href="/payments?newPayment=1" className={styles.actionButton}>
              <span className={styles.actionButtonIcon}>
                <CreditCard size={16} />
              </span>
              Оплата
            </TransitionLink>
          </div>
        </section>

        <section className={styles.statsGrid}>
          {statCards.map((card) => {
            const Icon = card.icon;
            const value = card.key === 'monthlyRevenue' ? initialData.stats.monthlyRevenueLabel : initialData.stats[card.key];

            const hint =
              card.key === 'todayLessons'
                ? `${completedLessons} із ${initialData.stats.todayLessons} завершено`
                : card.key === 'monthlyRevenue'
                  ? 'Поточний календарний місяць'
                  : card.key === 'activeGroups'
                    ? 'Групи з активними заняттями'
                    : 'Учні з активним навчанням';

            return (
              <article key={card.key} className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statIcon}>
                    <Icon size={16} />
                  </span>
                  <span className={styles.statLabel}>{card.label}</span>
                </div>
                <div className={styles.statValue}>{value}</div>
                <div className={styles.statHint}>{hint}</div>
              </article>
            );
          })}
        </section>

        <div className={styles.workspaceGrid}>
          <section className={`${styles.panel} ${styles.schedulePanel}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeading}>
                <div className={styles.panelLabel}>Сьогодні</div>
                <h2 className={styles.panelTitle}>Розклад</h2>
              </div>

              <div className={styles.panelHeaderMeta}>
                <span className={styles.countBadge}>{initialData.todaySchedule.length}</span>
                <TransitionLink href="/schedule" className={styles.textLink}>
                  Відкрити розклад
                </TransitionLink>
              </div>
            </div>

            {initialData.todaySchedule.length === 0 ? (
              <div className={styles.emptyState}>
                <BookOpen size={20} />
                <div className={styles.emptyTitle}>На сьогодні занять немає</div>
                <div className={styles.emptyText}>Можна перейти до платежів, груп або планування наступних уроків.</div>
              </div>
            ) : (
              <div className={styles.scheduleCards}>
                {initialData.todaySchedule.slice(0, 10).map((lesson) => (
                  <div key={lesson.id} className={styles.lessonCardWrap}>
                    <ScheduleLessonCard
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
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={`${styles.panel} ${styles.activityPanel}`}>
            <div className={styles.panelHeader}>
              <div className={styles.panelHeading}>
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
                      <div className={styles.activityMain}>
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
                    <div className={styles.activityMain}>
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
