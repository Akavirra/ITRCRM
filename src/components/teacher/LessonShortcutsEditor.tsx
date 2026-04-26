'use client';

/**
 * LessonShortcutsEditor — Phase D.1: викладач керує ярликами заняття.
 *
 * Рендерить список + форму "+ Додати". Inline edit через ту саму форму.
 * Діалог підтвердження видалення — простий confirm() для MVP.
 */

import { useState } from 'react';

interface Shortcut {
  id: number;
  kind: 'url' | 'app';
  label: string;
  target: string;
  icon: string | null;
  sort_order: number;
}

interface Props {
  lessonId: number;
  initialItems: Shortcut[];
}

const EMPTY_DRAFT = {
  kind: 'url' as 'url' | 'app',
  label: '',
  target: '',
  icon: '',
};

type Draft = typeof EMPTY_DRAFT;

export default function LessonShortcutsEditor({ lessonId, initialItems }: Props) {
  const [items, setItems] = useState<Shortcut[]>(initialItems);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setEditingId('new');
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  function startEdit(item: Shortcut) {
    setEditingId(item.id);
    setDraft({
      kind: item.kind,
      label: item.label,
      target: item.target,
      icon: item.icon ?? '',
    });
    setError(null);
  }

  function cancel() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
  }

  async function saveDraft() {
    if (busy) return;
    if (!draft.label.trim() || !draft.target.trim()) {
      setError('Вкажи назву та адресу');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        kind: draft.kind,
        label: draft.label.trim(),
        target: draft.target.trim(),
        icon: draft.icon.trim() || null,
      };

      let res: Response;
      if (editingId === 'new') {
        res = await fetch(`/api/teacher/lessons/${lessonId}/shortcuts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/teacher/lessons/${lessonId}/shortcuts/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const item = data.item as Shortcut;
      setItems((prev) => {
        if (editingId === 'new') return [...prev, item];
        return prev.map((it) => (it.id === item.id ? item : it));
      });
      cancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося зберегти');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Shortcut) {
    if (busy) return;
    if (!confirm(`Видалити «${item.label}»?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/shortcuts/${item.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося видалити');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="teacher-error" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}

      {items.length === 0 && editingId !== 'new' && (
        <div className="teacher-empty" style={{ marginBottom: 10 }}>
          Поки ярликів немає. Додай посилання на сайти або назви програм,
          які знадобляться учням на занятті.
        </div>
      )}

      <ul className="teacher-shortcuts-list">
        {items.map((item) =>
          editingId === item.id ? (
            <li key={item.id} className="teacher-shortcut-edit">
              <ShortcutForm
                draft={draft}
                onChange={setDraft}
                onSave={saveDraft}
                onCancel={cancel}
                busy={busy}
              />
            </li>
          ) : (
            <li key={item.id} className="teacher-shortcut-row">
              <span className="teacher-shortcut-row__icon" aria-hidden="true">
                {item.icon || (item.kind === 'app' ? '⚙️' : '🔗')}
              </span>
              <span className="teacher-shortcut-row__label">
                <strong>{item.label}</strong>
                <span className="teacher-shortcut-row__target">{item.target}</span>
              </span>
              <span className={`teacher-shortcut-kind teacher-shortcut-kind--${item.kind}`}>
                {item.kind === 'app' ? 'програма' : 'посилання'}
              </span>
              <span className="teacher-shortcut-row__actions">
                <button
                  type="button"
                  className="teacher-ghost-btn"
                  onClick={() => startEdit(item)}
                  disabled={busy}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="teacher-ghost-btn"
                  onClick={() => remove(item)}
                  disabled={busy}
                  style={{ color: '#b91c1c' }}
                >
                  🗑
                </button>
              </span>
            </li>
          ),
        )}

        {editingId === 'new' && (
          <li className="teacher-shortcut-edit">
            <ShortcutForm
              draft={draft}
              onChange={setDraft}
              onSave={saveDraft}
              onCancel={cancel}
              busy={busy}
            />
          </li>
        )}
      </ul>

      {editingId !== 'new' && (
        <button
          type="button"
          className="teacher-secondary-btn"
          onClick={startNew}
          disabled={busy || editingId !== null}
          style={{ marginTop: 10 }}
        >
          + Додати ярлик
        </button>
      )}
    </div>
  );
}

function ShortcutForm({
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="teacher-shortcut-form">
      <div className="teacher-shortcut-form__kind">
        <label>
          <input
            type="radio"
            checked={draft.kind === 'url'}
            onChange={() => onChange({ ...draft, kind: 'url' })}
          />
          🔗 Посилання
        </label>
        <label>
          <input
            type="radio"
            checked={draft.kind === 'app'}
            onChange={() => onChange({ ...draft, kind: 'app' })}
          />
          ⚙️ Локальна програма
        </label>
      </div>

      <input
        type="text"
        className="teacher-input"
        placeholder="Назва (наприклад, Scratch)"
        value={draft.label}
        onChange={(e) => onChange({ ...draft, label: e.target.value })}
        maxLength={80}
        disabled={busy}
      />

      <input
        type="text"
        className="teacher-input"
        placeholder={
          draft.kind === 'url'
            ? 'https://scratch.mit.edu'
            : 'scratch  або  ide:python'
        }
        value={draft.target}
        onChange={(e) => onChange({ ...draft, target: e.target.value })}
        maxLength={1000}
        disabled={busy}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 13 }}
      />

      <input
        type="text"
        className="teacher-input"
        placeholder="Іконка (emoji, опціонально)"
        value={draft.icon}
        onChange={(e) => onChange({ ...draft, icon: e.target.value })}
        maxLength={32}
        disabled={busy}
      />

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          className="teacher-primary-btn"
          onClick={onSave}
          disabled={busy}
        >
          {busy ? 'Зберігаю…' : 'Зберегти'}
        </button>
        <button
          type="button"
          className="teacher-secondary-btn"
          onClick={onCancel}
          disabled={busy}
        >
          Скасувати
        </button>
      </div>
    </div>
  );
}
