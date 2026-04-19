'use client';

/**
 * Панель управління PIN-карткою учня (портал). Рендериться в профілі учня.
 *
 * Показує:
 *   - поточний стан (є активна картка? коли створено? які 2 останні цифри PIN?)
 *   - кнопку "Згенерувати нову картку" (або "Перегенерувати" якщо вже є)
 *   - кнопку "Відкликати доступ"
 *
 * При генерації показує модалку з кодом + PIN одноразово, з кнопкою
 * "Завантажити PDF для друку" (передає code+pin у /pin-card/pdf).
 */

import { useEffect, useState } from 'react';

interface Props {
  studentId: number;
}

interface CardStatus {
  hasActiveCode: boolean;
  hasActivePin: boolean;
  code: string | null;
  codeCreatedAt: string | null;
  pinLast2: string | null;
  pinCreatedAt: string | null;
}

interface IssuedCard {
  code: string;
  pin: string;
  full_name: string;
}

export default function StudentPinCardPanel({ studentId }: Props) {
  const [status, setStatus] = useState<CardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedCard | null>(null);
  const [pinCopied, setPinCopied] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/pin-card`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
    } catch (e: any) {
      setError(e.message || 'Не вдалося завантажити статус');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleGenerate = async () => {
    const already = status?.hasActivePin;
    if (already) {
      const ok = window.confirm(
        'Попередній PIN буде відкликано. Учень не зможе зайти зі старим PIN-ом. Продовжити?'
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/pin-card`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data: IssuedCard = await res.json();
      setIssued(data);
      setPinCopied(false);
      await loadStatus();
    } catch (e: any) {
      setError(e.message || 'Не вдалося згенерувати картку');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    const ok = window.confirm(
      'Відкликати доступ до порталу? Учень не зможе зайти, доки ви не згенеруєте нову картку.'
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/pin-card`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadStatus();
    } catch (e: any) {
      setError(e.message || 'Не вдалося відкликати');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!issued) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/students/${studentId}/pin-card/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: issued.code, pin: issued.pin }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pin-card-${issued.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || 'Не вдалося завантажити PDF');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyPin = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.pin);
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 2000);
    } catch {
      // Fallback: ignore
    }
  };

  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('uk-UA', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    });
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        border: '1px solid #e5e7eb',
        marginTop: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', margin: 0 }}>
          🎟️ Доступ до порталу учня
        </h2>
        {status?.hasActivePin && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
            }}
          >
            Активна
          </span>
        )}
        {status && !status.hasActivePin && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
            }}
          >
            Не налаштовано
          </span>
        )}
      </div>

      {loading && (
        <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Завантаження…</div>
      )}

      {error && (
        <div
          style={{
            padding: '0.625rem 0.875rem',
            borderRadius: '0.5rem',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            fontSize: '0.875rem',
            marginBottom: '0.75rem',
            border: '1px solid #fecaca',
          }}
        >
          {error}
        </div>
      )}

      {!loading && status && (
        <>
          {status.hasActivePin ? (
            <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem', lineHeight: 1.5 }}>
              <div>Код учня: <strong style={{ color: '#111827' }}>{status.code}</strong></div>
              <div>PIN встановлено: <strong>•••• {status.pinLast2}</strong> <span style={{ color: '#9ca3af' }}>— {fmtDate(status.pinCreatedAt)}</span></div>
            </div>
          ) : (
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.5 }}>
              Учень ще не отримав доступ до порталу. Натисніть «Згенерувати картку» —
              система створить код і PIN, які ви зможете роздрукувати на картці для учня.
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'white',
                backgroundColor: busy ? '#93c5fd' : '#2563eb',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {status.hasActivePin ? 'Перегенерувати картку' : 'Згенерувати картку'}
            </button>

            {status.hasActivePin && (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={busy}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#991b1b',
                  backgroundColor: 'transparent',
                  border: '1px solid #fecaca',
                  borderRadius: '0.5rem',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Відкликати доступ
              </button>
            )}
          </div>
        </>
      )}

      {/* Модалка з результатом генерації — PIN видно ТІЛЬКИ ЦЕЙ РАЗ */}
      {issued && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setIssued(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '0.75rem',
              padding: '1.75rem',
              maxWidth: '26rem',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem' }}>
              🎉 Картку створено
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: '0 0 1rem', lineHeight: 1.5 }}>
              ⚠️ <strong>PIN видно лише цей раз.</strong> Збережіть або роздрукуйте зараз.
              У разі втрати — доведеться перегенерувати.
            </p>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Учень
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#111827' }}>{issued.full_name}</div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Код
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
                  {issued.code}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  PIN
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                  {issued.pin.slice(0, 3)} {issued.pin.slice(3)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={busy}
                style={{
                  flex: 1,
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'white',
                  backgroundColor: busy ? '#93c5fd' : '#2563eb',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                📄 Завантажити PDF
              </button>
              <button
                type="button"
                onClick={handleCopyPin}
                style={{
                  padding: '0.625rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#374151',
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                {pinCopied ? '✓ Скопійовано' : 'Копіювати PIN'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIssued(null)}
              style={{
                marginTop: '0.75rem',
                width: '100%',
                padding: '0.5rem',
                fontSize: '0.8rem',
                color: '#6b7280',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Закрити (я зберіг/ла PIN)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
