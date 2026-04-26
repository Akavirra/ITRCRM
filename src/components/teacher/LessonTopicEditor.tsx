'use client';

/**
 * LessonTopicEditor — редактор теми та нотаток заняття.
 *
 * Дві текстові області. Auto-save на blur. Шле PATCH /api/teacher/lessons/[id]
 * з {topic, notes}. Помилку відображає під полем.
 */

import { useState } from 'react';

interface Props {
  lessonId: number;
  initialTopic: string | null;
  initialNotes: string | null;
}

export default function LessonTopicEditor({ lessonId, initialTopic, initialNotes }: Props) {
  const [topic, setTopic] = useState(initialTopic ?? '');
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [savedTopic, setSavedTopic] = useState(initialTopic ?? '');
  const [savedNotes, setSavedNotes] = useState(initialNotes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<'topic' | 'notes' | null>(null);

  async function save(field: 'topic' | 'notes', value: string) {
    if (savingField) return; // не паралельно
    const trimmed = value.trim();
    const original = field === 'topic' ? savedTopic : savedNotes;
    if (trimmed === original) return; // нічого не змінилось

    setSavingField(field);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: trimmed || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (field === 'topic') setSavedTopic(trimmed);
      else setSavedNotes(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
      // повертаємо попереднє значення в інпут
      if (field === 'topic') setTopic(savedTopic);
      else setNotes(savedNotes);
    } finally {
      setSavingField(null);
    }
  }

  const topicChanged = topic.trim() !== savedTopic;
  const notesChanged = notes.trim() !== savedNotes;

  return (
    <div className="teacher-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label className="teacher-label" htmlFor={`lesson-topic-${lessonId}`} style={{ marginBottom: 0 }}>
          Тема заняття
        </label>
        {savingField === 'topic' && (
          <span style={{ fontSize: 12, color: '#64748b' }}>Зберігаю…</span>
        )}
        {savingField !== 'topic' && topicChanged && (
          <span style={{ fontSize: 12, color: '#b45309' }}>Незбережено</span>
        )}
      </div>
      <input
        id={`lesson-topic-${lessonId}`}
        type="text"
        className="teacher-input"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        onBlur={() => save('topic', topic)}
        placeholder="Що сьогодні проходимо?"
        maxLength={500}
        disabled={savingField === 'topic'}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 8px' }}>
        <label className="teacher-label" htmlFor={`lesson-notes-${lessonId}`} style={{ marginBottom: 0 }}>
          Нотатки (для себе)
        </label>
        {savingField === 'notes' && (
          <span style={{ fontSize: 12, color: '#64748b' }}>Зберігаю…</span>
        )}
        {savingField !== 'notes' && notesChanged && (
          <span style={{ fontSize: 12, color: '#b45309' }}>Незбережено</span>
        )}
      </div>
      <textarea
        id={`lesson-notes-${lessonId}`}
        className="teacher-input"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => save('notes', notes)}
        placeholder="Що варто запам'ятати про це заняття…"
        maxLength={5000}
        disabled={savingField === 'notes'}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />

      {error && (
        <div className="teacher-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
