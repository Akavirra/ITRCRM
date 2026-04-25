'use client';

/**
 * LessonShortcuts — клієнтський компонент ярликів заняття для учня (Phase D.1).
 *
 * Поведінка:
 *   - Грід кнопок (без розгортання — ярликів зазвичай ≤10, ховати немає сенсу).
 *   - `kind='url'` → `<a target="_blank">` — відкривається у браузері/PWA.
 *   - `kind='app'` → НА ПЛАНШЕТІ (PWA) приховується (агента-нема, запустити нічим);
 *     на ноутах з ITR-Agent — відкривається через `app://` URL-схему,
 *     яку ловить агент і запускає локальну програму.
 *   - Lazy-load: робимо fetch при першому маунті. Дані надходять у вигляді
 *     `{items: [...]}` від /api/student/lessons/{id}/shortcuts.
 *
 * Прибрано "розгортання" (як у галереї) — ярлики мають бути на видноті,
 * це інструмент дії, а не архів.
 */

import { useEffect, useState } from 'react';

type ShortcutKind = 'url' | 'app';

interface ShortcutItem {
  id: number;
  kind: ShortcutKind;
  label: string;
  target: string;
  icon: string | null;
  sortOrder: number;
  createdByName: string | null;
}

interface Props {
  lessonId: number;
  /** Якщо true — рендеримо `app:`-ярлики (агент на ноуті їх обробить).
   *  За замовчуванням false → планшети/PWA сховають їх. */
  agentMode?: boolean;
}

/**
 * Простий heuristic — детектимо ITR-Agent по user-agent (агент додасть власний токен).
 * Поки не реалізовано — тримаємо false. Залишаємо точку розширення на майбутнє.
 */
function detectAgentMode(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /ITR-Agent/i.test(navigator.userAgent);
}

export default function LessonShortcuts({ lessonId, agentMode }: Props) {
  const [items, setItems] = useState<ShortcutItem[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedAgentMode, setResolvedAgentMode] = useState<boolean>(false);

  useEffect(() => {
    setResolvedAgentMode(typeof agentMode === 'boolean' ? agentMode : detectAgentMode());
  }, [agentMode]);

  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    fetch(`/api/student/lessons/${lessonId}/shortcuts`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (abort) return;
        setItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch((e: unknown) => {
        if (abort) return;
        setError(e instanceof Error ? e.message : 'Не вдалося завантажити ярлики');
      })
      .finally(() => {
        if (abort) return;
        setLoading(false);
      });
    return () => {
      abort = true;
    };
  }, [lessonId]);

  if (loading) {
    return (
      <div className="student-shortcuts">
        <div className="student-shortcuts__title">Швидкий доступ</div>
        <div className="student-shortcuts__hint">Завантаження…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-shortcuts">
        <div className="student-shortcuts__title">Швидкий доступ</div>
        <div className="student-shortcuts__error">{error}</div>
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  // Фільтруємо app-ярлики на пристроях без агента — вони все одно не запустяться.
  const visible = resolvedAgentMode
    ? items
    : items.filter((it) => it.kind === 'url');

  if (visible.length === 0) return null;

  return (
    <div className="student-shortcuts">
      <div className="student-shortcuts__title">Швидкий доступ</div>
      <div className="student-shortcuts__grid">
        {visible.map((item) => (
          <ShortcutTile key={item.id} item={item} agentMode={resolvedAgentMode} />
        ))}
      </div>
    </div>
  );
}

function ShortcutTile({ item, agentMode }: { item: ShortcutItem; agentMode: boolean }) {
  const isApp = item.kind === 'app';
  // На пристрої з агентом app-ярлики йдуть як `itr-agent://run/<target>` —
  // агент має зареєстрований custom protocol handler. Поки агент не написаний —
  // лишаємо `data-target` для майбутнього JS-моста.
  const href = isApp ? `itr-agent://run/${encodeURIComponent(item.target)}` : item.target;

  const tileTitle = item.createdByName ? `Додав: ${item.createdByName}` : item.label;

  return (
    <a
      href={href}
      target={isApp ? undefined : '_blank'}
      rel={isApp ? undefined : 'noopener noreferrer'}
      className={`student-shortcut-tile student-shortcut-tile--${item.kind}`}
      title={tileTitle}
      data-kind={item.kind}
      data-target={item.target}
    >
      <span className="student-shortcut-tile__icon" aria-hidden="true">
        {item.icon || (isApp ? '⚙️' : '🔗')}
      </span>
      <span className="student-shortcut-tile__label">{item.label}</span>
      {isApp && agentMode && (
        <span className="student-shortcut-tile__hint">локальна</span>
      )}
    </a>
  );
}
