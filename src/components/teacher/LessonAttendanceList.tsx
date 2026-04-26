'use client';

/**
 * LessonAttendanceList — таблиця присутності.
 *
 * Список учнів групи. Для кожного — 4 кнопки статусу (Був / Запіз. / Поваж. / Пропуск).
 * Tap → POST /api/teacher/lessons/[id]/attendance.
 *
 * Учні без позначки — рендеримо в окремій секції зверху.
 */

import { useMemo, useState } from 'react';

interface Student {
  id: number;
  full_name: string;
  photo: string | null;
}

interface AttendanceRow {
  id: number;
  student_id: number;
  status: string | null;
  comment: string | null;
}

interface Props {
  lessonId: number;
  students: Student[];
  initialAttendance: AttendanceRow[];
}

const STATUSES: Array<{
  value: 'present' | 'late' | 'excused' | 'absent';
  label: string;
  color: string;
  bg: string;
}> = [
  { value: 'present', label: 'Був', color: '#047857', bg: '#ecfdf5' },
  { value: 'late', label: 'Запіз.', color: '#b45309', bg: '#fef3c7' },
  { value: 'excused', label: 'Поваж.', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'absent', label: 'Пропуск', color: '#b91c1c', bg: '#fef2f2' },
];

export default function LessonAttendanceList({
  lessonId,
  students,
  initialAttendance,
}: Props) {
  const [attendance, setAttendance] = useState<AttendanceRow[]>(initialAttendance);
  const [error, setError] = useState<string | null>(null);
  const [savingStudentId, setSavingStudentId] = useState<number | null>(null);

  const attendanceByStudent = useMemo(() => {
    const map = new Map<number, AttendanceRow>();
    for (const a of attendance) map.set(a.student_id, a);
    return map;
  }, [attendance]);

  async function setStatus(studentId: number, status: 'present' | 'late' | 'excused' | 'absent') {
    if (savingStudentId) return;
    setSavingStudentId(studentId);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setAttendance(data.attendance ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setSavingStudentId(null);
    }
  }

  async function clearStatus(studentId: number, attendanceId: number) {
    if (savingStudentId) return;
    setSavingStudentId(studentId);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/lessons/${lessonId}/attendance/${attendanceId}`,
        { method: 'DELETE' },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setAttendance(data.attendance ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося видалити');
    } finally {
      setSavingStudentId(null);
    }
  }

  // Підрахунок
  const counts = useMemo(() => {
    const c = { present: 0, late: 0, excused: 0, absent: 0, none: 0 };
    for (const s of students) {
      const a = attendanceByStudent.get(s.id);
      const st = a?.status as keyof typeof c | undefined;
      if (st && st in c) c[st]++;
      else c.none++;
    }
    return c;
  }, [students, attendanceByStudent]);

  return (
    <div>
      {error && (
        <div className="teacher-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="teacher-attendance-summary">
        <span><strong>{counts.present}</strong> були</span>
        <span><strong>{counts.late}</strong> запіз.</span>
        <span><strong>{counts.excused}</strong> поваж.</span>
        <span><strong>{counts.absent}</strong> пропустили</span>
        {counts.none > 0 && (
          <span className="teacher-attendance-summary__pending">
            <strong>{counts.none}</strong> ще не позначено
          </span>
        )}
      </div>

      <ul className="teacher-attendance-list">
        {students.map((s) => {
          const a = attendanceByStudent.get(s.id);
          const isSaving = savingStudentId === s.id;
          return (
            <li
              key={s.id}
              className={`teacher-attendance-row${a ? '' : ' teacher-attendance-row--pending'}`}
            >
              <div className="teacher-attendance-row__avatar">
                {s.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photo} alt={s.full_name} />
                ) : (
                  <span>{s.full_name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="teacher-attendance-row__name">{s.full_name}</div>
              <div
                className="teacher-attendance-row__buttons"
                role="group"
                aria-label={`Статус ${s.full_name}`}
              >
                {STATUSES.map((opt) => {
                  const active = a?.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      className={`teacher-status-btn${active ? ' is-active' : ''}`}
                      style={
                        active
                          ? { background: opt.bg, color: opt.color, borderColor: opt.color }
                          : undefined
                      }
                      onClick={() => setStatus(s.id, opt.value)}
                      disabled={isSaving}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                {a && (
                  <button
                    type="button"
                    className="teacher-status-btn teacher-status-btn--clear"
                    onClick={() => clearStatus(s.id, a.id)}
                    disabled={isSaving}
                    title="Прибрати позначку"
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
