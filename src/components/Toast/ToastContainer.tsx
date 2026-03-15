'use client';

import React from 'react';
import { useToast, Toast, ToastType } from './ToastContext';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', text: '#15803d' },
  error:   { bg: '#fef2f2', border: '#fecaca', icon: '#dc2626', text: '#b91c1c' },
  warning: { bg: '#fffbeb', border: '#fde68a', icon: '#d97706', text: '#b45309' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', text: '#1d4ed8' },
};

function ToastIcon({ type }: { type: ToastType }) {
  const size = 18;
  if (type === 'success') return <CheckCircle size={size} />;
  if (type === 'error')   return <XCircle size={size} />;
  if (type === 'warning') return <AlertTriangle size={size} />;
  return <Info size={size} />;
}

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const c = COLORS[toast.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        padding: '0.75rem 1rem',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '0.625rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        minWidth: 260,
        maxWidth: 380,
        animation: 'toastIn 0.2s ease',
      }}
    >
      <span style={{ color: c.icon, flexShrink: 0, marginTop: 1 }}>
        <ToastIcon type={toast.type} />
      </span>
      <span style={{ flex: 1, fontSize: '0.875rem', color: c.text, lineHeight: 1.45 }}>
        {toast.message}
      </span>
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: c.icon, opacity: 0.6, padding: 0, flexShrink: 0,
          display: 'flex', marginTop: 1,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={t} />
          </div>
        ))}
      </div>
    </>
  );
}
