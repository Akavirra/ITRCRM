'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  Settings, 
  Bell, 
  Search, 
  ChevronDown,
  LogOut,
  User,
  Keyboard,
  Menu,
  X,
  Save
} from 'lucide-react';
import { t } from '@/i18n/t';
import styles from './Navbar.module.css';
import TransitionLink from '@/components/TransitionLink';

interface NavbarProps {
  user?: {
    name: string;
    role: string;
  };
  withSidebar?: boolean;
  notificationCount?: number;
  onMenuClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  user, 
  withSidebar = false,
  notificationCount = 3,
  onMenuClick
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'profile' | 'notifications' | 'system'>('general');
  const [settings, setSettings] = useState({
    displayName: user?.name || '',
    email: user?.name || '',
    phone: '',
    emailNotifications: true,
    pushNotifications: true,
    lessonReminders: true,
    paymentAlerts: true,
    weeklyReport: true,
    language: 'uk',
    timezone: 'Europe/Kyiv',
    dateFormat: 'DD.MM.YYYY',
    currency: 'UAH',
  });
  const [saved, setSaved] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for search (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSettingsSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSettingChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const userName = user?.name || 'Максим П.';
  const userRole = user?.role === 'admin' ? t('roles.admin') : t('roles.teacher');

  return (
    <>
      <nav className={`${styles.navbar} ${withSidebar ? styles.navbarWithSidebar : ''}`}>
        <div className={styles.navbarInner}>
          {/* Left section - Menu button + Home */}
          <div className={styles.navbarLeft}>
            {withSidebar && (
              <button 
                className={styles.homeButton} 
                onClick={onMenuClick}
                title="Меню"
              >
                <Menu size={20} strokeWidth={1.5} />
              </button>
            )}
            <TransitionLink href="/dashboard" className={styles.homeButton} title={t('nav.dashboard')}>
              <Home size={20} strokeWidth={1.5} />
            </TransitionLink>
          </div>

          {/* Center section - Search */}
          <div className={styles.navbarCenter}>
            <div className={styles.searchContainer}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t('search.placeholder') || 'Пошук по системі...'}
              />
              <div className={styles.searchHint}>
                <Keyboard size={10} />
                <kbd>Ctrl</kbd>
                <kbd>K</kbd>
              </div>
            </div>
          </div>

          {/* Right section */}
          <div className={styles.navbarRight}>
            {/* Settings Modal Button */}
            <button 
              className={styles.iconButton} 
              title={t('nav.settings')}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={20} strokeWidth={1.5} />
            </button>

            {/* Notifications */}
            <button className={styles.iconButton} title={t('notifications.title')}>
              <Bell size={20} strokeWidth={1.5} />
              {notificationCount > 0 && (
                <span className={styles.notificationBadge}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>

            {/* User block with dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button 
                className={styles.userBlock}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className={styles.userAvatar}>
                  <User size={18} strokeWidth={2} />
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{userName}</span>
                  <span className={styles.userRole}>{userRole}</span>
                </div>
                <ChevronDown size={14} className={styles.userChevron} />
              </button>

              {dropdownOpen && (
                <div className={styles.dropdown}>
                  <button className={styles.dropdownItem}>
                    <User size={16} />
                    {t('profile.title') || 'Профіль'}
                  </button>
                  <button 
                    className={`${styles.dropdownItem} ${styles.danger}`}
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    {t('actions.logout') || 'Вийти'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Settings Modal */}
      {settingsOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={() => setSettingsOpen(false)}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
          <div 
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '900px',
              maxWidth: '95vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <Settings size={20} strokeWidth={1.5} />
                Налаштування
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: '#64748b',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }}
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '220px 1fr',
              flex: 1,
              overflow: 'hidden',
            }}>
              {/* Sidebar */}
              <div style={{
                padding: '1rem',
                borderRight: '1px solid #e5e7eb',
                backgroundColor: '#fafafa',
                overflow: 'auto',
              }}>
                {[
                  { id: 'general', label: 'Загальні' },
                  { id: 'profile', label: 'Профіль' },
                  { id: 'notifications', label: 'Сповіщення' },
                  { id: 'system', label: 'Система' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSettingsTab(tab.id as typeof activeSettingsTab)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      marginBottom: '0.25rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      backgroundColor: activeSettingsTab === tab.id ? '#eff6ff' : 'transparent',
                      color: activeSettingsTab === tab.id ? '#2563eb' : '#4b5563',
                      fontSize: '0.9375rem',
                      fontWeight: activeSettingsTab === tab.id ? '500' : '400',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content Area */}
              <div style={{
                padding: '1.5rem',
                overflow: 'auto',
                backgroundColor: '#fafbfc',
              }}>
                {/* General Tab */}
                {activeSettingsTab === 'general' && (
                  <div>
                    <h3 style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Загальні налаштування</h3>
                    
                    <p style={{ color: '#6b7280', fontSize: '0.9375rem', marginBottom: '1rem' }}>
                      Тут буде загальна інформація про систему.
                    </p>
                  </div>
                )}

                {/* Profile Tab */}
                {activeSettingsTab === 'profile' && (
                  <div>
                    <h3 style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Особиста інформація</h3>
                    
                    <div className="form-group">
                      <label className="form-label">Ім'я користувача</label>
                      <input 
                        type="text" 
                        className="form-input"
                        value={settings.displayName}
                        onChange={(e) => handleSettingChange('displayName', e.target.value)}
                        style={{ maxWidth: '400px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input 
                        type="email" 
                        className="form-input"
                        value={settings.email}
                        onChange={(e) => handleSettingChange('email', e.target.value)}
                        style={{ maxWidth: '400px' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Телефон</label>
                      <input 
                        type="tel" 
                        className="form-input"
                        value={settings.phone}
                        onChange={(e) => handleSettingChange('phone', e.target.value)}
                        placeholder="+38 (0__) ___-__-__"
                        style={{ maxWidth: '400px' }}
                      />
                    </div>

                    <h3 style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginTop: '1.5rem',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Безпека</h3>
                    
                    <button className="btn btn-secondary">
                      Змінити пароль
                    </button>
                  </div>
                )}

                {/* Notifications Tab */}
                {activeSettingsTab === 'notifications' && (
                  <div>
                    <h3 style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Канали сповіщень</h3>
                    
                    {[
                      { key: 'emailNotifications', label: 'Email сповіщення', desc: 'Отримуйте сповіщення на email' },
                      { key: 'pushNotifications', label: 'Push-сповіщення', desc: 'Миттєві сповіщення в браузері' },
                    ].map((item) => (
                      <label key={item.key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa',
                        cursor: 'pointer',
                      }}>
                        <input 
                          type="checkbox"
                          checked={settings[item.key as keyof typeof settings] as boolean}
                          onChange={(e) => handleSettingChange(item.key, e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }}
                        />
                        <div>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>{item.label}</div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{item.desc}</div>
                        </div>
                      </label>
                    ))}

                    <h3 style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginTop: '1.5rem',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Типи сповіщень</h3>
                    
                    {[
                      { key: 'lessonReminders', label: 'Нагадування про заняття', desc: 'Перед початком занять' },
                      { key: 'paymentAlerts', label: 'Сповіщення про платежі', desc: 'Оплата та борги' },
                      { key: 'weeklyReport', label: 'Тижневий звіт', desc: 'Підсумок роботи за тиждень' },
                    ].map((item) => (
                      <label key={item.key} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        marginBottom: '0.5rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e5e7eb',
                        backgroundColor: '#fafafa',
                        cursor: 'pointer',
                      }}>
                        <input 
                          type="checkbox"
                          checked={settings[item.key as keyof typeof settings] as boolean}
                          onChange={(e) => handleSettingChange(item.key, e.target.checked)}
                          style={{ width: '18px', height: '18px', accentColor: '#3b82f6' }}
                        />
                        <div>
                          <div style={{ fontWeight: '500', color: '#1f2937' }}>{item.label}</div>
                          <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{item.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* System Tab */}
                {activeSettingsTab === 'system' && (
                  <div>
                    <h3 style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Системна інформація</h3>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.5rem',
                    }}>
                      {[
                        { label: 'Версія системи', value: 'ITRobotCRM v1.0.0' },
                        { label: 'Роль користувача', value: user?.role === 'admin' ? 'Адміністратор' : 'Викладач' },
                        { label: 'Статус', value: 'Активна', color: '#22c55e' },
                      ].map((item, i) => (
                        <div key={i} style={{
                          padding: '1rem',
                          backgroundColor: '#f9fafb',
                          borderRadius: '0.5rem',
                          border: '1px solid #e5e7eb',
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                            {item.label}
                          </div>
                          <div style={{ fontSize: '1rem', fontWeight: '600', color: item.color || '#111827' }}>
                            {item.value}
                          </div>
                        </div>
                      ))}
                    </div>

                    <h3 style={{
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      color: '#374151',
                      marginTop: '1.5rem',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>Дані</h3>
                    
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary">Експорт даних</button>
                      <button className="btn btn-secondary">Резервна копія</button>
                    </div>
                  </div>
                )}

                {/* Save Button */}
                <div style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setSettingsOpen(false)}
                  >
                    Скасувати
                  </button>
                  <button 
                    className="btn btn-primary"
                    onClick={handleSettingsSave}
                    style={{ minWidth: '120px' }}
                  >
                    <Save size={16} />
                    {saved ? 'Збережено!' : 'Зберегти'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
