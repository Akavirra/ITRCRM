'use client';

import { useEffect, useState } from 'react';
import { useTelegramInitData, useTelegramWebApp } from '@/components/TelegramWebAppProvider';
import { BookOpenIcon, ClipboardIcon, UsersIcon, ChevronDownIcon, AlertTriangleIcon } from '@/components/Icons';

interface Student {
  id: number;
  full_name: string;
  birth_date: string | null;
  join_date: string;
  is_active: boolean;
}

interface Group {
  id: number;
  public_id: string;
  group_title: string;
  weekly_day: number;
  day_name: string;
  day_short: string;
  start_time: string;
  duration_minutes: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  note: string | null;
  course_id: number;
  course_title: string;
  course_description: string | null;
  student_count: number;
  students: Student[];
}

interface GroupsData {
  teacher: {
    id: number;
    name: string;
    telegram_id: string;
    role: string;
    phone: string | null;
    email: string | null;
    created_at: string;
  };
  groups: Group[];
  stats: {
    total_groups: number;
    total_students: number;
    total_lessons: number;
  };
}

export default function TeacherGroupsPage() {
  const { initData, isLoading: initLoading, error: initError } = useTelegramInitData();
  const { isInWebView } = useTelegramWebApp();
  
  const [data, setData] = useState<GroupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Authenticate and fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      if (initLoading) return;
      
      if (!initData) {
        setError('Telegram WebApp не ініціалізовано');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/teacher-app/groups', {
          headers: { 'X-Telegram-Init-Data': initData }
        });

        if (!response.ok) {
          throw new Error('Не вдалося завантажити групи');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Помилка');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [initData, initLoading]);

  // Toggle group expansion
  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { class: 'tg-badge-scheduled', text: 'Активна' };
      case 'graduate':
        return { class: 'tg-badge-done', text: 'Випустились' };
      case 'inactive':
        return { class: 'tg-badge-canceled', text: 'Неактивна' };
      default:
        return { class: 'tg-badge-scheduled', text: status };
    }
  };

  if (loading) {
    return (
      <div className="tg-loading">
        <div className="tg-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div className="tg-error">
          <p className="tg-error-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangleIcon size={18} /> Помилка</p>
          <p className="tg-error-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="tg-header">
        <h1 className="tg-header-title">Мої групи</h1>
        <p className="tg-header-subtitle">
          {data?.groups.length || 0} груп • {data?.stats.total_students || 0} учнів
        </p>
      </div>

      {/* Groups List */}
      {data?.groups.length === 0 ? (
        <div className="tg-empty">
          <div className="tg-empty-icon"><ClipboardIcon size={40} /></div>
          <p>У вас поки що немає груп</p>
        </div>
      ) : (
        data?.groups.map(group => {
          const statusBadge = getStatusBadge(group.status);
          const isExpanded = expandedGroups.has(group.id);
          
          return (
            <div key={group.id} className="tg-card" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Group Header - Always Visible */}
              <div 
                onClick={() => toggleGroup(group.id)}
                style={{ 
                  padding: 'var(--space-lg)', 
                  cursor: 'pointer',
                  background: isExpanded ? 'var(--tg-primary-bg)' : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ 
                        background: 'var(--tg-primary-bg)', 
                        color: 'var(--tg-link-color)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        {group.day_short} {group.start_time}
                      </span>
                      <span className={`tg-badge ${statusBadge.class}`}>
                        {statusBadge.text}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--tg-text-color)' }}>
                      {group.group_title}
                    </h3>
                  </div>
                  <div style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                    color: 'var(--tg-text-secondary)'
                  }}>
                    <ChevronDownIcon size={20} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--tg-text-secondary)', fontSize: '13px' }}>
                    <BookOpenIcon size={14} />
                    <span>{group.course_title}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--tg-text-secondary)', fontSize: '13px' }}>
                    <UsersIcon size={14} />
                    <span>{group.student_count} учнів</span>
                  </div>
                </div>
              </div>

              {/* Students List - Collapsible */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--tg-border)' }}>
                  <div style={{ padding: 'var(--space-md) var(--space-lg)', background: 'var(--tg-bg-color)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--tg-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Список учнів ({group.students.length})
                    </h4>
                    
                    {group.students.length === 0 ? (
                      <p style={{ color: 'var(--tg-hint-color)', fontSize: '13px', margin: 0 }}>Немає учнів у групі</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.students.map(student => {
                          // Calculate age from birth_date
                          const getAge = (birthDate: string | null): string => {
                            if (!birthDate) return 'вік не вказано';
                            const today = new Date();
                            const birth = new Date(birthDate);
                            let age = today.getFullYear() - birth.getFullYear();
                            const monthDiff = today.getMonth() - birth.getMonth();
                            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
                              age--;
                            }
                            return `${age} років`;
                          };
                          
                          return (
                          <div 
                            key={student.id}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '12px',
                              padding: '10px 12px',
                              background: 'var(--tg-surface)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--tg-border)'
                            }}
                          >
                            <div className="tg-avatar" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                              {student.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 500, fontSize: '14px', color: 'var(--tg-text-color)' }}>
                                {student.full_name}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--tg-text-secondary)' }}>
                                {getAge(student.birth_date)}
                              </div>
                            </div>
                          </div>
                        );})}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
