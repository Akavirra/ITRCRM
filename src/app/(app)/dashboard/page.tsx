'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CreditCard,
  DollarSign,
  Sparkles,
  Users,
  Users2,
  UserPlus,
} from 'lucide-react';
import TransitionLink from '@/components/TransitionLink';
import styles from './dashboard.module.css';

interface DashboardStats {
  stats: {
    activeStudents: number;
    activeGroups: number;
    todayLessons: number;
    monthlyRevenue: number;
  };
  todaySchedule: Array<{
    id: number;
    start_datetime: string;
    end_datetime: string;
    status: string;
    topic?: string;
    group_title: string;
    course_title: string;
    teacher_name: string;
  }>;
  upcomingBirthdays: Array<{
    id: number;
    full_name: string;
    birth_date: string;
    public_id: string;
  }>;
  recentPayments: Array<{
    amount: number;
    paid_at: string;
    student_name: string;
    student_public_id: string;
  }>;
  recentHistory: Array<{
    action_type: string;
    action_description: string;
    created_at: string;
    user_name: string;
    student_name: string;
    student_public_id: string;
  }>;
}

type ActivityTab = 'payments' | 'history';

const quickActions = [
  {
    href: '/schedule',
    label: 'Розклад і уроки',
    description: 'Подивитися сьогоднішній день і перейти до розкладу.',
    icon: Calendar,
    tone: 'amber',
  },
  {
    href: '/students',
    label: 'Студенти',
    description: 'Швидко перейти до бази учнів та керування статусами.',
    icon: UserPlus,
    tone: 'teal',
  },
  {
    href: '/payments',
    label: 'Платежі',
    description: 'Контролювати надходження, борги та фінансовий рух.',
    icon: CreditCard,
    tone: 'blue',
  },
] as const;

const statCards = [
  {
    key: 'activeStudents',
    label: 'Активні студенти',
    icon: Users,
    accent: 'teal',
  },
  {
    key: 'activeGroups',
    label: 'Активні групи',
    icon: Users2,
    accent: 'amber',
  },
  {
    key: 'todayLessons',
    label: 'Уроків сьогодні',
    icon: BookOpen,
    accent: 'blue',
  },
  {
    key: 'monthlyRevenue',
    label: 'Дохід за місяць',
    icon: DollarSign,
    accent: 'rose',
  },
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

function getStatusTone(status: string) {
  if (status === 'completed') return styles.statusSuccess;
  if (status === 'cancelled' || status === 'canceled') return styles.statusDanger;
  return styles.statusNeutral;
}

function getActionTone(tone: string) {
  if (tone === 'teal') return styles.actionTeal;
  if (tone === 'amber') return styles.actionAmber;
  return styles.actionBlue;
}

function getStatTone(accent: string) {
  if (accent === 'teal') return styles.statTeal;
  if (accent === 'amber') return styles.statAmber;
  if (accent === 'rose') return styles.statRose;
  return styles.statBlue;
}

function getDaysUntil(dateStr: string) {
  const today = new Date();
  const birthDate = new Date(dateStr);
  const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  if (nextBirthday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((nextBirthday.getTime() - today.getTime()) / msPerDay);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActivityTab>('payments');

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/dashboard/stats', { cache: 'no-store' });
        if (!response.ok) throw new Error('Не вдалося завантажити дашборд');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Невідома помилка');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`${styles.hero} ${styles.loadingBlock}`} />
        <div className={styles.statsGrid}>
          {[...Array(4)].map((_, index) => (
            <div key={index} className={`${styles.statCard} ${styles.loadingBlock}`} />
          ))}
        </div>
        <div className={styles.contentGrid}>
          <div className={`${styles.panel} ${styles.loadingPanel}`} />
          <div className={`${styles.panel} ${styles.loadingPanel}`} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <section className={styles.errorCard}>
          <div className={styles.errorBadge}>Проблема з дашбордом</div>
          <h1 className={styles.errorTitle}>Не вдалося завантажити дані</h1>
          <p className={styles.errorText}>{error || 'Спробуйте оновити сторінку ще раз.'}</p>
          <button className={styles.retryButton} onClick={() => window.location.reload()}>
            Оновити сторінку
          </button>
        </section>
      </div>
    );
  }

  const now = new Date();
  const plannedLessons = data.todaySchedule.filter(
    (lesson) => lesson.status !== 'cancelled' && lesson.status !== 'canceled'
  ).length;
  const completedLessons = data.todaySchedule.filter((lesson) => lesson.status === 'completed').length;
  const cancelledLessons = data.todaySchedule.filter(
    (lesson) => lesson.status === 'cancelled' || lesson.status === 'canceled'
  ).length;
  const nextLesson =
    data.todaySchedule.find((lesson) => new Date(lesson.end_datetime) > now) || data.todaySchedule[0] || null;
  const revenuePerStudent =
    data.stats.activeStudents > 0 ? Math.round(data.stats.monthlyRevenue / data.stats.activeStudents) : 0;
  const visiblePayments = data.recentPayments.slice(0, 6);
  const visibleHistory = data.recentHistory.slice(0, 6);
  const visibleBirthdays = data.upcomingBirthdays.slice(0, 5);

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroBackdrop} />
        <div className={styles.heroMain}>
          <div className={styles.heroEyebrow}>
            <Sparkles size={14} />
            <span>Операційний центр школи</span>
          </div>
          <h1 className={styles.heroTitle}>{getGreeting()}!</h1>
          <p className={styles.heroText}>
            Сьогоднішній стан школи на {formatFullDate(new Date().toISOString())}. Ключові цифри,
            уроки, фінанси й останні зміни зібрані в одному чистому робочому просторі.
          </p>

          <div className={styles.quickActions}>
            {quickActions.map((action) => {
              const Icon = action.icon;

              return (
                <TransitionLink
                  key={action.href}
                  href={action.href}
                  className={`${styles.actionCard} ${getActionTone(action.tone)}`}
                >
                  <div className={styles.actionIcon}>
                    <Icon size={18} />
                  </div>
                  <div className={styles.actionContent}>
                    <div className={styles.actionLabel}>{action.label}</div>
                    <div className={styles.actionDescription}>{action.description}</div>
                  </div>
                  <ArrowRight size={18} className={styles.actionArrow} />
                </TransitionLink>
              );
            })}
          </div>
        </div>

        <aside className={styles.heroAside}>
          <div className={styles.focusCard}>
            <div className={styles.focusLabel}>Фокус дня</div>
            <div className={styles.focusValue}>
              {nextLesson ? `${formatTime(nextLesson.start_datetime)} · ${nextLesson.group_title}` : 'Без уроків'}
            </div>
            <p className={styles.focusText}>
              {nextLesson
                ? `${nextLesson.course_title} · ${nextLesson.teacher_name}`
                : 'Сьогодні в розкладі немає активних занять.'}
            </p>

            <div className={styles.focusMetrics}>
              <div>
                <span className={styles.focusMetricValue}>{plannedLessons}</span>
                <span className={styles.focusMetricLabel}>заплановано</span>
              </div>
              <div>
                <span className={styles.focusMetricValue}>{completedLessons}</span>
                <span className={styles.focusMetricLabel}>завершено</span>
              </div>
              <div>
                <span className={styles.focusMetricValue}>{cancelledLessons}</span>
                <span className={styles.focusMetricLabel}>скасовано</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className={styles.statsGrid}>
        {statCards.map((card) => {
          const Icon = card.icon;
          const value =
            card.key === 'monthlyRevenue'
              ? formatCurrency(data.stats.monthlyRevenue)
              : data.stats[card.key];

          return (
            <article key={card.key} className={`${styles.statCard} ${getStatTone(card.accent)}`}>
              <div className={styles.statTop}>
                <span className={styles.statLabel}>{card.label}</span>
                <span className={styles.statIcon}>
                  <Icon size={18} />
                </span>
              </div>
              <div className={styles.statValue}>{value}</div>
              <div className={styles.statHint}>
                {card.key === 'monthlyRevenue'
                  ? revenuePerStudent > 0
                    ? `У середньому ${formatCurrency(revenuePerStudent)} на активного студента`
                    : 'Поки що немає даних для середнього чеку'
                  : card.key === 'todayLessons'
                    ? `${completedLessons} із ${plannedLessons} вже завершено`
                    : card.key === 'activeGroups'
                      ? `${data.stats.activeStudents} студентів розподілені по групах`
                      : 'Поточна активна база школи'}
              </div>
            </article>
          );
        })}
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.primaryColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Робочий день</div>
                <h2 className={styles.panelTitle}>Розклад на сьогодні</h2>
              </div>
              <TransitionLink href="/schedule" className={styles.panelLink}>
                Повний розклад
              </TransitionLink>
            </div>

            {data.todaySchedule.length === 0 ? (
              <div className={styles.emptyState}>
                <BookOpen size={26} />
                <div className={styles.emptyTitle}>Сьогодні без уроків</div>
                <div className={styles.emptyText}>
                  Це хороший момент, щоб перевірити платежі, групи або запланувати наступний тиждень.
                </div>
              </div>
            ) : (
              <div className={styles.timeline}>
                {data.todaySchedule.slice(0, 10).map((lesson) => (
                  <div key={lesson.id} className={styles.timelineItem}>
                    <div className={styles.timelineTime}>
                      <span>{formatTime(lesson.start_datetime)}</span>
                      <span>{formatTime(lesson.end_datetime)}</span>
                    </div>
                    <div className={styles.timelineBody}>
                      <div className={styles.timelineTop}>
                        <div className={styles.timelineTitle}>{lesson.group_title}</div>
                        <span className={`${styles.statusBadge} ${getStatusTone(lesson.status)}`}>
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
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Фінанси та події</div>
                <h2 className={styles.panelTitle}>Останні зміни</h2>
              </div>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${
                    activeTab === 'payments' ? styles.segmentButtonActive : ''
                  }`}
                  onClick={() => setActiveTab('payments')}
                >
                  Платежі
                </button>
                <button
                  type="button"
                  className={`${styles.segmentButton} ${
                    activeTab === 'history' ? styles.segmentButtonActive : ''
                  }`}
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
                      <div className={styles.activityIdentity}>
                        <div className={`${styles.avatar} ${styles.avatarMoney}`}>₴</div>
                        <div>
                          <div className={styles.activityTitle}>{payment.student_name}</div>
                          <div className={styles.activityMeta}>
                            {payment.student_public_id} · {formatDate(payment.paid_at)}
                          </div>
                        </div>
                      </div>
                      <div className={styles.moneyPositive}>{formatCurrency(payment.amount)}</div>
                    </div>
                  ))
                ) : (
                  <div className={styles.compactEmpty}>Немає недавніх платежів.</div>
                )
              ) : visibleHistory.length > 0 ? (
                visibleHistory.map((history, index) => (
                  <div key={`${history.student_public_id}-${index}`} className={styles.activityItem}>
                    <div className={styles.activityIdentity}>
                      <div className={`${styles.avatar} ${styles.avatarNeutral}`}>
                        {getInitials(history.student_name)}
                      </div>
                      <div>
                        <div className={styles.activityTitle}>{history.student_name}</div>
                        <div className={styles.activityMeta}>
                          {formatDate(history.created_at)} · {history.user_name}
                        </div>
                        <div className={styles.activityDescription}>{history.action_description}</div>
                      </div>
                    </div>
                    <div className={styles.historyTag}>{history.action_type}</div>
                  </div>
                ))
              ) : (
                <div className={styles.compactEmpty}>Історія змін поки порожня.</div>
              )}
            </div>
          </article>
        </div>

        <div className={styles.secondaryColumn}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Найближчі дати</div>
                <h2 className={styles.panelTitle}>Дні народження</h2>
              </div>
              <span className={styles.mutedCounter}>{data.upcomingBirthdays.length} у списку</span>
            </div>

            {visibleBirthdays.length > 0 ? (
              <div className={styles.birthdays}>
                {visibleBirthdays.map((student) => {
                  const days = getDaysUntil(student.birth_date);

                  return (
                    <div key={student.id} className={styles.birthdayItem}>
                      <div className={`${styles.avatar} ${styles.avatarBirthday}`}>
                        {getInitials(student.full_name)}
                      </div>
                      <div className={styles.birthdayContent}>
                        <div className={styles.activityTitle}>{student.full_name}</div>
                        <div className={styles.activityMeta}>
                          {student.public_id} · {formatDate(student.birth_date)}
                        </div>
                      </div>
                      <div className={styles.birthdayBadge}>
                        {days <= 0 ? 'сьогодні' : `${days} дн.`}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={styles.compactEmpty}>Найближчими днями днів народження немає.</div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <div className={styles.panelEyebrow}>Керування</div>
                <h2 className={styles.panelTitle}>Швидкий доступ</h2>
              </div>
            </div>

            <div className={styles.shortcutList}>
              <TransitionLink href="/groups" className={styles.shortcutItem}>
                <span>Групи та наповнення</span>
                <ArrowRight size={16} />
              </TransitionLink>
              <TransitionLink href="/teachers" className={styles.shortcutItem}>
                <span>Викладачі та навантаження</span>
                <ArrowRight size={16} />
              </TransitionLink>
              <TransitionLink href="/reports" className={styles.shortcutItem}>
                <span>Звіти та аналітика</span>
                <ArrowRight size={16} />
              </TransitionLink>
              <TransitionLink href="/attendance" className={styles.shortcutItem}>
                <span>Відвідуваність</span>
                <ArrowRight size={16} />
              </TransitionLink>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
