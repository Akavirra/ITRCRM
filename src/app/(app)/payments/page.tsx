'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useGroupModals } from '@/components/GroupModalsContext';
import { useStudentModals } from '@/components/StudentModalsContext';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

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
  const router = useRouter();
  const { openGroupModal } = useGroupModals();
  const { openStudentModal } = useStudentModals();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewData | null>(null);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  // Filters
  const currentMonth = new Date().toISOString().substring(0, 7) + '-01';
  const [month, setMonth] = useState(currentMonth);
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
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNote, setPaymentNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // lesson counts per group per month: { "groupId:YYYY-MM": count }
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});

  const monthOptions = getMonthOptions();

  const fetchData = useCallback(async () => {
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
    const init = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        const [groupsRes] = await Promise.all([
          fetch('/api/groups'),
        ]);
        const groupsData = await groupsRes.json();
        setGroups((groupsData.groups || []).map((g: { id: number; title: string }) => ({
          id: g.id,
          title: g.title,
        })));
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

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
    if (query.length < 2) {
      setStudentResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const json = await res.json();
        setStudentResults((json.students || []).map((s: { id: number; full_name: string }) => ({
          id: s.id,
          full_name: s.full_name,
        })));
      }
    } catch { /* ignore */ } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleStudentSearchChange = (value: string) => {
    setStudentSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchStudents(value), 300);
  };

  // Fetch lesson counts for a group and set of months
  const fetchLessonCounts = useCallback(async (groupId: number, months: string[]) => {
    if (months.length === 0) return;
    const monthKeys = months.map(m => m.substring(0, 7)); // YYYY-MM
    try {
      const res = await fetch(`/api/groups/${groupId}/lessons-count?months=${monthKeys.join(',')}`);
      if (res.ok) {
        const json = await res.json();
        setLessonCounts(prev => {
          const next = { ...prev };
          for (const [m, cnt] of Object.entries(json.counts as Record<string, number>)) {
            next[`${groupId}:${m}`] = cnt;
          }
          return next;
        });
      }
    } catch { /* ignore */ }
  }, []);

  // Select student → load their payment info
  const selectStudent = async (studentId: number) => {
    setStudentResults([]);
    setSearchLoading(true);
    setLessonCounts({});
    try {
      const res = await fetch(`/api/students/${studentId}/payment-info`);
      if (res.ok) {
        const info: StudentPaymentInfo = await res.json();
        setSelectedStudent(info);
        setStudentSearch(info.student.full_name);
        // Auto-add payment lines for each group
        const lines: PaymentLine[] = info.groups.map((g, i) => ({
          id: `group-${g.group_id}-${i}`,
          target_type: 'group' as const,
          group_id: g.group_id,
          group_title: g.group_title,
          pay_mode: 'months' as const,
          months: [month],
          lessons_count: 1,
          amount: '',
          auto_amount: 0,
        }));
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
        // Fetch lesson counts for all groups for the current month
        for (const g of info.groups) {
          fetchLessonCounts(g.group_id, [month]);
        }
      }
    } catch { /* ignore */ } finally {
      setSearchLoading(false);
    }
  };

  // Open console fresh
  const openPaymentConsole = () => {
    setStudentSearch('');
    setStudentResults([]);
    setSelectedStudent(null);
    setPaymentLines([]);
    setPaymentMethod('cash');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNote('');
    setSaveError('');
    setShowPaymentConsole(true);
  };

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

  // Toggle month in a line
  const toggleMonth = (lineId: string, monthVal: string) => {
    setPaymentLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const months = l.months.includes(monthVal)
        ? l.months.filter(m => m !== monthVal)
        : [...l.months, monthVal].sort();
      // Fetch lesson count if adding a new month for a group
      if (!l.months.includes(monthVal) && l.group_id) {
        const key = `${l.group_id}:${monthVal.substring(0, 7)}`;
        if (!(key in lessonCounts)) {
          fetchLessonCounts(l.group_id, [monthVal]);
        }
      }
      return { ...l, months };
    }));
  };

  // Remove a payment line
  const removeLine = (lineId: string) => {
    setPaymentLines(prev => prev.filter(l => l.id !== lineId));
  };

  // Get total lesson count for a group line across selected months
  const getLineLessonsCount = (line: PaymentLine): number => {
    if (!line.group_id || line.months.length === 0) return 0;
    let total = 0;
    for (const m of line.months) {
      const key = `${line.group_id}:${m.substring(0, 7)}`;
      total += lessonCounts[key] || 0;
    }
    return total;
  };

  // Calculate line amount
  const getLineAmount = (line: PaymentLine): number => {
    if (line.amount) {
      const parsed = parseFloat(line.amount);
      if (!isNaN(parsed)) return parsed;
    }
    if (!selectedStudent) return 0;
    const price = selectedStudent.effective_price;
    if (line.target_type === 'individual') {
      return line.lessons_count * price;
    }
    if (line.pay_mode === 'months') {
      // Auto-calculate: lessons in selected months × effective price
      const totalLessons = getLineLessonsCount(line);
      return totalLessons * price;
    }
    return line.lessons_count * price;
  };

  // Total amount across all lines
  const getTotalAmount = (): number => {
    return paymentLines.reduce((sum, line) => {
      const amt = line.amount ? parseFloat(line.amount) : getLineAmount(line);
      return sum + (isNaN(amt) ? 0 : amt);
    }, 0);
  };

  // Save all payment lines
  const handleSavePayments = async () => {
    if (!selectedStudent || paymentLines.length === 0) return;

    // Validate: each active line must have an amount
    for (const line of paymentLines) {
      const amt = line.amount ? parseFloat(line.amount) : getLineAmount(line);
      if (isNaN(amt) || amt <= 0) {
        setSaveError(`Вкажіть суму для "${line.group_title}"`);
        return;
      }
      if (line.target_type === 'group' && line.pay_mode === 'months' && line.months.length === 0) {
        setSaveError(`Оберіть місяць для "${line.group_title}"`);
        return;
      }
      if (line.pay_mode === 'lessons' && line.lessons_count <= 0) {
        setSaveError(`Вкажіть кількість занять для "${line.group_title}"`);
        return;
      }
    }

    setSaving(true);
    setSaveError('');

    try {
      for (const line of paymentLines) {
        const amt = line.amount ? parseFloat(line.amount) : getLineAmount(line);

        if (line.target_type === 'group' && line.group_id) {
          if (line.pay_mode === 'months') {
            // Create one payment per month
            const perMonthAmount = Math.round(amt / line.months.length);
            for (const m of line.months) {
              const res = await fetch(`/api/groups/${line.group_id}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  student_id: selectedStudent.student.id,
                  month: m,
                  amount: perMonthAmount,
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
          } else {
            // Pay by lessons count for group — save as current month payment
            const res = await fetch(`/api/groups/${line.group_id}/payments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                student_id: selectedStudent.student.id,
                month: month,
                amount: amt,
                method: paymentMethod,
                note: paymentNote ? `${paymentNote} (${line.lessons_count} зан.)` : `${line.lessons_count} зан.`,
                paid_at: paymentDate ? new Date(paymentDate).toISOString() : undefined,
              }),
            });
            if (!res.ok) {
              const err = await res.json();
              setSaveError(err.error || 'Помилка збереження');
              setSaving(false);
              return;
            }
          }
        } else if (line.target_type === 'individual') {
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
      }

      setShowPaymentConsole(false);
      fetchData();
    } catch {
      setSaveError('Помилка мережі');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
        <PageLoading />
      </Layout>
    );
  }

  if (!user) return null;

  const currentMonthLabel = monthOptions.find(o => o.value === month)?.label || month;

  return (
    <Layout user={user}>
      {/* Stats cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
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

          {/* Month picker */}
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

          {/* Search */}
          <input
            type="text"
            className="form-input"
            placeholder="Пошук учня або групи..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '220px', padding: '0.5rem 0.875rem', fontSize: '0.875rem' }}
          />

          {/* Group filter */}
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

      {/* Group debts table */}
      {tab === 'group' && (
        <div className="card">
          <div className="card-header">
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
              Борги за групові заняття — {currentMonthLabel}
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
              Індивідуальні заняття — баланс
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

            {/* Step 1: Student search */}
            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ fontSize: '0.875rem', color: '#374151', display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
                Учень
              </label>
              <input
                type="text"
                className="form-input"
                value={studentSearch}
                onChange={(e) => {
                  handleStudentSearchChange(e.target.value);
                  if (selectedStudent) {
                    setSelectedStudent(null);
                    setPaymentLines([]);
                  }
                }}
                placeholder="Пошук за ім'ям..."
                style={{ width: '100%' }}
                autoFocus
              />
              {searchLoading && !selectedStudent && (
                <div style={{ position: 'absolute', right: '12px', top: '32px', fontSize: '0.75rem', color: '#9ca3af' }}>
                  ...
                </div>
              )}
              {/* Dropdown results */}
              {studentResults.length > 0 && !selectedStudent && (
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

                {/* Payment lines */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: '#374151' }}>
                    Позиції оплати
                  </div>

                  {paymentLines.map((line) => (
                    <div key={line.id} style={{
                      padding: '0.75rem', marginBottom: '0.5rem',
                      border: '1px solid #e5e7eb', borderRadius: '0.5rem',
                      backgroundColor: '#fafafa',
                    }}>
                      {/* Line header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <strong style={{ fontSize: '0.875rem', flex: 1 }}>
                          {line.target_type === 'group' ? line.group_title : 'Індивідуальні заняття'}
                        </strong>
                        <button
                          onClick={() => removeLine(line.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#9ca3af', fontSize: '1.125rem', padding: '0',
                          }}
                          title="Видалити"
                        >
                          &times;
                        </button>
                      </div>

                      {/* Pay mode toggle */}
                      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                        <button
                          onClick={() => updateLine(line.id, { pay_mode: 'months', lessons_count: 1 })}
                          style={{
                            padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem',
                            border: line.pay_mode === 'months' ? '1px solid #374151' : '1px solid #d1d5db',
                            backgroundColor: line.pay_mode === 'months' ? '#374151' : 'white',
                            color: line.pay_mode === 'months' ? 'white' : '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          За місяць
                        </button>
                        <button
                          onClick={() => updateLine(line.id, { pay_mode: 'lessons', months: [] })}
                          style={{
                            padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderRadius: '0.25rem',
                            border: line.pay_mode === 'lessons' ? '1px solid #374151' : '1px solid #d1d5db',
                            backgroundColor: line.pay_mode === 'lessons' ? '#374151' : 'white',
                            color: line.pay_mode === 'lessons' ? 'white' : '#374151',
                            cursor: 'pointer',
                          }}
                        >
                          За кількістю занять
                        </button>
                      </div>

                      {/* Month selection */}
                      {line.pay_mode === 'months' && (
                        <>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                            {monthOptions.map(o => (
                              <button
                                key={o.value}
                                onClick={() => toggleMonth(line.id, o.value)}
                                style={{
                                  padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderRadius: '0.25rem',
                                  border: line.months.includes(o.value) ? '1px solid #3b82f6' : '1px solid #d1d5db',
                                  backgroundColor: line.months.includes(o.value) ? '#dbeafe' : 'white',
                                  color: line.months.includes(o.value) ? '#1d4ed8' : '#6b7280',
                                  cursor: 'pointer',
                                }}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                          {/* Lesson count info for selected months */}
                          {line.group_id && line.months.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                              {(() => {
                                const allLoaded = line.months.every(m => `${line.group_id}:${m.substring(0, 7)}` in lessonCounts);
                                if (!allLoaded) {
                                  return <span style={{ color: '#f59e0b' }}>Завантаження кількості занять...</span>;
                                }
                                const totalLessons = getLineLessonsCount(line);
                                const autoAmount = totalLessons * selectedStudent.effective_price;
                                return totalLessons > 0 ? (
                                  <span>
                                    Занять: <strong style={{ color: '#374151' }}>{totalLessons}</strong>
                                    {' '}&times;{' '}{selectedStudent.effective_price} ₴
                                    {' '}={' '}<strong style={{ color: '#16a34a' }}>{autoAmount} ₴</strong>
                                  </span>
                                ) : (
                                  <span style={{ color: '#9ca3af' }}>Занять за обрані місяці: 0</span>
                                );
                              })()}
                            </div>
                          )}
                        </>
                      )}

                      {/* Lessons count */}
                      {line.pay_mode === 'lessons' && (
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
                      )}

                      {/* Amount override */}
                      <div>
                        <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.125rem' }}>
                          Сума (₴) {!line.amount ? '(авто)' : ''}
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          value={line.amount}
                          onChange={(e) => updateLine(line.id, { amount: e.target.value })}
                          placeholder={String(getLineAmount({ ...line, amount: '' }))}
                          style={{ width: '140px', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add line buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {selectedStudent.groups
                      .filter(g => !paymentLines.some(l => l.target_type === 'group' && l.group_id === g.group_id))
                      .map(g => (
                        <button
                          key={g.group_id}
                          onClick={() => setPaymentLines(prev => [...prev, {
                            id: `group-${g.group_id}-${Date.now()}`,
                            target_type: 'group',
                            group_id: g.group_id,
                            group_title: g.group_title,
                            pay_mode: 'months',
                            months: [month],
                            lessons_count: 1,
                            amount: '',
                            auto_amount: 0,
                          }])}
                          style={{
                            padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                            border: '1px dashed #d1d5db', borderRadius: '0.25rem',
                            backgroundColor: 'white', cursor: 'pointer', color: '#6b7280',
                          }}
                        >
                          + {g.group_title}
                        </button>
                      ))
                    }
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
                          padding: '0.25rem 0.5rem', fontSize: '0.75rem',
                          border: '1px dashed #d1d5db', borderRadius: '0.25rem',
                          backgroundColor: 'white', cursor: 'pointer', color: '#6b7280',
                        }}
                      >
                        + Індивідуальні
                      </button>
                    )}
                  </div>
                </div>

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
                {paymentLines.length > 0 && (
                  <div style={{
                    padding: '0.75rem 1rem', marginBottom: '1rem',
                    backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>Загальна сума:</span>
                    <strong style={{ fontSize: '1.25rem', color: '#16a34a' }}>
                      {getTotalAmount()} ₴
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
              {selectedStudent && paymentLines.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleSavePayments}
                  disabled={saving}
                >
                  {saving ? 'Збереження...' : `Зберегти (${getTotalAmount()} ₴)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
