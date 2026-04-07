import DashboardPageClient from '@/components/DashboardPageClient';
import { getDashboardStatsPayload } from '@/lib/dashboard';
import styles from './dashboard.module.css';

export default async function DashboardPage() {
  try {
    const data = await getDashboardStatsPayload();
    return <DashboardPageClient initialData={data} />;
  } catch (error) {
    console.error('Dashboard page load error:', error);
    return (
      <div className={styles.page}>
        <section className={styles.errorCard}>
          <div className={styles.errorLabel}>Дашборд недоступний</div>
          <h1 className={styles.errorTitle}>Не вдалося завантажити дані</h1>
          <p className={styles.errorText}>Спробуйте оновити сторінку ще раз.</p>
        </section>
      </div>
    );
  }
}
