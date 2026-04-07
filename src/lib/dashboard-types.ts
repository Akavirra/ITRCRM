export interface DashboardStatsPayload {
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
