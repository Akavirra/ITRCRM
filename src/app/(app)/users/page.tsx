'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';
import { formatDateKyiv } from '@/lib/date-utils';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'teacher' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);

        if (authData.user.role !== 'admin') {
          router.push('/dashboard');
          return;
        }

        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        setUsers(usersData.users || []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleCreate = () => {
    setFormData({ name: '', email: '', password: '', role: 'teacher' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t('toasts.error'));
        setSaving(false);
        return;
      }

      setShowModal(false);
      const usersRes = await fetch('/api/users');
      const usersData = await usersRes.json();
      setUsers(usersData.users || []);
    } catch (error) {
      console.error('Failed to save user:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
        <PageLoading />
      </Layout>
    );
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{t('pages.users')}</h3>
          <button className="btn btn-primary" onClick={handleCreate}>
            + {t('modals.newUser')}
          </button>
        </div>

        <div className="table-container">
          {users.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('forms.name')}</th>
                  <th>{t('forms.email')}</th>
                  <th>{t('forms.role')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('table.created')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: '500' }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-gray'}`}>
                        {u.role === 'admin' ? t('roles.admin') : t('roles.teacher')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {u.is_active ? t('status.active') : t('status.inactive')}
                      </span>
                    </td>
                    <td style={{ color: '#6b7280' }}>
                      {formatDateKyiv(u.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <h3 className="empty-state-title">{t('emptyStates.noUsers')}</h3>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t('modals.newUser')}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('forms.name')} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('forms.namePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.email')} *</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={t('forms.emailPlaceholder')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.password')} *</label>
                <input
                  type="password"
                  className="form-input"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('forms.passwordPlaceholder')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.role')}</label>
                <select
                  className="form-select"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'teacher' })}
                >
                  <option value="teacher">{t('roles.teacher')}</option>
                  <option value="admin">{t('roles.admin')}</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {t('actions.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !formData.name.trim() || !formData.email.trim() || !formData.password.trim()}
              >
                {saving ? t('common.saving') : t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
