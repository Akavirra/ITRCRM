'use client';

import { useEffect, useRef, useState } from 'react';
import { useTelegramInitData } from '@/components/TelegramWebAppProvider';

interface AdminProfile {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
}

function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target?.result as string; };
    reader.onerror = reject;
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminProfilePage() {
  const { initData, isLoading: initLoading } = useTelegramInitData();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async (iData: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin-app/profile', {
        headers: { 'X-Telegram-Init-Data': iData },
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Помилка'); return; }
      setAdmin(data.admin);
      setFormName(data.admin.name || '');
      setFormPhone(data.admin.phone || '');
    } catch {
      setError('Не вдалося завантажити профіль');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initLoading && initData) fetchProfile(initData);
  }, [initData, initLoading]);

  const handleSave = async () => {
    if (!initData || !admin) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin-app/profile', {
        method: 'PATCH',
        headers: { 'X-Telegram-Init-Data': initData, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, phone: formPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdmin(data.admin);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initData) return;
    setPhotoMenu(false);
    setPhotoLoading(true);
    try {
      const base64 = await resizeImage(file);
      const res = await fetch('/api/admin-app/profile/photo', {
        method: 'POST',
        headers: { 'X-Telegram-Init-Data': initData, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: base64 }),
      });
      const data = await res.json();
      if (res.ok && admin) setAdmin({ ...admin, photo_url: data.photo_url });
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async () => {
    if (!initData || !admin) return;
    setConfirmDelete(false);
    setPhotoMenu(false);
    setPhotoLoading(true);
    try {
      await fetch('/api/admin-app/profile/photo', {
        method: 'DELETE',
        headers: { 'X-Telegram-Init-Data': initData },
      });
      setAdmin({ ...admin, photo_url: null });
    } finally {
      setPhotoLoading(false);
    }
  };

  if (initLoading) {
    return <div className="tg-loading"><div className="tg-spinner"></div></div>;
  }

  if (!initData && !loading) {
    return (
      <div className="tg-error">
        <div className="tg-error-title">Помилка</div>
        <div className="tg-error-text">Не вдалося отримати дані Telegram. Спробуйте закрити та відкрити додаток.</div>
      </div>
    );
  }

  if (loading) {
    return <div className="tg-loading"><div className="tg-spinner"></div></div>;
  }

  if (error || !admin) {
    return (
      <div className="tg-error">
        <div className="tg-error-title">Помилка</div>
        <div className="tg-error-text">{error || 'Профіль не знайдено'}</div>
      </div>
    );
  }

  return (
    <div>
      {/* Photo + name header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          {admin.photo_url ? (
            <img
              src={admin.photo_url}
              alt={admin.name}
              style={{ width: '96px', height: '96px', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '96px', height: '96px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--tg-primary-bg), var(--tg-primary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--tg-link-color)', fontWeight: 700, fontSize: '32px',
            }}>
              {getInitials(admin.name)}
            </div>
          )}
          <button
            onClick={() => setPhotoMenu(!photoMenu)}
            disabled={photoLoading}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'var(--tg-button-color)', color: 'var(--tg-button-text-color)',
              border: '2px solid var(--tg-bg-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '14px',
            }}
          >
            {photoLoading ? '⏳' : '📷'}
          </button>
        </div>

        {/* Photo action menu */}
        {photoMenu && (
          <div style={{
            background: 'var(--tg-surface)', border: '1px solid var(--tg-border)',
            borderRadius: 'var(--radius-lg)', padding: '8px', marginBottom: '12px',
            display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <button
              onClick={() => { setPhotoMenu(false); fileInputRef.current?.click(); }}
              style={{ background: 'none', border: 'none', color: 'var(--tg-text-color)', cursor: 'pointer', padding: '10px 16px', borderRadius: 'var(--radius-md)', textAlign: 'left', fontSize: '14px' }}
            >
              📤 {admin.photo_url ? 'Змінити фото' : 'Завантажити фото'}
            </button>
            {admin.photo_url && (
              <button
                onClick={() => { setPhotoMenu(false); setConfirmDelete(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--tg-danger)', cursor: 'pointer', padding: '10px 16px', borderRadius: 'var(--radius-md)', textAlign: 'left', fontSize: '14px' }}
              >
                🗑️ Видалити фото
              </button>
            )}
            <button
              onClick={() => setPhotoMenu(false)}
              style={{ background: 'none', border: 'none', color: 'var(--tg-hint-color)', cursor: 'pointer', padding: '10px 16px', borderRadius: 'var(--radius-md)', textAlign: 'left', fontSize: '14px' }}
            >
              Скасувати
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

        {/* Confirm delete */}
        {confirmDelete && (
          <div style={{
            background: 'var(--tg-danger-bg)', border: '1px solid var(--tg-danger)',
            borderRadius: 'var(--radius-lg)', padding: 'var(--space-md)', marginBottom: '12px', textAlign: 'center',
          }}>
            <div style={{ color: 'var(--tg-danger)', fontSize: '14px', marginBottom: '12px' }}>Видалити фото?</div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <button onClick={handleDeletePhoto} style={{ background: 'var(--tg-danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}>Так</button>
              <button onClick={() => setConfirmDelete(false)} style={{ background: 'var(--tg-surface)', color: 'var(--tg-text-secondary)', border: '1px solid var(--tg-border)', borderRadius: 'var(--radius-md)', padding: '8px 16px', cursor: 'pointer', fontSize: '13px' }}>Ні</button>
            </div>
          </div>
        )}

        <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--tg-text-color)' }}>{admin.name}</div>
        <div style={{ fontSize: '13px', color: 'var(--tg-hint-color)' }}>Адміністратор</div>
      </div>

      {/* Profile info / edit form */}
      <div className="tg-card">
        {editing ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label className="tg-label">Ім&apos;я</label>
              <input
                className="tg-input"
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="Введіть ім'я"
              />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label className="tg-label">Телефон</label>
              <input
                className="tg-input"
                value={formPhone}
                onChange={e => setFormPhone(e.target.value)}
                placeholder="+380..."
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="tg-button"
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                style={{ flex: 1 }}
              >
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
              <button
                className="tg-button"
                onClick={() => { setEditing(false); setFormName(admin.name); setFormPhone(admin.phone || ''); }}
                style={{ flex: 1, background: 'var(--tg-surface)', color: 'var(--tg-text-secondary)', border: '1px solid var(--tg-border)' }}
              >
                Скасувати
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '12px' }}>
              <div className="tg-hint">Email</div>
              <div style={{ fontWeight: 500, color: 'var(--tg-text-color)', marginTop: '2px' }}>{admin.email}</div>
            </div>
            {admin.phone && (
              <div style={{ marginBottom: '12px' }}>
                <div className="tg-hint">Телефон</div>
                <div style={{ fontWeight: 500, color: 'var(--tg-text-color)', marginTop: '2px' }}>{admin.phone}</div>
              </div>
            )}
            <button
              className="tg-button"
              onClick={() => setEditing(true)}
              style={{ width: '100%', marginTop: '8px' }}
            >
              ✏️ Редагувати профіль
            </button>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: 'var(--space-lg)', color: 'var(--tg-hint-color)', fontSize: '12px' }}>
        <p>IT Robotics CRM • Адмін-панель</p>
        <p>Версія 1.0.0</p>
      </div>
    </div>
  );
}
