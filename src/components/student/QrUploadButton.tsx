'use client';

/**
 * QrUploadButton — кнопка "📱 Завантажити з телефону" + модальне вікно з QR.
 *
 * Phase C.2: вмикає мобільний QR-flow. При відкритті модалки робить POST на
 * /api/student/upload-qr — серверу вже видно поточну сесію, тож достатньо
 * передати lessonId. У відповіді — qrDataUrl (інлайн PNG) + mobileUrl + expiresAt.
 *
 * Особливості:
 *   - QR живе 10 хв; компонент сам показує countdown.
 *   - Кнопка показується ЛИШЕ коли upload-вікно відкрите (батько вирішує).
 *   - Натискання поза модалкою / Esc → закриває.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  lessonId: number;
  /** Часовий ярлик з ТЗ (опційно) — для UI у тілі модалки. */
  lessonLabel?: string;
}

interface QrResponse {
  token?: string;
  expiresAt?: string;
  mobileUrl?: string;
  qrDataUrl?: string;
  error?: string;
}

export default function QrUploadButton({ lessonId, lessonLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQr(null);
    setError(null);
    setRemainingSec(0);
  }, []);

  const issueQr = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/student/upload-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      });
      const data: QrResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (!data.qrDataUrl || !data.mobileUrl || !data.expiresAt) {
        throw new Error('Некоректна відповідь сервера');
      }
      setQr(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вдалося згенерувати QR-код');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  // При відкритті — генеруємо QR
  useEffect(() => {
    if (open && !qr && !loading && !error) {
      void issueQr();
    }
  }, [open, qr, loading, error, issueQr]);

  // Countdown to expiry
  useEffect(() => {
    if (!qr?.expiresAt) return;
    const exp = new Date(qr.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((exp - Date.now()) / 1000));
      setRemainingSec(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [qr]);

  // Esc → close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, closeModal]);

  const expired = qr !== null && remainingSec === 0;

  return (
    <>
      <button
        type="button"
        className="student-secondary-btn student-qr-trigger"
        onClick={() => setOpen(true)}
      >
        📱 Завантажити з телефону
      </button>

      {open && (
        <div
          className="student-qr-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-qr-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="student-qr-modal" ref={dialogRef}>
            <div className="student-qr-modal__header">
              <div id="student-qr-modal-title" className="student-qr-modal__title">
                Завантаження з телефону
              </div>
              <button
                type="button"
                className="student-qr-modal__close"
                onClick={closeModal}
                aria-label="Закрити"
              >
                ✕
              </button>
            </div>

            {lessonLabel && (
              <div className="student-qr-modal__lesson">{lessonLabel}</div>
            )}

            {loading && <div className="student-qr-modal__hint">Готуємо QR-код…</div>}

            {error && (
              <div className="student-qr-modal__error">
                {error}
                <button
                  type="button"
                  className="student-secondary-btn"
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    setError(null);
                    void issueQr();
                  }}
                >
                  Спробувати ще
                </button>
              </div>
            )}

            {qr && !error && (
              <>
                <div className="student-qr-modal__instructions">
                  <ol>
                    <li>Відкрий камеру на телефоні.</li>
                    <li>Наведи на цей QR-код.</li>
                    <li>Перейди за посиланням і додай файл.</li>
                  </ol>
                </div>

                <div className={`student-qr-modal__qr${expired ? ' is-expired' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qr.qrDataUrl}
                    alt="QR-код для завантаження"
                    width={280}
                    height={280}
                  />
                  {expired && (
                    <div className="student-qr-modal__expired-veil">
                      Прострочено
                    </div>
                  )}
                </div>

                <div className="student-qr-modal__footer">
                  {!expired ? (
                    <div className="student-qr-modal__timer">
                      Дійсний ще: <strong>{formatRemaining(remainingSec)}</strong>
                    </div>
                  ) : (
                    <div className="student-qr-modal__timer">QR-код прострочений</div>
                  )}

                  <button
                    type="button"
                    className="student-secondary-btn"
                    onClick={() => {
                      setQr(null);
                      setError(null);
                      void issueQr();
                    }}
                  >
                    Згенерувати новий
                  </button>
                </div>

                <details className="student-qr-modal__details">
                  <summary>Не сканується? Покажи посилання</summary>
                  <div className="student-qr-modal__url">{qr.mobileUrl}</div>
                </details>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function formatRemaining(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
