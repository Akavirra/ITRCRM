'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Calendar, CreditCard, DollarSign, Plus, Users, Users2 } from 'lucide-react';
import TransitionLink from '@/components/TransitionLink';
import CreateGroupModal from '@/components/CreateGroupModal';
import CreateLessonModal from '@/components/CreateLessonModal';
import type { DashboardStatsPayload } from '@/lib/dashboard';
import styles from '@/app/(app)/dashboard/dashboard.module.css';

type ActivityTab = 'payments' | 'history';

const statCards = [
  { key: 'activeStudents', label: 'Активні студенти', icon: Users },
  { key: 'activeGroups', label: 'Активні групи', icon: Users2 },
  { key: 'todayLessons', label: 'Уроків сьогодні', icon: BookOpen },
  { key: 'monthlyRevenue', label: 'Дохід за місяць', icon: DollarSign },
] as const;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: 'long',
  });
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Доброго ранку';
  if (hour < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

function getStatusLabel(status: string) {
  if (status === 'completed') return 'Завершено';
  if (status === 'cancelled' || status === 'canceled') return 'Скасовано';
  return 'Заплановано';
}

function getStatusClass(status: string) {
  if (status === 'completed') return styles.statusDone;
  if (status === 'cancelled' || status === 'canceled') return styles.statusCanceled;
  return styles.statusPlanned;
}

export default function DashboardPageClient({ initialData }: { initialData: DashboardStatsPayload }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>('payments');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateLessonModal, setShowCreateLessonModal] = useState(false);

  const completedLessons = initialData.todaySchedule.filter((lesson) => lesson.status === 'completed').length;
  const visiblePayments = initialData.recentPayments.slice(0, 6);
  const visibleHistory = initialData.recentHistory.slice(0, 6);

  const refreshDashboard = () => {
    router.refresh();
  };

  return (
    <>
      <div className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <div className={styles.heroDate}>Огляд школи на {formatFullDate(new Date().toISOString())}</div>
            <h1 className={styles.heroTitle}>{getGreeting()}!</h1>
            <p className={styles.heroText}>
              Усе важливе на одному екрані: ключові цифри, розклад на сьогодні та останні фінансові й системні зміни.
            </p>
          </div>

          <div className={styles.actionsPanel}>
            <div className={styles.actionsHeader}>
              <div>
                <div className={styles.panelLabel}>Швидкі дії</div>
                <h2 className={styles.panelTitle}>Що потрібно зробити зараз</h2>
              </div>
            </div>

            <div className={styles.actionsGrid}>
              <TransitionLink href="/students?create=1" className={styles.actionButton}>
                <span className={styles.actionIcon}>
                  <Plus size={16} />
                </span>
                <span className={styles.actionText}>Створити учня</span>
              </TransitionLink>

              <button type="button" className={styles.actionButton} onClick={() => setShowCreateGroupModal(true)}>
                <span className={styles.actionIcon}>
                  <Users2 size={16} />
                </span>
                <span className={styles.actionText}>Створити групу</span>
              </button>

              <button type="button" className={styles.actionButton} onClick={() => setShowCreateLessonModal(true)}>
                <span className={styles.actionIcon}>
                  <Calendar size={16} />
                </span>
                <span className={styles.actionText}>Запланувати заняття</span>
              </button>

              <TransitionLink href="/payments?newPayment=1" className={styles.actionButton}>
                <span className={styles.actionIcon}>
                  <CreditCard size={16} />
                </span>
                <span className={styles.actionText}>Внести оплату</span>
              </TransitionLink>
            </div>
          </div>
        </section>

        <section className={styles.statsGrid}>
          {statCards.map((card) => {
            const Icon = card.icon;
            const value =
              card.key === 'monthlyRevenue' ? formatCurrency(initialData.stats.monthlyRevenue) : initialData.stats[card.key];

            const hint =
              card.key === 'todayLessons'
                ? `${completedLessons} із ${initialData.stats.todayLessons} завершено`
                : card.key === 'monthlyRevenue'
                  ? 'Надходження за поточний місяць'
                  : card.key === 'activeGroups'
                    ? 'Групи, що зараз працюють'
                    : 'Поточна активна база школи';

            return (
              <article key={card.key} className={styles.statCard}>
                <div className={styles.statTop}>
                  <span className={styles.statLabel}>{card.label}</span>
                  <span className={styles.statIcon}>
                    <Icon size={18} />
                  </span>
                </div>
                <div className={styles.statValue}>{value}</div>
                <div className={styles.statHint}>{hint}</div>
              </article>
            );
          })}
        </section>

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
              <BookOpen size={24} />
              <div className={styles.emptyTitle}>На сьогодні занять немає</div>
              <div className={styles.emptyText}>
                Можна зосередитися на платежах, групах або плануванні наступних уроків.
              </div>
            </div>
          ) : (
            <div className={styles.timeline}>
              {initialData.todaySchedule.slice(0, 10).map((lesson) => (
                <div key={lesson.id} className={styles.timelineItem}>
                  <div className={styles.timelineTime}>
                    <div>{formatTime(lesson.start_datetime)}</div>
                    <div>{formatTime(lesson.end_datetime)}</div>
                  </div>

                  <div className={styles.timelineBody}>
                    <div className={styles.timelineTop}>
                      <div className={styles.timelineTitle}>{lesson.group_title}</div>
                      <span className={`${styles.statusBadge} ${getStatusClass(lesson.status)}`}>
                        {getStatusLabel(lesson.status)}
                      </span>
                    </div>

                    <div className={styles.timelineMeta}>
                      <span>{lesson.course_title}</span>
                      <span>Викладач: {lesson.teacher_name}</span>
                      {lesson.topic ? <span>Тема: {lesson.topic}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

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
                        {payment.student_public_id} · {formatDate(payment.paid_at)}
                      </div>
                    </div>
                    <div className={styles.activityAmount}>{formatCurrency(payment.amount)}</div>
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
                      {formatDate(history.created_at)} · {history.user_name}
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

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onSuccess={() => {
          setShowCreateGroupModal(false);
          refreshDashboard();
        }}
      />

      <CreateLessonModal
        isOpen={showCreateLessonModal}
        onClose={() => setShowCreateLessonModal(false)}
        onSuccess={() => {
          setShowCreateLessonModal(false);
          refreshDashboard();
        }}
        initialDate={new Date().toISOString().split('T')[0]}
      />
    </>
  );
}
