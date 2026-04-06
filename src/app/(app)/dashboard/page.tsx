'use client';

import { useState, useEffect } from 'react';
import { Users, Users2, Calendar, DollarSign, Plus, UserPlus, CreditCard, BookOpen } from 'lucide-react';

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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'payments' | 'history'>('payments');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('uk-UA');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Завантаження...</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Помилка</h3>
        </div>
        <div className="card-body">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="btn btn-primary mt-4"
          >
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with greeting and quick actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Доброго дня!
          </h1>
          <p className="text-gray-600 mt-1">
            Огляд роботи школи на {new Date().toLocaleDateString('uk-UA')}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-outline">
            <Plus className="w-4 h-4" />
            Створити урок
          </button>
          <button className="btn btn-outline">
            <UserPlus className="w-4 h-4" />
            Додати студента
          </button>
          <button className="btn btn-outline">
            <CreditCard className="w-4 h-4" />
            Новий платіж
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Активні студенти</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.activeStudents}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Активні групи</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.activeGroups}</p>
              </div>
              <Users2 className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Уроків сьогодні</p>
                <p className="text-2xl font-bold text-gray-900">{data.stats.todayLessons}</p>
              </div>
              <Calendar className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Дохід за місяць</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(data.stats.monthlyRevenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Розклад на сьогодні</h3>
            </div>
            <div className="card-body">
              {data.todaySchedule.length === 0 ? (
                <div className="empty-state">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Немає уроків на сьогодні</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.todaySchedule.slice(0, 15).map((lesson) => (
                    <div key={lesson.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDateTime(lesson.start_datetime)} - {formatDateTime(lesson.end_datetime)}
                          </div>
                          <div className={`badge ${
                            lesson.status === 'completed' ? 'badge-success' :
                            lesson.status === 'cancelled' ? 'badge-danger' :
                            'badge-info'
                          }`}>
                            {lesson.status === 'completed' ? 'Завершений' :
                             lesson.status === 'cancelled' ? 'Скасовано' :
                             'Запланований'}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {lesson.group_title} • {lesson.course_title}
                          {lesson.topic && ` • ${lesson.topic}`}
                        </div>
                        <div className="text-sm text-gray-500">
                          Викладач: {lesson.teacher_name}
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.todaySchedule.length > 15 && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      І ще {data.todaySchedule.length - 15} уроків...
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Недавня активність</h3>
            </div>
            <div className="card-body">
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'payments' ? 'active' : ''}`}
                  onClick={() => setActiveTab('payments')}
                >
                  Платежі
                </button>
                <button
                  className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  Історія
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {activeTab === 'payments' ? (
                  <>
                    {data.recentPayments.slice(0, 8).map((payment, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.student_name}</p>
                          <p className="text-xs text-gray-500">{formatDate(payment.paid_at)}</p>
                        </div>
                        <p className="text-sm font-medium text-green-600">
                          +{formatCurrency(payment.amount)}
                        </p>
                      </div>
                    ))}
                    {data.recentPayments.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">Немає недавніх платежів</p>
                    )}
                  </>
                ) : (
                  <>
                    {data.recentHistory.slice(0, 8).map((history, index) => (
                      <div key={index} className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{history.student_name}</p>
                          <p className="text-xs text-gray-500">{formatDate(history.created_at)}</p>
                          <p className="text-xs text-gray-600 mt-1">{history.action_description}</p>
                        </div>
                        <div className={`badge ${
                          history.action_type === 'created' ? 'badge-success' :
                          history.action_type === 'updated' ? 'badge-info' :
                          history.action_type === 'deleted' ? 'badge-danger' :
                          'badge-gray'
                        }`}>
                          {history.action_type === 'created' ? 'Створено' :
                           history.action_type === 'updated' ? 'Оновлено' :
                           history.action_type === 'deleted' ? 'Видалено' :
                           'Змінено'}
                        </div>
                      </div>
                    ))}
                    {data.recentHistory.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">Немає недавньої історії</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
