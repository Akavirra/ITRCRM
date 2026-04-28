export interface DashboardHistoryEntry {
  entity_type: string;
  entity_id: number | null;
  entity_public_id: string | null;
  entity_title: string;
  student_id?: number | null;
  student_title?: string | null;
  group_id?: number | null;
  group_title?: string | null;
  course_id?: number | null;
  course_title?: string | null;
  event_type: string;
  event_badge: string;
  description: string;
  created_at: string;
  createdAtLabel: string;
  user_name: string;
}

export interface DashboardHistoryPagePayload {
  items: DashboardHistoryEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DashboardStatsPayload {
  generatedAtLabel: string;
  todayDate: string;
  greeting: string;
  stats: {
    activeStudents: number;
    activeGroups: number;
    activeCourses: number;
    todayLessons: number;
    monthlyRevenue: number;
    monthlyRevenueLabel: string;
    unpaidStudents: number;
    attendancePercent: number | null;
    prevMonthRevenue: number;
    prevMonthRevenueLabel: string;
    allTimeRevenue: number;
    allTimeRevenueLabel: string;
    allTimeUnpaidStudents: number;
    allTimeAttendancePercent: number | null;
    todayStudents: number;
    monthStudents: number;
    yearStudents: number;
    allTimeStudents: number;
    revenueTrend: number[];
    attendanceTrend: number[];
    debtTrend: number[];
    studentsTrend: number[];
    studentsTrendMonth: number[];
    studentsTrendYear: number[];
    revenueTrendAllTime: number[];
    attendanceTrendAllTime: number[];
    debtTrendAllTime: number[];
    studentsTrendAllTime: number[];
  };
  nextLesson: {
    id: number;
    start_datetime: string;
    end_datetime: string;
    startTimeLabel: string;
    endTimeLabel: string;
    group_title: string;
    course_title: string;
    teacher_name: string;
    group_id: number | null;
    is_makeup: boolean;
    is_trial: boolean;
    state: 'live' | 'upcoming';
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
  debtorsList: Array<{
    id: number;
    full_name: string;
    public_id: string;
    parent_name: string | null;
    parent_phone: string | null;
    group_title: string;
    debt: number;
    debtLabel: string;
    expected_amount: number;
    paid_amount: number;
    lessons_count: number;
    discount_percent: number;
  }>;
  absencesList: Array<{
    id: number;
    student_id: number;
    lesson_id: number;
    full_name: string;
    public_id: string;
    lesson_date: string;
    lessonDateLabel: string;
    group_title: string;
    course_title: string;
    start_time: string;
  }>;
  recentPayments: Array<{
    amount: number;
    amountLabel: string;
    paid_at: string;
    paidAtLabel: string;
    student_name: string;
    student_public_id: string;
  }>;
  recentHistory: DashboardHistoryEntry[];
}
