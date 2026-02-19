'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Teacher {
  id: number;
  public_id: string | null;
  name: string;
  email: string;
  phone?: string;
  telegram_id?: string;
  photo_url?: string;
  notes?: string;
  groups: Array<{
    id: number;
    title: string;
    course_title: string;
    weekly_day: number;
    start_time: string;
    duration_minutes: number;
  }>;
}

const DAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота'];

export default function TeacherProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', telegram_id: '', notes: ''
  });

  useEffect(() => {
    loadTeacher();
  }, [params.id]);

  const loadTeacher = async () => {
    try {
      const response = await fetch(`/api/teachers/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setTeacher(data);
        setFormData({
          name: data.name, email: data.email,
          phone: data.phone || '', telegram_id: data.telegram_id || '',
          notes: data.notes || ''
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/teachers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setToast({ message: 'Зміни збережено', type: 'success' });
        setEditing(false);
        loadTeacher();
      }
    } catch (error) {
      setToast({ message: 'Помилка збереження', type: 'error' });
    }
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToast({ message, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    });
  };

  if (loading) return <div style={{ padding: '20px' }}>Завантаження...</div>;
  if (!teacher) return <div style={{ padding: '20px' }}>Викладача не знайдено</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <button onClick={() => router.back()}
        style={{ marginBottom: '20px', padding: '8px 16px', border: '1px solid #ddd', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
      >
        ← Назад
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <img src={teacher.photo_url || '/default-avatar.png'} alt={teacher.name}
            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
          />

          {!editing ? (
            <>
              <h2 style={{ marginTop: 0 }}>{teacher.name}</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                {teacher.email && (
                  <div><strong>Email:</strong>
                    <div onClick={() => copyToClipboard(teacher.email, 'Email скопійовано')}
                      style={{ cursor: 'pointer', color: '#0066cc', marginTop: '4px', wordBreak: 'break-all' }}>
                      {teacher.email}
                    </div>
                  </div>
                )}
                
                {teacher.phone && (
                  <div><strong>Телефон:</strong>
                    <div onClick={() => copyToClipboard(teacher.phone!, 'Телефон скопійовано')}
                      style={{ cursor: 'pointer', color: '#0066cc', marginTop: '4px' }}>
                      {teacher.phone}
                    </div>
                  </div>
                )}
                
                {teacher.telegram_id && (
                  <div><strong>Telegram:</strong>
                    <div onClick={() => copyToClipboard(teacher.telegram_id!, 'Telegram ID скопійовано')}
                      style={{ cursor: 'pointer', color: '#0066cc', marginTop: '4px' }}>
                      @{teacher.telegram_id}
                    </div>
                  </div>
                )}
              </div>

              {teacher.notes && (
                <div style={{ marginTop: '16px', padding: '12px', background: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>Примітки:</strong>
                  <div style={{ marginTop: '8px', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                    {teacher.notes}
                  </div>
                </div>
              )}

              <button onClick={() => setEditing(true)}
                style={{ width: '100%', marginTop: '16px', padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Редагувати
              </button>
            </>
          ) : (
            <div>
              <h2 style={{ marginTop: 0 }}>Редагування</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Ім'я</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Телефон</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Telegram ID</label>
                  <input type="text" value={formData.telegram_id} onChange={(e) => setFormData({...formData, telegram_id: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>Примітки</label>
                  <textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={4}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => setEditing(false)}
                  style={{ flex: 1, padding: '10px', border: '1px solid #ddd', background: 'white', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Скасувати
                </button>
                <button onClick={handleSave}
                  style={{ flex: 1, padding: '10px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Зберегти
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <h3 style={{ marginTop: 0 }}>Групи викладача ({teacher.groups.length})</h3>
          {teacher.groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              У викладача ще немає груп
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {teacher.groups.map(group => (
                <div key={group.id} onClick={() => router.push(`/groups/${group.id}`)}
                  style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '4px' }}>
                    {group.title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                    {group.course_title}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    📅 {DAYS[group.weekly_day]}, {group.start_time} ({group.duration_minutes} хв)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: toast.type === 'success' ? '#4CAF50' : '#f44336',
          color: 'white', padding: '12px 24px', borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 1001
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
