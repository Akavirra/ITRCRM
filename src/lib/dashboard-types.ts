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
    unpaidStudents: number;
    attendancePercent: number | null;
    prevMonthRevenue: number;
    prevMonthRevenueLabel: string;
  };
  nextLesson: {
    id: number;
    start_datetime: string;
    startTimeLabel: string;
    group_title: string;
    course_title: string;
    teacher_name: string;
    group_id: number | null;
  } | null;
  todaySchedule: Array<{
    id: number;
    start_datetime: string;
    end_datetime: string;
    startTimeLabel: string;
    endTimeLabel: string;
    status: string;
    topic?: string;
    group_id: number | null;
    group_title: string;
    course_title: string;
    teacher_name: string;
    is_makeup: boolean;
    is_trial: boolean;
    original_date: string | null;
    is_replaced: boolean;
  }>;
  upcomingBirthdays: Array<{
    id: number;
    full_name: string;
    birth_date: string;
    public_id: string;
  }>;
  groupCapacity: Array<{
    id: number;
    title: string;
    capacity: number | null;
    student_count: number;
    course_title: string;
  }>;
  problemStudents: Array<{
    id: number;
    full_name: string;
    public_id: string;
    absences_this_month: number;
    has_debt: boolean;
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
