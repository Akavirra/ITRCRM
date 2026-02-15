'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

interface Student {
  id: number;
  public_id: string;
  full_name: string;
  phone: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  groups_count: number;
  is_active: number;
}

export default function StudentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    parent_name: '',
    parent_phone: '',
    notes: '',
  });
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

        const studentsRes = await fetch('/api/students?withGroupCount=true');
        const studentsData = await studentsRes.json();
        setStudents(studentsData.students || []);
      } catch (error) {
        console.error('Failed to fetch students:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim()) {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&withGroupCount=true`);
      const data = await res.json();
      setStudents(data.students || []);
    } else {
      const res = await fetch('/api/students?withGroupCount=true');
      const data = await res.json();
      setStudents(data.students || []);
    }
  };

  const handleCreate = () => {
    setEditingStudent(null);
    setFormData({ full_name: '', phone: '', parent_name: '', parent_phone: '', notes: '' });
    setShowModal(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name,
      phone: student.phone || '',
      parent_name: student.parent_name || '',
      parent_phone: student.parent_phone || '',
      notes: '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.full_name.trim()) return;
    
    setSaving(true);
    try {
      if (editingStudent) {
        await fetch(`/api/students/${editingStudent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      
      setShowModal(false);
      const res = await fetch('/api/students?withGroupCount=true');
      const data = await res.json();
      setStudents(data.students || []);
    } catch (error) {
      console.error('Failed to save student:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>{t('common.loading')}</div>;
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder={`${t('actions.search')} ${t('nav.students').toLowerCase()}...`}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ maxWidth: '300px' }}
            />
          </div>
          {user.role === 'admin' && (
            <button className="btn btn-primary" onClick={handleCreate}>
              + {t('modals.newStudent')}
            </button>
          )}
        </div>

        <div className="table-container">
          {students.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('table.id')}</th>
                  <th>{t('forms.fullName')}</th>
                  <th>{t('table.phone')}</th>
                  <th>{t('table.parent')}</th>
                  <th>{t('table.parentPhone')}</th>
                  <th style={{ textAlign: 'center' }}>{t('table.groups')}</th>
                  <th>{t('common.status')}</th>
                  {user.role === 'admin' && <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#6b7280' }}>
                      {student.public_id}
                    </td>
                    <td>
                      <a href={`/students/${student.id}`} style={{ fontWeight: '500' }}>
                        {student.full_name}
                      </a>
                    </td>
                    <td>{student.phone || '---'}</td>
                    <td>{student.parent_name || '---'}</td>
                    <td>{student.parent_phone || '---'}</td>
                    <td style={{ textAlign: 'center' }}>{student.groups_count}</td>
                    <td>
                      <span className={`badge ${student.is_active ? 'badge-success' : 'badge-gray'}`}>
                        {student.is_active ? t('status.active') : t('status.archived')}
                      </span>
                    </td>
                    {user.role === 'admin' && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEdit(student)}
                        >
                          {t('actions.edit')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="empty-state-title">{t('emptyStates.noStudents')}</h3>
              <p className="empty-state-text">{t('emptyStates.noStudentsHint')}</p>
              {user.role === 'admin' && (
                <button className="btn btn-primary" onClick={handleCreate}>
                  {t('emptyStates.addStudent')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingStudent ? t('modals.editStudent') : t('modals.newStudent')}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('forms.fullName')} *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder={t('forms.fullNamePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.phone')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('forms.phonePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.parentName')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.parent_name}
                  onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                  placeholder={t('forms.fullNamePlaceholder')}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('forms.parentPhone')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.parent_phone}
                  onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                  placeholder={t('forms.phonePlaceholder')}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {t('actions.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !formData.full_name.trim()}
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
