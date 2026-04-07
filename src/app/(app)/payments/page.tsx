'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, useUser } from '@/components/UserContext';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useStudentModals } from '@/components/StudentModalsContext';
import PageLoading from '@/components/PageLoading';

interface GroupOption {
  id: number;
  title: string;
}

interface StudentDebt {
  id: number;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  group_id: number;
  group_title: string;
  lessons_count: number;
  lesson_price: number;
  discount_percent: number;
  expected_amount: number;
  paid_amount: number;
  debt: number;
}

interface IndividualBalance {
  lessons_paid: number;
  lessons_used: number;
  lessons_remaining: number;
}

interface IndividualDebtor {
  id: number;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  balance: IndividualBalance;
}

interface OverviewData {
  month: string;
  lesson_price: number;
  group_debts: {
    total_debt: number;
    students_count: number;
    debtors: StudentDebt[];
  };
  individual_debtors: IndividualDebtor[];
  collected: {
    total_amount: number;
    cash_amount: number;
    account_amount: number;
    payments_count: number;
  };
}

// Student search result
interface StudentSearchResult {
  id: number;
  full_name: string;
  public_id?: string;
}

// Student payment info from API
interface StudentPaymentInfo {
  student: { id: number; full_name: string; discount_percent: number };
  lesson_price: number;
  effective_price: number;
  groups: Array<{ group_id: number; group_title: string }>;
  has_individual: boolean;
  individual_balance: IndividualBalance | null;
}

// Payment line — one row in the payment console
interface PaymentLine {
  id: string; // unique key for React
  target_type: 'group' | 'individual';
  group_id: number | null;
  group_title: string;
  pay_mode: 'months' | 'lessons'; // pay by month(s) or by lesson count
  months: string[]; // selected months (YYYY-MM-01 format)
  lessons_count: number;
  amount: string; // manual override or auto-calculated
  auto_amount: number; // system-calculated amount
}

interface PaymentHistoryRecord {
  id: number;
  type: 'group' | 'individual';
  student_id: number;
  student_name: string;
  group_id: number | null;
  group_title: string | null;
  month: string | null;
  lessons_count: number | null;
  amount: number;
  method: string;
  paid_at: string;
  note: string | null;
  created_by_name: string;
  created_at: string;
}

const MONTH_NAMES = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
];

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  // Show 6 months back and 1 month forward
  for (let i = -6; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const { openGroupModal } = useGroupModals();
  const { openStudentModal } = useStudentModals();

  const { user } = useUser();
  const [data, setData] = useState<OverviewData | null>(null);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  // Filters — initialize with empty string to avoid hydration mismatch (server UTC vs client timezone)
  const [month, setMonth] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'group' | 'individual'>('group');

  // Payment console modal
  const [showPaymentConsole, setShowPaymentConsole] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentPaymentInfo | null>(null);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'account'>('cash');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchCacheRef = useRef<Map<string, StudentSearchResult[]>>(new Map());
  // lesson counts per group per month: { "groupId:YYYY-MM": count }
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});
  const [consoleTab, setConsoleTab] = useState<'group' | 'individual'>('group');
  const [groupPayMonth, setGroupPayMonth] = useState('');
  const [groupPayAmount, setGroupPayAmount] = useState('');
  // Student selection mode: search by name or browse by group
  const [studentSelectMode, setStudentSelectMode] = useState<'search' | 'group'>('group');
  const [browseGroupId, setBrowseGroupId] = useState<number | null>(null);
  const [browseGroupStudents, setBrowseGroupStudents] = useState<Array<{ id: number; full_name: string }>>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const browseAbortRef = useRef<AbortController | null>(null);
  const browseGroupCacheRef = useRef<Map<number, Array<{ id: number; full_name: string }>>>(new Map());

  // Payment history
  const [historyPayments, setHistoryPayments] = useState<PaymentHistoryRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyMethodFilter, setHistoryMethodFilter] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistoryRecord | null>(null);

  const [monthOptions, setMonthOptions] = useState<{ value: string; label: string }[]>([]);
  const bootstrappedMonthRef = useRef<string | null>(null);
  const bootstrapInFlightRef = useRef(false);
  const skipInitialHistoryFetchRef = useRef(false);

  // Initialize date-dependent state on client only to avoid hydration mismatch
  useEffect(() => {
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7) + '-01';
    setMonth(currentMonth);
    setPaymentDate(now.toISOString().split('T')[0]);
    setMonthOptions(getMonthOptions());
  }, []);

  const HISTORY_LIMIT = 30;

  const fetchBootstrap = useCallback(async (targetMonth: string) => {
    try {
      const params = new URLSearchParams({
        month: targetMonth,
        historyLimit: String(HISTORY_LIMIT),
      });
      const res = await fetch(`/api/payments/bootstrap?${params}`);
      if (!res.ok) return false;

      const json = await res.json();
      setData(json.overview);
      setGroups(json.groups || []);
      setHistoryPayments(json.history?.payments || []);
      setHistoryTotal(json.history?.total || 0);
      setHistoryPage(0);
      bootstrappedMonthRef.current = targetMonth;
      skipInitialHistoryFetchRef.current = true;
      return true;
    } catch (error) {
      console.error('Failed to fetch payments bootstrap:', error);
      return false;
    }
  }, []);

  const fetchHistory = useCallback(async (page = 0) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (historySearch) params.set('search', historySearch);
      if (historyMethodFilter) params.set('method', historyMethodFilter);
      if (historyTypeFilter) params.set('type', historyTypeFilter);
      params.set('limit', String(HISTORY_LIMIT));
      params.set('offset', String(page * HISTORY_LIMIT));
      const res = await fetch(`/api/payments/history?${params}`);
      if (res.ok) {
        const json = await res.json();
        setHistoryPayments(json.payments);
        setHistoryTotal(json.total);
        setHistoryPage(page);
      }
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  }, [historySearch, historyMethodFilter, historyTypeFilter]);

  const fetchData = useCallback(async () => {
    if (!month) return;
    try {
      const res = await fetch(`/api/payments/overview?month=${month}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Failed to fetch payments overview:', error);
    }
  }, [month]);

  useEffect(() => {
    if (user && month && !bootstrappedMonthRef.current && !bootstrapInFlightRef.current) {
      bootstrapInFlightRef.current = true;
      void fetchBootstrap(month)
        .then((ok) => {
          if (!ok) {
            fetchData();
            fetchHistory(0);
          }
        })
        .finally(() => {
          bootstrapInFlightRef.current = false;
        });
    }
  }, [user, month, fetchBootstrap, fetchData, fetchHistory]);

  useEffect(() => {
    if (user && month && bootstrappedMonthRef.current !== month && !bootstrapInFlightRef.current) {
      fetchData();
    }
  }, [user, month, fetchData]);

  useEffect(() => {
    if (user) {
      if (bootstrapInFlightRef.current && !historySearch && !historyMethodFilter && !historyTypeFilter) {
        return;
      }
      if (skipInitialHistoryFetchRef.current && !historySearch && !historyMethodFilter && !historyTypeFilter) {
        skipInitialHistoryFetchRef.current = false;
        return;
      }
      fetchHistory(0);
    }
  }, [user, fetchHistory, historySearch, historyMethodFilter, historyTypeFilter]);

  // Filter group debtors
  const filteredGroupDebtors = (data?.group_debts.debtors || []).filter(d => {
    if (groupFilter && d.group_id !== parseInt(groupFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.full_name.toLowerCase().includes(q) && !d.group_title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Filter individual debtors
  const filteredIndividualDebtors = (data?.individual_debtors || []).filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.full_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Search students for payment console
  const searchStudents = useCallback(async (query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) {
      searchAbortRef.current?.abort();
      setStudentResults([]);
      return;
    }

    const cached = searchCacheRef.current.get(normalizedQuery);
    if (cached) {
      setStudentResults(cached);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        search: query.trim(),
        limit: '8',
        autocomplete: 'true',
      });
      const res = await fetch(`/api/students?${params}`, { signal: controller.signal });
      if (res.ok) {
        const json = await res.json();
        const results = (json.students || []).map((s: { id: number; full_name: string; public_id?: string }) => ({
          id: s.id,
          full_name: s.full_name,
          public_id: s.public_id,
        }));
        searchCacheRef.current.set(normalizedQuery, results);
        setStudentResults(results);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        /* ignore */
      }
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
      }
      setSearchLoading(false);
    }
  }, []);

  const handleStudentSearchChange = (value: string) => {
    setStudentSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchStudents(value), 180);
  };

  // Fetch students for a group (browse mode)
  const fetchGroupStudents = useCallback(async (groupId: number) => {
    const cached = browseGroupCacheRef.current.get(groupId);
    if (cached) {
      setBrowseGroupStudents(cached);
      return;
    }

    browseAbortRef.current?.abort();
    const controller = new AbortController();
    browseAbortRef.current = controller;

    setBrowseLoading(true);
    setBrowseGroupStudents([]);
    try {
      const res = await fetch(`/api/groups/${groupId}/students?basic=true`, { signal: controller.signal });
      if (res.ok) {
        const json = await res.json();
        const students = (json.students || []).map((s: { id: number; full_name: string }) => ({
          id: s.id,
          full_name: s.full_name,
        }));
        students.sort((a: { full_name: string }, b: { full_name: string }) => a.full_name.localeCompare(b.full_name, 'uk'));
        browseGroupCacheRef.current.set(groupId, students);
        setBrowseGroupStudents(students);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        /* ignore */
      }
    } finally {
      if (browseAbortRef.current === controller) {
        browseAbortRef.current = null;
      }
      setBrowseLoading(false);
    }
  }, []);

  const handleBrowseGroupChange = (groupId: number) => {
    setBrowseGroupId(groupId);
    if (groupId) {
      fetchGroupStudents(groupId);
    } else {
      setBrowseGroupStudents([]);
    }
  };

  // Fetch lesson counts for all groups for a given month in one request
  const fetchAllGroupLessonCounts = useCallback(async (groups: Array<{ group_id: number; group_title: string }>, payMonth: string) => {
    if (groups.length === 0 || !payMonth) return;

    const monthKey = payMonth.substring(0, 7);
    const groupIds = groups.map((group) => group.group_id).join(',');

    try {
      const res = await fetch(`/api/groups/lesson-counts?groupIds=${groupIds}&months=${monthKey}`);
      if (!res.ok) return;

      const json = await res.json();
      setLessonCounts((prev) => ({
        ...prev,
        ...(json.counts || {}),
      }));
    } catch {
      /* ignore */
    }
  }, []);

  // Select student → load their payment info
  const selectStudent = async (studentId: number) => {
    setStudentResults([]);
    setSearchLoading(true);
    setLessonCounts({});
    setGroupPayAmount('');
    try {
      const res = await fetch(`/api/students/${studentId}/payment-info`);
      if (res.ok) {
        const info: StudentPaymentInfo = await res.json();
        setSelectedStudent(info);
        setStudentSearch(info.student.full_name);
        // Auto-add individual line if student has individual lessons
        const lines: PaymentLine[] = [];
        if (info.has_individual) {
          lines.push({
            id: 'individual-0',
            target_type: 'individual',
            group_id: null,
            group_title: 'Індивідуальні',
            pay_mode: 'lessons',
            months: [],
            lessons_count: 1,
            amount: '',
            auto_amount: info.effective_price,
          });
        }
        setPaymentLines(lines);
        // Fetch lesson counts for all groups for the pay month
        fetchAllGroupLessonCounts(info.groups, groupPayMonth || month);
      }
    } catch { /* ignore */ } finally {
      setSearchLoading(false);
    }
  };

  // Group breakdown for the simplified payment mode
  const getGroupBreakdown = () => {
    if (!selectedStudent) return [];
    const payMonthKey = (groupPayMonth || month).substring(0, 7);
    return selectedStudent.groups.map(g => {
      const key = `${g.group_id}:${payMonthKey}`;
      const lessons = lessonCounts[key] ?? null; // null = still loading
      const expected = lessons !== null ? lessons * selectedStudent.effective_price : null;
      return { group_id: g.group_id, group_title: g.group_title, lessons, expected };
    });
  };

  const groupBreakdown = selectedStudent ? getGroupBreakdown() : [];
  const allGroupsLoaded = groupBreakdown.every(g => g.lessons !== null);
  const totalExpected = allGroupsLoaded ? groupBreakdown.reduce((s, g) => s + (g.expected || 0), 0) : 0;

  // Handle month change in console
  const handleGroupPayMonthChange = (newMonth: string) => {
    setGroupPayMonth(newMonth);
    setGroupPayAmount('');
    if (selectedStudent) {
      fetchAllGroupLessonCounts(selectedStudent.groups, newMonth);
    }
  };

  // Open console fresh
  const openPaymentConsole = useCallback(() => {
    setStudentSearch('');
    setStudentResults([]);
    setSelectedStudent(null);
    setPaymentLines([]);
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote('');
    setSaveError('');
    setConsoleTab('group');
    setGroupPayMonth(month);
    setGroupPayAmount('');
    setStudentSelectMode('group');
    setBrowseGroupId(null);
    setBrowseGroupStudents([]);
    setShowPaymentConsole(true);
  }, [month]);

  useEffect(() => {
    if (searchParams.get('newPayment') === '1' && !showPaymentConsole) {
      openPaymentConsole();
    }
  }, [openPaymentConsole, searchParams, showPaymentConsole]);

  // Open console pre-filled for a group debtor
  const openPaymentForDebtor = (debtor: StudentDebt) => {
    openPaymentConsole();
    // Pre-select this student
    setTimeout(() => selectStudent(debtor.id), 0);
  };

  // Open console pre-filled for individual debtor
  const openPaymentForIndividual = (debtor: IndividualDebtor) => {
    openPaymentConsole();
    setTimeout(() => selectStudent(debtor.id), 0);
  };

  // Update a payment line
  const updateLine = (lineId: string, updates: Partial<PaymentLine>) => {
    setPaymentLines(prev => prev.map(l => l.id === lineId ? { ...l, ...updates } : l));
  };



  // Get total save amount (group + individual)
  const getSaveTotal = (): number => {
    let total = 0;
    // Group amount
    const groupAmt = parseFloat(groupPayAmount);
    if (!isNaN(groupAmt) && groupAmt > 0) total += groupAmt;
    // Individual lines
    for (const line of paymentLines.filter(l => l.target_type === 'individual')) {
      const amt = line.amount ? parseFloat(line.amount) : line.lessons_count * (selectedStudent?.effective_price || 0);
      if (!isNaN(amt) && amt > 0) total += amt;
    }
    return total;
  };

  // Save all payments
  const handleSavePayments = async () => {
    if (!selectedStudent) return;

    const groupAmt = parseFloat(groupPayAmount);
    const hasGroupPayment = !isNaN(groupAmt) && groupAmt > 0 && allGroupsLoaded && totalExpected > 0;
    const individualLines = paymentLines.filter(l => l.target_type === 'individual');
    const hasIndividual = individualLines.some(l => {
      const amt = l.amount ? parseFloat(l.amount) : l.lessons_count * selectedStudent.effective_price;
      return !isNaN(amt) && amt > 0;
    });

    if (!hasGroupPayment && !hasIndividual) {
      setSaveError('Вкажіть суму для оплати');
      return;
    }

    for (const line of individualLines) {
      if (line.lessons_count <= 0) {
        setSaveError('Вкажіть кількість занять для індивідуальних');
        return;
      }
    }

    setSaving(true);
    setSaveError('');

    try {
      // Save group payments — distribute proportionally
      if (hasGroupPayment) {
        const groupsWithLessons = groupBreakdown.filter(g => (g.expected || 0) > 0);
        let remaining = groupAmt;
        for (let i = 0; i < groupsWithLessons.length; i++) {
          const g = groupsWithLessons[i];
          // Last group gets remainder to avoid rounding issues
          const share = i < groupsWithLessons.length - 1
            ? Math.round(groupAmt * ((g.expected || 0) / totalExpected))
            : remaining;
          remaining -= share;
          if (share <= 0) continue;

          const res = await fetch(`/api/groups/${g.group_id}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student_id: selectedStudent.student.id,
              month: groupPayMonth || month,
              amount: share,
              method: paymentMethod,
              note: paymentNote || undefined,
              paid_at: paymentDate ? new Date(paymentDate).toISOString() : undefined,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            setSaveError(err.error || 'Помилка збереження групової оплати');
            setSaving(false);
            return;
          }
        }
      }

      // Save individual payments
      for (const line of individualLines) {
        const amt = line.amount ? parseFloat(line.amount) : line.lessons_count * selectedStudent.effective_price;
        if (isNaN(amt) || amt <= 0) continue;
        const res = await fetch(`/api/students/${selectedStudent.student.id}/individual-payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lessons_count: line.lessons_count,
            amount: amt,
            method: paymentMethod,
            note: paymentNote || undefined,
            paid_at: paymentDate ? new Date(paymentDate).toISOString() : undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          setSaveError(err.error || 'Помилка збереження індивідуальної оплати');
          setSaving(false);
          return;
        }
      }

      setShowPaymentConsole(false);
      fetchData();
      fetchHistory(0);
    } catch {
      setSaveError('Помилка мережі');
    } finally {
      setSaving(false);
    }
  };


  if (!user) return null;

  const currentMonthLabel = monthOptions.find(o => o.value === month)?.label || month;

  return (
    <>
      {/* Stats cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {/* Total debt */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Загальний борг</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
                  {data?.group_debts.total_debt || 0} ₴
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Debtors count */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#fef3c7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="23" y1="13" x2="17" y2="13" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Боржників</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                  {data?.group_debts.students_count || 0}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Collected this month */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#dcfce7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Зібрано</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#22c55e' }}>
                  {data?.collected.total_amount || 0} ₴
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lesson price */}
        <div className="card">
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '0.5rem',
                backgroundColor: '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 3H8l-2 4h12l-2-4z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Ціна/заняття</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                  {data?.lesson_price || 300} ₴
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          {/* + Payment button */}
          <button
            className="btn btn-primary"
            onClick={openPaymentConsole}
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '600' }}
          >
            + Внести оплату
          </button>

          {/* Month picker — only for group tab */}
          {tab === 'group' && (
            <select
              className="form-input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ width: '180px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
            >
              {monthOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <input
            type="text"
            className="form-input"
            placeholder={tab === 'group' ? 'Пошук учня або групи...' : 'Пошук учня...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          />

          {/* Group filter — only for group tab */}
          {tab === 'group' && (
            <select
              className="form-input"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              style={{ width: '180px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
            >
              <option value="">Усі групи</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          )}

          {/* Tabs */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
            <button
              onClick={() => setTab('group')}
              style={{
                padding: '0.5rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: tab === 'group' ? '600' : '400',
                borderRadius: '0.375rem',
                border: tab === 'group' ? '1px solid #374151' : '1px solid #e5e7eb',
                backgroundColor: tab === 'group' ? '#374151' : 'white',
                color: tab === 'group' ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Групові
            </button>
            <button
              onClick={() => setTab('individual')}
              style={{
                padding: '0.5rem 0.875rem',
                fontSize: '0.875rem',
                fontWeight: tab === 'individual' ? '600' : '400',
                borderRadius: '0.375rem',
                border: tab === 'individual' ? '1px solid #374151' : '1px solid #e5e7eb',
                backgroundColor: tab === 'individual' ? '#374151' : 'white',
                color: tab === 'individual' ? 'white' : '#374151',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Індивідуальні
            </button>
          </div>
        </div>
      </div>

      {/* Separator */}
      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />

      {/* Group debts table */}
      {tab === 'group' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Групові заняття — {currentMonthLabel}
            </h3>
            <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
              {filteredGroupDebtors.length} учнів
            </div>
          </div>
          <div className="table-container">
            {filteredGroupDebtors.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Учень</th>
                    <th>Група</th>
                    <th style={{ textAlign: 'center' }}>Занять</th>
                    <th style={{ textAlign: 'right' }}>Ціна/зан</th>
                    <th style={{ textAlign: 'center' }}>Знижка</th>
                    <th style={{ textAlign: 'right' }}>До сплати</th>
                    <th style={{ textAlign: 'right' }}>Оплачено</th>
                    <th style={{ textAlign: 'right' }}>Борг</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroupDebtors.map((d, idx) => (
                    <tr key={`${d.id}-${d.group_id}-${idx}`}>
                      <td>
                        <button
                          onClick={() => openStudentModal(d.id, d.full_name)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem',
                            textDecoration: 'underline', textAlign: 'left',
                          }}
                        >
                          {d.full_name}
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => openGroupModal(d.group_id, d.group_title)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem',
                            textDecoration: 'underline', textAlign: 'left',
                          }}
                        >
                          {d.group_title}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}>{d.lessons_count}</td>
                      <td style={{ textAlign: 'right' }}>{d.lesson_price} ₴</td>
                      <td style={{ textAlign: 'center' }}>
                        {d.discount_percent > 0 ? (
                          <span className="badge badge-info">{d.discount_percent}%</span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>{d.expected_amount} ₴</td>
                      <td style={{ textAlign: 'right' }}>
                        {d.paid_amount > 0 ? (
                          <span style={{ color: '#22c55e', fontWeight: '500' }}>{d.paid_amount} ₴</span>
                        ) : '0 ₴'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: '600',
                          color: d.debt > 0 ? '#ef4444' : '#22c55e',
                        }}>
                          {d.debt > 0 ? `${d.debt} ₴` : 'Оплачено'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {d.debt > 0 && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => openPaymentForDebtor(d)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            + Оплата
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                {data ? 'Немає боргів за цей місяць' : 'Завантаження...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Individual debtors */}
      {tab === 'individual' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Індивідуальні заняття — баланс занять
            </h3>
            <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
              {filteredIndividualDebtors.length} учнів
            </div>
          </div>
          <div className="table-container">
            {filteredIndividualDebtors.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Учень</th>
                    <th style={{ textAlign: 'right' }}>Оплачено занять</th>
                    <th style={{ textAlign: 'right' }}>Використано</th>
                    <th style={{ textAlign: 'right' }}>Залишок</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIndividualDebtors.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button
                          onClick={() => openStudentModal(d.id, d.full_name)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem',
                            textDecoration: 'underline', textAlign: 'left',
                          }}
                        >
                          {d.full_name}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>{d.balance.lessons_paid}</td>
                      <td style={{ textAlign: 'right' }}>{d.balance.lessons_used}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: '600',
                          color: d.balance.lessons_remaining < 0 ? '#ef4444' : '#22c55e',
                        }}>
                          {d.balance.lessons_remaining}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openPaymentForIndividual(d)}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          + Оплата
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                {data ? 'Немає учнів з від\'ємним балансом' : 'Завантаження...'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Separator */}
      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />

      {/* Payment collected breakdown */}
      {data && data.collected.payments_count > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Зібрано за {currentMonthLabel}
            </h3>
          </div>
          <div className="card-body" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Загалом</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.total_amount} ₴</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Готівка</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.cash_amount} ₴</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Безготівково</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.account_amount} ₴</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Кількість оплат</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{data.collected.payments_count}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment History - Collapsible */}
      <details style={{ marginTop: '1.5rem' }} open>
        <summary style={{
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: '600',
          color: '#374151',
          marginBottom: '1rem',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
            <polyline points="6,9 12,15 18,9" />
          </svg>
          Історія оплат
        </summary>
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Пошук за ім'ям..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ width: '180px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem', marginLeft: '0.5rem' }}
            />
            <select
              className="form-input"
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              style={{ width: '140px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            >
              <option value="">Усі типи</option>
              <option value="group">Групові</option>
              <option value="individual">Індивідуальні</option>
            </select>
            <select
              className="form-input"
              value={historyMethodFilter}
              onChange={(e) => setHistoryMethodFilter(e.target.value)}
              style={{ width: '150px', padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
            >
              <option value="">Усі способи</option>
              <option value="cash">Готівка</option>
              <option value="account">Безготівково</option>
            </select>
            <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: '#6b7280' }}>
              {historyTotal} записів
            </span>
          </div>
          <div className="table-container">
            {historyLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Завантаження...</div>
            ) : historyPayments.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Учень</th>
                    <th>Тип</th>
                    <th>Група / Деталі</th>
                    <th style={{ textAlign: 'right' }}>Сума</th>
                    <th>Спосіб</th>
                    <th style={{ textAlign: 'center', width: '60px' }}>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPayments.map(p => (
                    <tr key={`${p.type}-${p.id}`}>
                      <td style={{ fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                        {new Date(p.paid_at).toLocaleDateString('uk-UA')}
                      </td>
                      <td>
                        <button
                          onClick={() => openStudentModal(p.student_id, p.student_name)}
                          style={{ background: 'none', border: 'none', padding: 0, color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', textAlign: 'left' }}
                        >
                          {p.student_name}
                        </button>
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: '0.6875rem', fontWeight: 600,
                          backgroundColor: p.type === 'group' ? '#dbeafe' : '#f3e8ff',
                          color: p.type === 'group' ? '#1d4ed8' : '#7c3aed',
                        }}>
                          {p.type === 'group' ? 'Групова' : 'Індивід.'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8125rem' }}>
                        {p.type === 'group' && p.group_title ? (
                          <>
                            <button
                              onClick={() => p.group_id && openGroupModal(p.group_id, p.group_title!)}
                              style={{ background: 'none', border: 'none', padding: 0, color: '#3b82f6', cursor: 'pointer', fontSize: '0.8125rem', textDecoration: 'underline', textAlign: 'left' }}
                            >
                              {p.group_title}
                            </button>
                            {p.month && <span style={{ color: '#9ca3af', marginLeft: '0.375rem' }}>({p.month.substring(0, 7)})</span>}
                          </>
                        ) : (
                          <span style={{ color: '#6b7280' }}>{p.lessons_count} зан.</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600', fontSize: '0.875rem' }}>
                        {p.amount} ₴
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem',
                          backgroundColor: p.method === 'cash' ? '#dcfce7' : '#e0f2fe',
                          color: p.method === 'cash' ? '#16a34a' : '#0284c7',
                        }}>
                          {p.method === 'cash' ? 'Готівка' : 'Безгот.'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedPayment(p)}
                          style={{
                            background: 'none', border: '1px solid #e5e7eb', borderRadius: '0.25rem',
                            padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: '#6b7280',
                          }}
                          title="Деталі"
                        >
                          👁
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                Немає записів
              </div>
            )}
          </div>
          {/* Pagination */}
          {historyTotal > HISTORY_LIMIT && (
            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid #e5e7eb' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchHistory(historyPage - 1)}
                disabled={historyPage === 0}
                style={{ fontSize: '0.8125rem' }}
              >
                ← Назад
              </button>
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                {historyPage * HISTORY_LIMIT + 1}–{Math.min((historyPage + 1) * HISTORY_LIMIT, historyTotal)} з {historyTotal}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => fetchHistory(historyPage + 1)}
                disabled={(historyPage + 1) * HISTORY_LIMIT >= historyTotal}
                style={{ fontSize: '0.8125rem' }}
              >
                Далі →
              </button>
            </div>
          )}
        </div>
      </details>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
        onClick={() => setSelectedPayment(null)}
        >
          <div
            style={{
              backgroundColor: 'white', borderRadius: '0.75rem',
              padding: '1.5rem', width: '100%', maxWidth: '440px',
              boxShadow: '0 20px 60px -15px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                Деталі оплати
              </h3>
              <button
                onClick={() => setSelectedPayment(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#9ca3af', padding: 0 }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', alignItems: 'start', fontSize: '0.875rem' }}>
                <span style={{ color: '#6b7280' }}>Тип:</span>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, width: 'fit-content',
                  backgroundColor: selectedPayment.type === 'group' ? '#dbeafe' : '#f3e8ff',
                  color: selectedPayment.type === 'group' ? '#1d4ed8' : '#7c3aed',
                }}>
                  {selectedPayment.type === 'group' ? 'Групова' : 'Індивідуальна'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                <span style={{ color: '#6b7280' }}>Учень:</span>
                <button
                  onClick={() => { setSelectedPayment(null); openStudentModal(selectedPayment.student_id, selectedPayment.student_name); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', fontSize: '0.875rem' }}
                >
                  {selectedPayment.student_name}
                </button>
              </div>
              {selectedPayment.type === 'group' && selectedPayment.group_title && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Група:</span>
                  <button
                    onClick={() => { setSelectedPayment(null); selectedPayment.group_id && openGroupModal(selectedPayment.group_id, selectedPayment.group_title!); }}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline', textAlign: 'left', fontSize: '0.875rem' }}
                  >
                    {selectedPayment.group_title}
                  </button>
                </div>
              )}
              {selectedPayment.type === 'group' && selectedPayment.month && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Місяць:</span>
                  <span>{selectedPayment.month.substring(0, 7)}</span>
                </div>
              )}
              {selectedPayment.type === 'individual' && selectedPayment.lessons_count && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Занять:</span>
                  <span>{selectedPayment.lessons_count}</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                <span style={{ color: '#6b7280' }}>Сума:</span>
                <strong style={{ color: '#16a34a', fontSize: '1rem' }}>{selectedPayment.amount} ₴</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                <span style={{ color: '#6b7280' }}>Спосіб:</span>
                <span style={{
                  display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', width: 'fit-content',
                  backgroundColor: selectedPayment.method === 'cash' ? '#dcfce7' : '#e0f2fe',
                  color: selectedPayment.method === 'cash' ? '#16a34a' : '#0284c7',
                }}>
                  {selectedPayment.method === 'cash' ? 'Готівка' : 'Безготівково'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                <span style={{ color: '#6b7280' }}>Дата оплати:</span>
                <span>{new Date(selectedPayment.paid_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                <span style={{ color: '#6b7280' }}>Створив:</span>
                <span>{selectedPayment.created_by_name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                <span style={{ color: '#6b7280' }}>Створено:</span>
                <span>{new Date(selectedPayment.created_at).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              {selectedPayment.note && (
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Примітка:</span>
                  <span style={{ color: '#374151' }}>{selectedPayment.note}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedPayment(null)}
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Console Modal */}
      {showPaymentConsole && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
        onClick={() => setShowPaymentConsole(false)}
        >
          <div
            style={{
              backgroundColor: 'white', borderRadius: '0.75rem',
              padding: '1.5rem', width: '100%', maxWidth: '640px',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px -15px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: '600' }}>
              Консоль оплат
            </h3>

            {/* Step 1: Student selection */}
            {!selectedStudent && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#374151', fontWeight: '500' }}>
                    Учень
                  </label>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => { setStudentSelectMode('group'); setStudentSearch(''); setStudentResults([]); }}
                      style={{
                        padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem',
                        border: studentSelectMode === 'group' ? '1px solid #374151' : '1px solid #d1d5db',
                        backgroundColor: studentSelectMode === 'group' ? '#374151' : 'white',
                        color: studentSelectMode === 'group' ? 'white' : '#6b7280',
                        cursor: 'pointer',
                      }}
                    >
                      З групи
                    </button>
                    <button
                      onClick={() => { setStudentSelectMode('search'); setBrowseGroupId(null); setBrowseGroupStudents([]); }}
                      style={{
                        padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem',
                        border: studentSelectMode === 'search' ? '1px solid #374151' : '1px solid #d1d5db',
                        backgroundColor: studentSelectMode === 'search' ? '#374151' : 'white',
                        color: studentSelectMode === 'search' ? 'white' : '#6b7280',
                        cursor: 'pointer',
                      }}
                    >
                      Пошук
                    </button>
                  </div>
                </div>

                {/* Mode: Browse by group */}
                {studentSelectMode === 'group' && (
                  <div>
                    <select
                      className="form-input"
                      value={browseGroupId || ''}
                      onChange={(e) => handleBrowseGroupChange(parseInt(e.target.value) || 0)}
                      style={{ width: '100%', marginBottom: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="">Оберіть групу...</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.title}</option>
                      ))}
                    </select>
                    {browseLoading && (
                      <div style={{ textAlign: 'center', padding: '0.75rem', color: '#9ca3af', fontSize: '0.8125rem' }}>
                        Завантаження...
                      </div>
                    )}
                    {browseGroupId && !browseLoading && browseGroupStudents.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '0.75rem', color: '#9ca3af', fontSize: '0.8125rem' }}>
                        Немає учнів у групі
                      </div>
                    )}
                    {browseGroupStudents.length > 0 && (
                      <div style={{
                        border: '1px solid #e5e7eb', borderRadius: '0.375rem',
                        maxHeight: '220px', overflowY: 'auto',
                      }}>
                        {browseGroupStudents.map((s, idx) => (
                          <button
                            key={s.id}
                            onClick={() => selectStudent(s.id)}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '0.5rem 0.75rem', border: 'none', background: 'none',
                              cursor: 'pointer', fontSize: '0.875rem',
                              borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined,
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            {s.full_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Mode: Search by name */}
                {studentSelectMode === 'search' && (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={studentSearch}
                      onChange={(e) => {
                        handleStudentSearchChange(e.target.value);
                      }}
                      placeholder="Пошук за ім'ям..."
                      style={{ width: '100%' }}
                      autoFocus
                    />
                    {searchLoading && (
                      <div style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.75rem', color: '#9ca3af' }}>
                        ...
                      </div>
                    )}
                    {studentResults.length > 0 && (
                      <div style={{
                        position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 10,
                        backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '0.375rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto',
                      }}>
                        {studentResults.map(s => (
                          <button
                            key={s.id}
                            onClick={() => selectStudent(s.id)}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '0.5rem 0.75rem', border: 'none', background: 'none',
                              cursor: 'pointer', fontSize: '0.875rem',
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            {s.full_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selected student name with clear button */}
            {selectedStudent && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
                  Учень
                </label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: '0.375rem', fontSize: '0.875rem',
                }}>
                  <span style={{ flex: 1, fontWeight: '500' }}>{selectedStudent.student.full_name}</span>
                  <button
                    onClick={() => {
                      setSelectedStudent(null);
                      setPaymentLines([]);
                      setStudentSearch('');
                      setStudentResults([]);
                      setGroupPayAmount('');
                    }}
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: '#9ca3af', fontSize: '1.125rem', lineHeight: 1, padding: '0 0.25rem',
                    }}
                    title="Змінити учня"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Student info + payment lines */}
            {selectedStudent && (
              <>
                {/* Student info bar */}
                <div style={{
                  padding: '0.75rem 1rem', marginBottom: '1rem',
                  backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb',
                  display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem',
                }}>
                  <div>
                    <span style={{ color: '#6b7280' }}>Ціна/заняття: </span>
                    <strong>{selectedStudent.lesson_price} ₴</strong>
                  </div>
                  {selectedStudent.student.discount_percent > 0 && (
                    <>
                      <div>
                        <span style={{ color: '#6b7280' }}>Знижка: </span>
                        <strong style={{ color: '#f59e0b' }}>{selectedStudent.student.discount_percent}%</strong>
                      </div>
                      <div>
                        <span style={{ color: '#6b7280' }}>Зі знижкою: </span>
                        <strong style={{ color: '#22c55e' }}>{selectedStudent.effective_price} ₴</strong>
                      </div>
                    </>
                  )}
                  {selectedStudent.individual_balance && (
                    <div>
                      <span style={{ color: '#6b7280' }}>Інд. баланс: </span>
                      <strong style={{ color: selectedStudent.individual_balance.lessons_remaining < 0 ? '#ef4444' : '#22c55e' }}>
                        {selectedStudent.individual_balance.lessons_remaining} зан.
                      </strong>
                    </div>
                  )}
                </div>

                {/* Tabs: Group / Individual */}
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
                  <button
                    onClick={() => setConsoleTab('group')}
                    style={{
                      padding: '0.375rem 0.75rem', fontSize: '0.8125rem', borderRadius: '0.25rem',
                      border: consoleTab === 'group' ? '1px solid #374151' : '1px solid #d1d5db',
                      backgroundColor: consoleTab === 'group' ? '#374151' : 'white',
                      color: consoleTab === 'group' ? 'white' : '#6b7280',
                      cursor: 'pointer', fontWeight: consoleTab === 'group' ? '600' : '400',
                    }}
                  >
                    Групові
                  </button>
                  {selectedStudent.has_individual && (
                    <button
                      onClick={() => setConsoleTab('individual')}
                      style={{
                        padding: '0.375rem 0.75rem', fontSize: '0.8125rem', borderRadius: '0.25rem',
                        border: consoleTab === 'individual' ? '1px solid #374151' : '1px solid #d1d5db',
                        backgroundColor: consoleTab === 'individual' ? '#374151' : 'white',
                        color: consoleTab === 'individual' ? 'white' : '#6b7280',
                        cursor: 'pointer', fontWeight: consoleTab === 'individual' ? '600' : '400',
                      }}
                    >
                      Індивідуальні
                    </button>
                  )}
                </div>

                {/* GROUP TAB — simplified: month → breakdown → amount */}
                {consoleTab === 'group' && selectedStudent.groups.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    {/* Month selector */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Місяць оплати
                      </label>
                      <select
                        className="form-input"
                        value={groupPayMonth}
                        onChange={(e) => handleGroupPayMonthChange(e.target.value)}
                        style={{ width: '200px', fontSize: '0.875rem' }}
                      >
                        {monthOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Auto breakdown table */}
                    <div style={{
                      border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '0.75rem',
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f9fafb' }}>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: '500', color: '#6b7280' }}>Група</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: '500', color: '#6b7280', width: '70px' }}>Занять</th>
                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '500', color: '#6b7280', width: '100px' }}>До сплати</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupBreakdown.map((g, idx) => (
                            <tr key={g.group_id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : undefined }}>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{g.group_title}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                                {g.lessons === null ? <span style={{ color: '#f59e0b' }}>...</span> : g.lessons}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '500' }}>
                                {g.expected === null ? '...' : `${g.expected} ₴`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {allGroupsLoaded && (
                          <tfoot>
                            <tr style={{ borderTop: '1px solid #e5e7eb', backgroundColor: '#f0fdf4' }}>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>Разом</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center', fontWeight: '600' }}>
                                {groupBreakdown.reduce((s, g) => s + (g.lessons || 0), 0)}
                              </td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '600', color: '#16a34a' }}>
                                {totalExpected} ₴
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Distribution preview if amount differs */}
                    {(() => {
                      const enteredAmt = parseFloat(groupPayAmount);
                      if (!allGroupsLoaded || isNaN(enteredAmt) || enteredAmt <= 0 || enteredAmt === totalExpected || totalExpected === 0) return null;
                      const groupsWithLessons = groupBreakdown.filter(g => (g.expected || 0) > 0);
                      let remaining = enteredAmt;
                      const dist = groupsWithLessons.map((g, i) => {
                        const share = i < groupsWithLessons.length - 1
                          ? Math.round(enteredAmt * ((g.expected || 0) / totalExpected))
                          : remaining;
                        remaining -= share;
                        return { title: g.group_title, share };
                      });
                      return (
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: '#fffbeb', borderRadius: '0.375rem', border: '1px solid #fde68a' }}>
                          <div style={{ fontWeight: '500', marginBottom: '0.25rem', color: '#92400e' }}>
                            Розподіл {enteredAmt} ₴ по групах:
                          </div>
                          {dist.map(d => (
                            <div key={d.title}>{d.title}: <strong>{d.share} ₴</strong></div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Amount field */}
                    <div>
                      <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
                        Сума оплати (₴)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={groupPayAmount}
                        onChange={(e) => setGroupPayAmount(e.target.value)}
                        placeholder={allGroupsLoaded ? String(totalExpected) : '...'}
                        style={{ width: '160px', fontSize: '0.875rem' }}
                      />
                      {allGroupsLoaded && totalExpected > 0 && !groupPayAmount && (
                        <button
                          onClick={() => setGroupPayAmount(String(totalExpected))}
                          style={{
                            marginLeft: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                            border: '1px solid #d1d5db', borderRadius: '0.25rem',
                            backgroundColor: 'white', cursor: 'pointer', color: '#374151',
                          }}
                        >
                          Вставити {totalExpected} ₴
                        </button>
                      )}
                      {(() => {
                        const amt = parseFloat(groupPayAmount);
                        if (!allGroupsLoaded || isNaN(amt) || amt <= 0 || totalExpected <= 0) return null;
                        const diff = amt - totalExpected;
                        if (diff > 0) {
                          return (
                            <div style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: '#b45309', backgroundColor: '#fffbeb', padding: '0.375rem 0.625rem', borderRadius: '0.25rem', border: '1px solid #fde68a' }}>
                              Сума на <strong>{diff} ₴</strong> більша за очікувану ({totalExpected} ₴). Переплата буде зарахована.
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}

                {consoleTab === 'group' && selectedStudent.groups.length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    Учень не входить в жодну групу
                  </div>
                )}

                {/* INDIVIDUAL TAB */}
                {consoleTab === 'individual' && (
                  <div style={{ marginBottom: '1rem' }}>
                    {paymentLines.filter(l => l.target_type === 'individual').map((line) => (
                      <div key={line.id} style={{
                        padding: '0.75rem', marginBottom: '0.5rem',
                        border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                        backgroundColor: '#fafafa',
                      }}>
                        <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>
                          Індивідуальні заняття
                        </strong>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.125rem' }}>
                            Кількість занять
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            value={line.lessons_count}
                            onChange={(e) => updateLine(line.id, { lessons_count: parseInt(e.target.value) || 0 })}
                            min="1"
                            style={{ width: '100px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          />
                          {line.lessons_count > 0 && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                              = {line.lessons_count * selectedStudent.effective_price} ₴
                            </span>
                          )}
                        </div>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.125rem' }}>
                            Сума (₴)
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            value={line.amount}
                            onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                            placeholder={String(line.lessons_count * selectedStudent.effective_price)}
                            style={{ width: '140px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>
                    ))}
                    {selectedStudent.has_individual && !paymentLines.some(l => l.target_type === 'individual') && (
                      <button
                        onClick={() => setPaymentLines(prev => [...prev, {
                          id: `individual-${Date.now()}`,
                          target_type: 'individual',
                          group_id: null,
                          group_title: 'Індивідуальні',
                          pay_mode: 'lessons',
                          months: [],
                          lessons_count: 1,
                          amount: '',
                          auto_amount: selectedStudent.effective_price,
                        }])}
                        style={{
                          padding: '0.375rem 0.75rem', fontSize: '0.8125rem',
                          border: '1px dashed #d1d5db', borderRadius: '0.25rem',
                          backgroundColor: 'white', cursor: 'pointer', color: '#6b7280',
                        }}
                      >
                        + Додати індивідуальну оплату
                      </button>
                    )}
                    {!selectedStudent.has_individual && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                        Учень не має індивідуальних занять
                      </div>
                    )}
                  </div>
                )}

                {/* Common fields: method, date, note */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                      Спосіб оплати
                    </label>
                    <select
                      className="form-input"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'account')}
                      style={{ width: '100%' }}
                    >
                      <option value="cash">Готівка</option>
                      <option value="account">Безготівково</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                      Дата оплати
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                    Примітка
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Необов'язково"
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Total */}
                {getSaveTotal() > 0 && (
                  <div style={{
                    padding: '0.75rem 1rem', marginBottom: '1rem',
                    backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Загальна сума:</span>
                    <strong style={{ fontSize: '1.25rem', color: '#16a34a' }}>
                      {getSaveTotal()} ₴
                    </strong>
                  </div>
                )}
              </>
            )}

            {saveError && (
              <div style={{
                padding: '0.5rem 0.75rem', marginBottom: '0.75rem',
                backgroundColor: '#fee2e2', color: '#dc2626',
                borderRadius: '0.375rem', fontSize: '0.875rem',
              }}>
                {saveError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowPaymentConsole(false)}
                disabled={saving}
              >
                Скасувати
              </button>
              {selectedStudent && getSaveTotal() > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleSavePayments}
                  disabled={saving}
                >
                  {saving ? 'Збереження...' : `Зберегти (${getSaveTotal()} ₴)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
