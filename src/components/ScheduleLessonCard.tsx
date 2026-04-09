'use client';

import { BookOpen, Calendar, Check, Clock, RefreshCw, User as UserIcon, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import type { MouseEvent, CSSProperties } from 'react';

export interface ScheduleLessonCardData {
  id: number;
  groupId?: number | null;
  groupTitle: string;
  courseId?: number | null;
  courseTitle: string;
  teacherId?: number | null;
  teacherName: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'done' | 'canceled';
  topic?: string | null;
  originalDate?: string | null;
  isRescheduled?: boolean;
  isMakeup?: boolean | null;
  isTrial?: boolean | null;
  isReplaced?: boolean;
}

interface ScheduleLessonCardProps {
  lesson: ScheduleLessonCardData;
  onClick?: () => void;
  onGroupClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onCourseClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

function getLessonStyle(status: string, isMakeup?: boolean | null, groupId?: number | null) {
  if (status === 'done') return { background: '#f0fdf4', borderColor: '#16a34a', color: '#166534', accentColor: '#16a34a' };
  if (status === 'canceled') return { background: '#fef2f2', borderColor: '#dc2626', color: '#991b1b', accentColor: '#dc2626' };
  if (isMakeup) return { background: '#fff7ed', borderColor: '#f97316', color: '#7c2d12', accentColor: '#f97316' };
  if (!groupId) return { background: '#f5f3ff', borderColor: '#8b5cf6', color: '#4c1d95', accentColor: '#8b5cf6' };
  return { background: '#eff6ff', borderColor: '#3b82f6', color: '#1e40af', accentColor: '#3b82f6' };
}

function getStatusBadgeStyle(status: string, isMakeup?: boolean | null, groupId?: number | null): CSSProperties {
  if (status === 'done') return { background: '#16a34a', color: 'white' };
  if (status === 'canceled') return { background: '#dc2626', color: 'white' };
  if (isMakeup) return { background: '#f97316', color: 'white' };
  if (!groupId) return { background: '#8b5cf6', color: 'white' };
  return { background: '#3b82f6', color: 'white' };
}

export default function ScheduleLessonCard({
  lesson,
  onClick,
  onGroupClick,
  onCourseClick,
}: ScheduleLessonCardProps) {
  const lessonStyle = getLessonStyle(lesson.status, lesson.isMakeup, lesson.groupId);

  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.625rem',
        borderRadius: '0.5rem',
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: '3px solid',
        borderColor: lessonStyle.borderColor,
        background: lessonStyle.background,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {lesson.isMakeup ? (
        <div style={badgeMetaStyle('#fff7ed', '#c2410c', '#fed7aa')}>
          <RefreshCw size={8} />
          Відпрацювання
        </div>
      ) : !lesson.groupId && lesson.isTrial ? (
        <div style={badgeMetaStyle('#f0fdf4', '#15803d', '#bbf7d0')}>
          <Check size={8} />
          Пробне
        </div>
      ) : !lesson.groupId ? (
        <div style={badgeMetaStyle('#f5f3ff', '#6d28d9', '#ddd6fe')}>
          <UserIcon size={8} />
          Індивідуальне
        </div>
      ) : null}

      <div style={{
        fontSize: '0.875rem',
        fontWeight: 700,
        color: lessonStyle.accentColor,
        marginBottom: '0.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
      }}>
        <Clock size={10} />
        {lesson.startTime} - {lesson.endTime}
      </div>

      {lesson.groupId && !lesson.isMakeup && (
        <div
          onClick={onGroupClick}
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: onGroupClick ? 'pointer' : 'default',
            transition: 'color 0.15s ease',
          }}
          onMouseEnter={(e) => { if (onGroupClick) e.currentTarget.style.color = '#3b82f6'; }}
          onMouseLeave={(e) => { if (onGroupClick) e.currentTarget.style.color = '#111827'; }}
        >
          <Users size={10} />
          {lesson.groupTitle}
        </div>
      )}

      {lesson.groupId && !lesson.isMakeup && (
        <div
          onClick={onCourseClick}
          style={{
            fontSize: '0.8125rem',
            color: lessonStyle.accentColor,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '0.125rem',
            cursor: onCourseClick ? 'pointer' : 'default',
            transition: 'color 0.15s ease',
            opacity: 0.85,
          }}
          onMouseEnter={(e) => { if (onCourseClick) e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { if (onCourseClick) e.currentTarget.style.opacity = '0.85'; }}
        >
          <BookOpen size={9} />
          {lesson.courseTitle}
        </div>
      )}

      <div style={{
        fontSize: '0.8125rem',
        color: lesson.isReplaced ? '#d97706' : '#9ca3af',
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        marginTop: '0.125rem',
      }}>
        <UserIcon size={9} />
        {lesson.teacherName}
        {lesson.isReplaced && (
          <span style={{
            background: '#fef3c7',
            color: '#d97706',
            fontSize: '0.625rem',
            padding: '0.0625rem 0.25rem',
            borderRadius: '0.125rem',
            marginLeft: '0.125rem',
          }}>
            (Зам.)
          </span>
        )}
      </div>

      {lesson.isRescheduled && lesson.originalDate && (
        <div style={{
          fontSize: '0.6875rem',
          color: '#7c3aed',
          background: '#f5f3ff',
          border: '1px solid #ddd6fe',
          borderRadius: '0.25rem',
          padding: '0.125rem 0.375rem',
          marginTop: '0.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}>
          <RefreshCw size={8} />
          Перенесено з {format(new Date(`${lesson.originalDate}T00:00:00`), 'd MMM', { locale: uk })}
        </div>
      )}

      {lesson.topic && (
        <div style={{
          fontSize: '0.75rem',
          color: '#6b7280',
          marginTop: '0.25rem',
          fontStyle: 'italic',
        }}>
          {lesson.topic}
        </div>
      )}

      <div style={{
        ...getStatusBadgeStyle(lesson.status, lesson.isMakeup, lesson.groupId),
        fontSize: '0.6875rem',
        padding: '0.25rem 0.5rem',
        borderRadius: '0.25rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.125rem',
        marginTop: '0.375rem',
      }}>
        {lesson.status === 'done' && <Check size={8} />}
        {lesson.status === 'canceled' && <X size={8} />}
        {lesson.status === 'scheduled' && <Calendar size={8} />}
        {lesson.status === 'done' ? 'Проведено' : lesson.status === 'canceled' ? 'Скасовано' : 'Заплановано'}
      </div>
    </div>
  );
}

function badgeMetaStyle(background: string, color: string, borderColor: string): CSSProperties {
  return {
    fontSize: '0.625rem',
    fontWeight: 700,
    background,
    color,
    border: `1px solid ${borderColor}`,
    borderRadius: '0.25rem',
    padding: '0.125rem 0.375rem',
    marginBottom: '0.3rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  };
}
