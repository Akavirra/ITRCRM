export interface DashboardStatsPayload {
  generatedAtLabel: string;
  todayDate: string;
  greeting: string;
  stats: {
    activeStudents: number;
    activeGroups: number;
    todayLessons: number;
    monthlyRevenue: number;
    monthlyRevenueLabel: string;
  };
  todaySchedule: Array<{
    id: number;
    start_datetime: string;
    end_datetime: string;
    startTimeLabel: string;
    endTimeLabel: string;
    status: string;
    groupId: number | null;
    groupTitle: string;
    courseId: number | null;
    courseTitle: string;
    teacherId: number | null;
    teacherName: string;
    isMakeup?: boolean | null;
    isTrial?: boolean | null;
    isReplaced?: boolean;
    originalDate?: string | null;
    isRescheduled?: boolean;
    topic?: string;
  }>;
  upcomingBirthdays: Array<{
    id: number;
    full_name: string;
    birth_date: string;
    public_id: string;
  }>;
  recentPayments: Array<{
    amount: number;
    amountLabel: string;
    paid_at: string;
    paidAtLabel: string;
    student_name: string;
    student_public_id: string;
  }>;
  recentHistory: Array<{
    action_type: string;
    action_description: string;
    created_at: string;
    createdAtLabel: string;
    user_name: string;
    student_name: string;
    student_public_id: string;
  }>;
}
