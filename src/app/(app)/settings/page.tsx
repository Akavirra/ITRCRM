'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { t } from '@/i18n/t';
import PageLoading from '@/components/PageLoading';
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Palette, 
  Shield, 
  Database,
  Mail,
  Clock,
  Globe,
  Save,
  ChevronRight,
  X
} from 'lucide-react';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

type SettingsTab = 'general' | 'profile' | 'notifications' | 'system';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saved, setSaved] = useState(false);

  // Password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    // Profile
    displayName: '',
    email: '',
    phone: '',
    // Notifications
    emailNotifications: true,
    pushNotifications: true,
    lessonReminders: true,
    paymentAlerts: true,
    weeklyReport: true,
    // System
    language: 'uk',
    timezone: 'Europe/Kyiv',
    dateFormat: 'DD.MM.YYYY',
    currency: 'UAH',
  });

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
        
        // Set default values from user
        setSettings(prev => ({
          ...prev,
          displayName: authData.user.name || '',
          email: authData.user.email || '',
        }));
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Помилка збереження');
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Помилка збереження налаштувань');
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Новий пароль повинен містити мінімум 8 символів');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Паролі не співпадають');
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          currentPassword: passwordForm.currentPassword, 
          newPassword: passwordForm.newPassword 
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setPasswordError(data.error || 'Помилка зміни пароля');
        return;
      }
      
      setPasswordSuccess(true);
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordSuccess(false);
      }, 2000);
    } catch (error) {
      setPasswordError('Помилка зміни пароля');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return <PageLoading />;
  }

  if (!user) return null;

  const tabs = [
    { id: 'general' as const, label: 'Загальні', icon: SettingsIcon },
    { id: 'profile' as const, label: 'Профіль', icon: User },
    { id: 'notifications' as const, label: 'Сповіщення', icon: Bell },
    { id: 'system' as const, label: 'Система', icon: Shield },
  ];

  return (
    <Layout user={user}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '1.75rem', 
            fontWeight: '700', 
            color: '#111827',
            marginBottom: '0.5rem',
            letterSpacing: '-0.025em'
          }}>
            Налаштування
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.9375rem' }}>
            Керуйте налаштуваннями вашого облікового запису та системи
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '280px 1fr', 
          gap: '2rem',
          alignItems: 'start'
        }}>
          {/* Sidebar Navigation */}
          <div className="card" style={{ 
            padding: '0.75rem',
            position: 'sticky', 
            top: '80px' 
          }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    backgroundColor: activeTab === tab.id ? '#eff6ff' : 'transparent',
                    color: activeTab === tab.id ? '#2563eb' : '#4b5563',
                    fontSize: '0.9375rem',
                    fontWeight: activeTab === tab.id ? '500' : '400',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2 : 1.5} />
                  {tab.label}
                  <ChevronRight 
                    size={16} 
                    style={{ 
                      marginLeft: 'auto', 
                      opacity: activeTab === tab.id ? 1 : 0,
                      transition: 'opacity 0.15s ease'
                    }} 
                  />
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="card" style={{ padding: '2rem' }}>
            {/* General Settings */}
            {activeTab === 'general' && (
              <div>
                <h2 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#111827',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <SettingsIcon size={22} strokeWidth={1.5} />
                  Загальні налаштування
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="form-section" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Зовнішній вигляд
                    </h3>
                    
                    <div className="form-group">
                      <label className="form-label">Мова інтерфейсу</label>
                      <select 
                        className="form-select"
                        value={settings.language}
                        onChange={(e) => handleInputChange('language', e.target.value)}
                        style={{ maxWidth: '300px' }}
                      >
                        <option value="uk">Українська</option>
                        <option value="en">English</option>
                        <option value="ru">Русский</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Формат дати</label>
                      <select 
                        className="form-select"
                        value={settings.dateFormat}
                        onChange={(e) => handleInputChange('dateFormat', e.target.value)}
                        style={{ maxWidth: '300px' }}
                      >
                        <option value="DD.MM.YYYY">DD.MM.YYYY (15.02.2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (02/15/2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-02-15)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-section" style={{ marginBottom: 0, borderBottom: 'none' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Регіональні налаштування
                    </h3>
                    
                    <div className="form-group">
                      <label className="form-label">Валюта</label>
                      <select 
                        className="form-select"
                        value={settings.currency}
                        onChange={(e) => handleInputChange('currency', e.target.value)}
                        style={{ maxWidth: '300px' }}
                      >
                        <option value="UAH">UAH - Українська гривня</option>
                        <option value="USD">USD - Долар США</option>
                        <option value="EUR">EUR - Євро</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Часовий пояс</label>
                      <select 
                        className="form-select"
                        value={settings.timezone}
                        onChange={(e) => handleInputChange('timezone', e.target.value)}
                        style={{ maxWidth: '300px' }}
                      >
                        <option value="Europe/Kyiv">Europe/Kyiv (UTC+2)</option>
                        <option value="Europe/London">Europe/London (UTC+0)</option>
                        <option value="Europe/Warsaw">Europe/Warsaw (UTC+1)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Settings */}
            {activeTab === 'profile' && (
              <div>
                <h2 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#111827',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <User size={22} strokeWidth={1.5} />
                  Налаштування профілю
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="form-section" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Особиста інформація
                    </h3>
                    
                    <div className="form-group">
                      <label className="form-label">Ім'я користувача</label>
                      <input 
                        type="text" 
                        className="form-input"
                        value={settings.displayName}
                        onChange={(e) => handleInputChange('displayName', e.target.value)}
                        placeholder="Ваше ім'я"
                        style={{ maxWidth: '400px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input 
                        type="email" 
                        className="form-input"
                        value={settings.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="your@email.com"
                        style={{ maxWidth: '400px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Телефон</label>
                      <input 
                        type="tel" 
                        className="form-input"
                        value={settings.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+38 (0__) ___-__-__"
                        style={{ maxWidth: '400px' }}
                      />
                      <span className="form-hint">Формат: +380XXXXXXXXX</span>
                    </div>
                  </div>

                  <div className="form-section" style={{ marginBottom: 0, borderBottom: 'none' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Безпека
                    </h3>
                    
                    <button 
                      className="btn btn-secondary"
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => setShowPasswordModal(true)}
                    >
                      Змінити пароль
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notifications Settings */}
            {activeTab === 'notifications' && (
              <div>
                <h2 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#111827',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Bell size={22} strokeWidth={1.5} />
                  Налаштування сповіщень
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="form-section" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Канали сповіщень
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa'
                      }}>
                        <input 
                          type="checkbox"
                          checked={settings.emailNotifications}
                          onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            accentColor: '#3b82f6',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '0.9375rem' }}>
                            <Mail size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Email сповіщення
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            Отримуйте важливі сповіщення на email
                          </div>
                        </div>
                      </label>

                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa'
                      }}>
                        <input 
                          type="checkbox"
                          checked={settings.pushNotifications}
                          onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            accentColor: '#3b82f6',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '0.9375rem' }}>
                            Push-сповіщення
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            Миттєві сповіщення в браузері
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="form-section" style={{ marginBottom: 0, borderBottom: 'none' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Типи сповіщень
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa'
                      }}>
                        <input 
                          type="checkbox"
                          checked={settings.lessonReminders}
                          onChange={(e) => handleInputChange('lessonReminders', e.target.checked)}
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            accentColor: '#3b82f6',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '0.9375rem' }}>
                            <Clock size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                            Нагадування про заняття
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            Сповіщення перед початком занять
                          </div>
                        </div>
                      </label>

                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa'
                      }}>
                        <input 
                          type="checkbox"
                          checked={settings.paymentAlerts}
                          onChange={(e) => handleInputChange('paymentAlerts', e.target.checked)}
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            accentColor: '#3b82f6',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '0.9375rem' }}>
                            Сповіщення про платежі
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            Оплата, борги, фінансові сповіщення
                          </div>
                        </div>
                      </label>

                      <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem',
                        cursor: 'pointer',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa'
                      }}>
                        <input 
                          type="checkbox"
                          checked={settings.weeklyReport}
                          onChange={(e) => handleInputChange('weeklyReport', e.target.checked)}
                          style={{ 
                            width: '18px', 
                            height: '18px', 
                            accentColor: '#3b82f6',
                            cursor: 'pointer'
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', color: '#1f2937', fontSize: '0.9375rem' }}>
                            Тижневий звіт
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            Підсумок роботи за тиждень
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* System Settings */}
            {activeTab === 'system' && (
              <div>
                <h2 style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  color: '#111827',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Shield size={22} strokeWidth={1.5} />
                  Системні налаштування
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="form-section" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Системна інформація
                    </h3>
                    
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '1rem'
                    }}>
                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#f9fafb', 
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Версія системи
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                          ITRobotCRM v1.0.0
                        </div>
                      </div>

                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#f9fafb', 
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Роль користувача
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#111827' }}>
                          {user.role === 'admin' ? 'Адміністратор' : 'Викладач'}
                        </div>
                      </div>

                      <div style={{ 
                        padding: '1rem', 
                        backgroundColor: '#f9fafb', 
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          Статус системи
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#22c55e' }}>
                          Активна
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-section" style={{ marginBottom: 0, borderBottom: 'none' }}>
                    <h3 style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: '600', 
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Дані та резервне копіювання
                    </h3>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary">
                        <Database size={16} />
                        Експорт даних
                      </button>
                      <button className="btn btn-secondary">
                        Резервна копія
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div style={{ 
              marginTop: '2rem', 
              paddingTop: '1.5rem', 
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem'
            }}>
              <button 
                className="btn btn-secondary"
                onClick={() => window.location.reload()}
              >
                Скинути
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSave}
                style={{ minWidth: '120px' }}
              >
                <Save size={16} />
                {saved ? 'Збережено!' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 280px 1fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="position: sticky"] {
            position: relative !important;
            top: 0 !important;
          }
        }
      `}</style>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', margin: '1rem' }}>
            <div className="card-header" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '1rem 1.5rem'
            }}>
              <h3 className="card-title" style={{ margin: 0 }}>Зміна пароля</h3>
              <button 
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>
            <div className="card-body" style={{ padding: '1.5rem' }}>
              {passwordSuccess ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '2rem 0',
                  color: '#22c55e'
                }}>
                  <Shield size={48} style={{ marginBottom: '1rem' }} />
                  <p style={{ fontSize: '1.125rem', fontWeight: '600' }}>Пароль успішно змінено!</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Поточний пароль</label>
                    <input 
                      type="password" 
                      className="form-input"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Введіть поточний пароль"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Новий пароль</label>
                    <input 
                      type="password" 
                      className="form-input"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Мінімум 8 символів"
                    />
                    <span className="form-hint">Мінімум 8 символів</span>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Підтвердження пароля</label>
                    <input 
                      type="password" 
                      className="form-input"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Повторіть новий пароль"
                    />
                  </div>
                  
                  {passwordError && (
                    <div style={{
                      padding: '0.75rem',
                      marginBottom: '1rem',
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                    }}>
                      {passwordError}
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowPasswordModal(false);
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                        setPasswordError('');
                      }}
                    >
                      Скасувати
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={handlePasswordChange}
                      disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                    >
                      {passwordLoading ? 'Збереження...' : 'Змінити пароль'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
