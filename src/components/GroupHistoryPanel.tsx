'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatShortDateKyiv, formatTimeKyiv } from '@/lib/date-utils';

interface GroupHistoryEntry {
  id: number;
  group_id: number;
  action_type: string;
  action_description: string;
  old_value: string | null;
  new_value: string | null;
  user_id: number;
  user_name: string;
  created_at: string;
}

interface GroupHistoryPanelProps {
  groupId: string;
}

export default function GroupHistoryPanel({ groupId }: GroupHistoryPanelProps) {
  const [recentHistory, setRecentHistory] = useState<GroupHistoryEntry[]>([]);
  const [allHistory, setAllHistory] = useState<GroupHistoryEntry[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async (isInitial = false) => {
    try {
        // Fetch recent history (4 items)
        const recentRes = await fetch(`/api/groups/${groupId}/history?recent=true&limit=4`);
        const recentData = await recentRes.json();
        setRecentHistory(recentData.history || []);

        // Fetch all history
        const allRes = await fetch(`/api/groups/${groupId}/history`);
        const allData = await allRes.json();
        setAllHistory(allData.history || []);
      } catch (error) {
        console.error('Failed to fetch group history:', error);
      } finally {
        // Only set loading to false on initial fetch
        if (isInitial) {
          setLoading(false);
        }
      }
    }, [groupId]);

    useEffect(() => {
      if (groupId) {
        // Initial fetch with loading indicator
        fetchHistory(true);
        
        // Polling for automatic updates every 10 seconds
        const intervalId = setInterval(() => fetchHistory(false), 10000);
        
        // Cleanup interval on unmount
        return () => clearInterval(intervalId);
      }
    }, [groupId, fetchHistory]);

  const formatDate = (dateStr: string) => {
    return formatShortDateKyiv(dateStr);
  };

  const formatTime = (dateStr: string) => {
    return formatTimeKyiv(dateStr);
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'created':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green-600)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        );
      case 'student_added':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green-600)" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="17" y1="11" x2="23" y2="11" />
          </svg>
        );
      case 'student_removed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red-600)" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="18" y1="8" x2="23" y2="13" />
            <line x1="23" y1="8" x2="18" y2="13" />
          </svg>
        );
      case 'teacher_changed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case 'lesson_conducted':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green-600)" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01" />
            <path d="M12 14h.01" />
            <path d="M16 14h.01" />
            <path d="M8 18h.01" />
            <path d="M12 18h.01" />
          </svg>
        );
      case 'edited':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        );
      case 'status_changed':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange-600)" strokeWidth="2">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const getDisplayHistory = () => {
    return showAll ? allHistory : recentHistory;
  };

  const hasHistory = allHistory.length > 0;

  if (loading) {
    return (
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
          Завантаження історії...
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--gray-200)'
      }}>
        <h3 style={{ 
          fontSize: '1rem', 
          fontWeight: '600', 
          margin: 0, 
          color: 'var(--gray-900)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Історія змін
        </h3>
        
        {allHistory.length > 4 && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: '500',
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--gray-100)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {showAll ? 'Сховати' : `Показати всі (${allHistory.length})`}
          </button>
        )}
      </div>

      {/* History List */}
      {!hasHistory ? (
        <div style={{ 
          color: 'var(--gray-500)', 
          fontSize: '0.875rem',
          textAlign: 'center',
          padding: '1rem'
        }}>
          Історія змін порожня
        </div>
      ) : (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: showAll ? '0.75rem' : '0.5rem',
          maxHeight: showAll ? '400px' : 'none',
          overflowY: showAll ? 'auto' : 'visible'
        }}>
          {getDisplayHistory().map((entry, index) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                gap: '0.75rem',
                padding: showAll ? '0.75rem' : '0.5rem',
                backgroundColor: showAll ? 'var(--gray-50)' : 'transparent',
                borderRadius: showAll ? '0.375rem' : '0',
                borderLeft: showAll ? '3px solid var(--gray-200)' : 'none',
              }}
            >
              {/* Icon */}
              <div style={{ flexShrink: 0, marginTop: '0.125rem' }}>
                {getActionIcon(entry.action_type)}
              </div>
              
              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: showAll ? '0.875rem' : '0.8125rem', 
                  color: 'var(--gray-900)',
                  lineHeight: '1.4',
                  wordBreak: 'break-word'
                }}>
                  {entry.action_description}
                </div>
                
                {/* Meta info */}
                <div style={{ 
                  display: 'flex', 
                  gap: '0.75rem', 
                  marginTop: '0.25rem',
                  fontSize: '0.75rem',
                  color: 'var(--gray-500)'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {entry.user_name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatDate(entry.created_at)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    {formatTime(entry.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
