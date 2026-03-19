'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Save,
  Cake,
  CheckCircle,
  Trash2,
  ExternalLink,
  DollarSign,
  Calculator,
  Shuffle,
} from 'lucide-react';
import { t } from '@/i18n/t';
import styles from './Navbar.module.css';
import TransitionLink from '@/components/TransitionLink';
import { useCalculator } from '@/components/CalculatorProvider';

// ─── Notification types ───────────────────────────────────────────────────────

interface AppNotification {
  id: number;
  type: 'birthday' | 'lesson_done' | string;
  title: string;
  body: string;
  link: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  is_read: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return 'щойно';
  if (diff < 3600)   return `${Math.floor(diff / 60)} хв тому`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} год тому`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} д тому`;
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
    osc.onended = () => ctx.close();
  } catch { /* silent if blocked by browser */ }
}

function NotifIcon({ type }: { type: string }) {
  const base: React.CSSProperties = {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };
  if (type === 'birthday') return (
    <div style={{ ...base, background: '#fef9c3' }}>
      <Cake size={16} style={{ color: '#ca8a04' }} />
    </div>
  );
  return (
    <div style={{ ...base, background: '#dcfce7' }}>
      <CheckCircle size={16} style={{ color: '#16a34a' }} />
    </div>
  );
}

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
  onMenuClick,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { calcOpen, toggleCalc } = useCalculator();
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [profilePhotoBase64, setProfilePhotoBase64] = useState<string | null>(null);
  const [dicebearSeed, setDicebearSeed] = useState<string>('');
  const [pendingDicebearSeed, setPendingDicebearSeed] = useState<string | null>(null);

  useEffect(() => {
    let seed = localStorage.getItem('itrobot-avatar-seed');
    if (!seed) {
      seed = Math.random().toString(36).slice(2);
      localStorage.setItem('itrobot-avatar-seed', seed);
    }
    setDicebearSeed(seed);
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      setPendingDicebearSeed(null);
    }
  }, [settingsOpen]);

  // ── Notifications state ────────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<number | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'profile' | 'notifications' | 'salary' | 'system' | 'users'>('general');
  const [settings, setSettings] = useState({
    displayName: user?.name || '',
    email: '',
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
    weatherCity: 'Kyiv',
  });
  const [saved, setSaved] = useState(false);
  const [salarySettings, setSalarySettings] = useState({ teacher_salary_group: '75', teacher_salary_individual: '100' });
  const [salarySaving, setSalarySaving] = useState(false);
  const [sysUsers, setSysUsers] = useState<{ id: number; name: string; email: string; role: string; is_active: boolean; is_owner: boolean; created_at: string }[]>([]);
  const [currentUserIsOwner, setCurrentUserIsOwner] = useState(false);
  const [sysUsersLoading, setSysUsersLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [createUserSaving, setCreateUserSaving] = useState(false);
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

  // ── Poll unread count every 60 s ──────────────────────────────────────────
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?count=true');
      if (res.ok) {
        const data = await res.json();
        const newCount = data.unreadCount ?? 0;
        setUnreadCount(newCount);
        // Play sound when new notifications arrive (skip on first load)
        if (prevUnreadRef.current !== null && newCount > prevUnreadRef.current) {
          playNotificationSound();
        }
        prevUnreadRef.current = newCount;
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // ── Close notification panel on outside click ─────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Clear all notifications for current user ──────────────────────────────
  const handleClearNotifications = async () => {
    setClearing(true);
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: true }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch { /* silent */ } finally {
      setClearing(false);
    }
  };

  // ── Open panel: fetch full list + mark all read ───────────────────────────
  const handleBellClick = async () => {
    if (notifOpen) { setNotifOpen(false); return; }
    setNotifOpen(true);
    setNotifLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        // Optimistically clear badge
        setUnreadCount(0);
        // Mark all as read server-side
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all: true }),
        }).catch(() => {/* silent */});
      }
    } catch { /* silent */ } finally {
      setNotifLoading(false);
    }
  };

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

  const handleSettingsSave = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch { /* silent */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSalarySave = async () => {
    setSalarySaving(true);
    try {
      await fetch('/api/system-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_salary_group: parseFloat(salarySettings.teacher_salary_group) || 75,
          teacher_salary_individual: parseFloat(salarySettings.teacher_salary_individual) || 100,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ } finally {
      setSalarySaving(false);
    }
  };

  // Load users when users tab is active
  useEffect(() => {
    if (!settingsOpen || activeSettingsTab !== 'users') return;
    setSysUsersLoading(true);
    fetch('/api/users')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.users) setSysUsers(d.users); })
      .catch(() => {})
      .finally(() => setSysUsersLoading(false));
  }, [settingsOpen, activeSettingsTab]);

  const handleCreateUser = async () => {
    if (!createUserForm.name.trim() || !createUserForm.email.trim() || !createUserForm.password.trim()) return;
    setCreateUserSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createUserForm),
      });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error || 'Помилка');
        return;
      }
      setShowCreateUser(false);
      setCreateUserForm({ name: '', email: '', password: '', role: 'teacher' });
      const r = await fetch('/api/users');
      if (r.ok) { const d = await r.json(); setSysUsers(d.users || []); }
    } catch { /* silent */ } finally {
      setCreateUserSaving(false);
    }
  };

  // Load current user info (photo, is_owner) on mount and when settings open
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) return;
        if (d.user.photo_url) setUserPhotoUrl(d.user.photo_url);
        if (d.user.is_owner) setCurrentUserIsOwner(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.user) return;
        if (d.user.photo_url) setUserPhotoUrl(d.user.photo_url);
        if (d.user.is_owner) setCurrentUserIsOwner(true);
      })
      .catch(() => {});
  }, [settingsOpen]);

  const randomizeDicebear = () => {
    const seed = Math.random().toString(36).slice(2);
    setPendingDicebearSeed(seed);
  };

  const dicebearUrl = (seed: string, fallbackName: string) =>
    `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(seed || fallbackName)}`;

  const handleProfilePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setProfilePhotoPreview(base64);
      setProfilePhotoBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.displayName || undefined,
          phone: settings.phone || undefined,
          photo: profilePhotoBase64 || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || 'Помилка'); return; }
      if (d.user?.photo_url) {
        setUserPhotoUrl(d.user.photo_url);
        setProfilePhotoPreview(null);
        setProfilePhotoBase64(null);
      }
      if (pendingDicebearSeed) {
        setDicebearSeed(pendingDicebearSeed);
        localStorage.setItem('itrobot-avatar-seed', pendingDicebearSeed);
        setPendingDicebearSeed(null);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silent */ } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Видалити користувача? Цю дію неможливо скасувати.')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Помилка'); return; }
    setSysUsers(prev => prev.filter(u => u.id !== id));
  };

  // Load settings when panel opens
  useEffect(() => {
    if (!settingsOpen) return;
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.settings) setSettings(prev => ({ ...prev, ...d.settings }));
      })
      .catch(() => {});
    fetch('/api/system-settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setSalarySettings({
          teacher_salary_group: String(d.teacher_salary_group ?? 75),
          teacher_salary_individual: String(d.teacher_salary_individual ?? 100),
        });
      })
      .catch(() => {});
  }, [settingsOpen]);

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
            {/* Calculator Button */}
            <button
              className={styles.iconButton}
              title="Калькулятор"
              onClick={toggleCalc}
              style={calcOpen ? { color: '#2563eb' } : undefined}
            >
              <Calculator size={20} strokeWidth={1.5} />
            </button>

            {/* Settings Modal Button */}
            <button
              className={styles.iconButton}
              title={t('nav.settings')}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={20} strokeWidth={1.5} />
            </button>

            {/* Notifications */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className={styles.iconButton}
                title={t('notifications.title')}
                onClick={handleBellClick}
              >
                <Bell size={20} strokeWidth={1.5} />
                {unreadCount > 0 && (
                  <span className={styles.notificationBadge}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification panel */}
              {notifOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '380px',
                  maxWidth: 'calc(100vw - 1rem)',
                  maxHeight: '520px',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
                  border: '1px solid #e5e7eb',
                  zIndex: 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  {/* Panel header */}
                  <div style={{
                    padding: '0.875rem 1.125rem',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fafafa',
                    gap: '0.5rem',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', flex: 1 }}>
                      Сповіщення
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearNotifications}
                        disabled={clearing}
                        title="Очистити сповіщення"
                        style={{
                          background: 'none', border: 'none', cursor: clearing ? 'not-allowed' : 'pointer',
                          color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem',
                          padding: '2px 4px', borderRadius: '4px', fontSize: '0.75rem',
                          opacity: clearing ? 0.5 : 1,
                        }}
                        onMouseEnter={e => { if (!clearing) e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
                      >
                        <Trash2 size={14} />
                        Очистити
                      </button>
                    )}
                    <button
                      onClick={() => setNotifOpen(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: '2px' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Panel body */}
                  <div style={{ overflow: 'auto', flex: 1 }}>
                    {notifLoading ? (
                      <div style={{ padding: '2.5rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                        Завантаження...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                        <Bell size={28} style={{ color: '#d1d5db', marginBottom: '0.5rem' }} />
                        <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Немає сповіщень</div>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <a
                          key={n.id}
                          href={n.link ?? undefined}
                          onClick={() => setNotifOpen(false)}
                          style={{
                            display: 'flex',
                            gap: '0.75rem',
                            padding: '0.75rem 1.125rem',
                            borderBottom: '1px solid #f9fafb',
                            background: n.is_read ? 'white' : '#f0f9ff',
                            textDecoration: 'none',
                            transition: 'background 0.1s ease',
                            cursor: n.link ? 'pointer' : 'default',
                            alignItems: 'flex-start',
                          }}
                          onMouseEnter={e => { if (n.link) e.currentTarget.style.background = '#f3f4f6'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = n.is_read ? 'white' : '#f0f9ff'; }}
                        >
                          <NotifIcon type={n.type} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              color: '#111827',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.5rem',
                            }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {n.title}
                              </span>
                              <span style={{ fontSize: '0.6875rem', color: '#9ca3af', flexShrink: 0 }}>
                                {timeAgo(n.created_at)}
                              </span>
                            </div>
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              marginTop: '0.125rem',
                              whiteSpace: 'pre-line',
                              lineHeight: 1.5,
                            }}>
                              {n.body}
                            </div>
                          </div>
                          {n.type === 'lesson_done' && !!n.data?.lessonId && (
                            <button
                              title="Відкрити заняття"
                              onClick={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                setNotifOpen(false);
                                window.dispatchEvent(new CustomEvent('itrobot-open-lesson', {
                                  detail: { lessonId: Number(n.data!.lessonId) },
                                }));
                              }}
                              style={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 26,
                                height: 26,
                                borderRadius: '0.375rem',
                                border: '1px solid #e5e7eb',
                                background: 'white',
                                cursor: 'pointer',
                                color: '#6b7280',
                                padding: 0,
                                marginTop: 2,
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#eff6ff';
                                e.currentTarget.style.color = '#2563eb';
                                e.currentTarget.style.borderColor = '#bfdbfe';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'white';
                                e.currentTarget.style.color = '#6b7280';
                                e.currentTarget.style.borderColor = '#e5e7eb';
                              }}
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                          {!n.is_read && (
                            <div style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: '#3b82f6', flexShrink: 0, marginTop: 6,
                            }} />
                          )}
                        </a>
                      ))
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* User block with dropdown */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button 
                className={styles.userBlock}
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className={styles.userAvatar}>
                  <img
                    src={userPhotoUrl || dicebearUrl(dicebearSeed, userName)}
                    alt={userName}
                  />
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{userName}</span>
                  <span className={styles.userRole}>{userRole}</span>
                </div>
                <ChevronDown size={14} className={styles.userChevron} />
              </button>

              {dropdownOpen && (
                <div className={styles.dropdown}>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => { setDropdownOpen(false); setSettingsOpen(true); setActiveSettingsTab('profile'); }}
                  >
                    <User size={16} />
                    Мій профіль
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
                {([
                  { id: 'general', label: 'Загальні' },
                  { id: 'profile', label: 'Профіль' },
                  { id: 'notifications', label: 'Сповіщення' },
                  { id: 'salary', label: 'Ціни та зарплата' },
                  { id: 'system', label: 'Система' },
                  ...(user?.role === 'admin' ? [{ id: 'users', label: 'Користувачі' }] : []),
                ] as { id: string; label: string }[]).map((tab) => (
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Weather widget */}
                    <div>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Віджет погоди
                      </h3>
                      <div className="form-group">
                        <label className="form-label">Місто</label>
                        <input
                          type="text"
                          className="form-input"
                          value={settings.weatherCity}
                          onChange={e => handleSettingChange('weatherCity', e.target.value)}
                          placeholder="Kyiv, Kharkiv, Lviv..."
                          style={{ maxWidth: '280px' }}
                        />
                        <span className="form-hint">Назва міста англійською</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* Profile Tab */}
                {activeSettingsTab === 'profile' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Avatar upload */}
                    <div>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Фото профілю</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ width: 80, height: 80, borderRadius: 16, overflow: 'hidden', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #e5e7eb' }}>
                          <img
                            src={profilePhotoPreview || userPhotoUrl || dicebearUrl(pendingDicebearSeed ?? dicebearSeed, userName)}
                            alt="avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#374151', lineHeight: 1 }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                            >
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoSelect} />
                              Вибрати фото
                            </label>
                            {!userPhotoUrl && !profilePhotoPreview && (
                              <button
                                onClick={randomizeDicebear}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0.625rem', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem', lineHeight: 1, boxSizing: 'border-box' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                                title="Інший робот"
                              >
                                <Shuffle size={15} />
                              </button>
                            )}
                          </div>
                          {profilePhotoPreview && (
                            <button onClick={() => { setProfilePhotoPreview(null); setProfilePhotoBase64(null); }}
                              style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#64748b' }}>
                              Скасувати
                            </button>
                          )}
                          {!profilePhotoPreview && userPhotoUrl && (
                            <button
                              onClick={async () => {
                                if (!confirm('Видалити фото профілю?')) return;
                                await fetch('/api/auth/profile', { method: 'DELETE' });
                                setUserPhotoUrl(null);
                              }}
                              style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#ef4444' }}
                            >
                              Видалити фото
                            </button>
                          )}
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.4rem 0 0' }}>JPG, PNG — до 5 МБ</p>
                        </div>
                      </div>
                    </div>

                    {/* Info fields */}
                    <div>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Особиста інформація</h3>
                      <div className="form-group">
                        <label className="form-label">Ім'я</label>
                        <input type="text" className="form-input" value={settings.displayName}
                          onChange={e => handleSettingChange('displayName', e.target.value)} style={{ maxWidth: '360px' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" value={settings.email} disabled
                          style={{ maxWidth: '360px', opacity: 0.6 }} />
                        <span className="form-hint">Email змінювати не можна</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Телефон</label>
                        <input type="tel" className="form-input" value={settings.phone}
                          onChange={e => handleSettingChange('phone', e.target.value)}
                          placeholder="+38 (0__) ___-__-__" style={{ maxWidth: '360px' }} />
                      </div>
                    </div>

                    {/* Save */}
                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-primary" onClick={handleProfileSave} disabled={profileSaving} style={{ minWidth: 120 }}>
                        <Save size={14} />
                        {profileSaving ? 'Збереження...' : saved ? 'Збережено!' : 'Зберегти'}
                      </button>
                    </div>
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

                {/* Salary Tab */}
                {activeSettingsTab === 'salary' && (
                  <div>
                    <h3 style={{
                      fontSize: '0.8125rem', fontWeight: '600', color: '#374151',
                      marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}>
                      <DollarSign size={14} />
                      Зарплата викладачів
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '1.25rem' }}>
                      Ставка за <b>1 дитину</b> на одному занятті
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '400px', marginBottom: '1.25rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Групове заняття (₴)</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={1}
                          value={salarySettings.teacher_salary_group}
                          onChange={e => setSalarySettings(prev => ({ ...prev, teacher_salary_group: e.target.value }))}
                        />
                        <span className="form-hint">₴ за 1 учня</span>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Індивідуальне (₴)</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={1}
                          value={salarySettings.teacher_salary_individual}
                          onChange={e => setSalarySettings(prev => ({ ...prev, teacher_salary_individual: e.target.value }))}
                        />
                        <span className="form-hint">₴ за 1 учня</span>
                      </div>
                    </div>

                    <div style={{
                      padding: '0.875rem 1rem',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: '0.5rem',
                      fontSize: '0.8125rem',
                      color: '#0369a1',
                      maxWidth: '400px',
                      marginBottom: '1.25rem',
                      lineHeight: 1.5,
                    }}>
                      <b>Приклад:</b> Групове заняття з 5 дітей → {parseFloat(salarySettings.teacher_salary_group) || 0} × 5 = <b>{((parseFloat(salarySettings.teacher_salary_group) || 0) * 5).toFixed(0)} ₴</b>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={handleSalarySave}
                      disabled={salarySaving}
                    >
                      <Save size={14} />
                      {salarySaving ? 'Збереження...' : 'Зберегти тарифи'}
                    </button>
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

                {/* Users Tab */}
                {activeSettingsTab === 'users' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#374151', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Користувачі системи
                      </h3>
                      <button
                        className="btn btn-primary"
                        onClick={() => { setShowCreateUser(v => !v); setCreateUserForm({ name: '', email: '', password: '', role: 'admin' }); }}
                        style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }}
                      >
                        + Новий користувач
                      </button>
                    </div>

                    {/* Create User Form */}
                    {showCreateUser && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Ім'я *</label>
                            <input type="text" className="form-input" value={createUserForm.name} onChange={e => setCreateUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Ім'я користувача" />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Email *</label>
                            <input type="email" className="form-input" value={createUserForm.email} onChange={e => setCreateUserForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                          </div>
                          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                            <label className="form-label">Пароль *</label>
                            <input type="password" className="form-input" value={createUserForm.password} onChange={e => setCreateUserForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" style={{ maxWidth: '50%' }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" onClick={() => setShowCreateUser(false)} style={{ fontSize: '0.8125rem' }}>Скасувати</button>
                          <button
                            className="btn btn-primary"
                            onClick={handleCreateUser}
                            disabled={createUserSaving || !createUserForm.name.trim() || !createUserForm.email.trim() || !createUserForm.password.trim()}
                            style={{ fontSize: '0.8125rem' }}
                          >
                            {createUserSaving ? 'Збереження...' : 'Створити'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Users Table */}
                    {sysUsersLoading ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Завантаження...</div>
                    ) : sysUsers.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Користувачів не знайдено</div>
                    ) : (
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                              {['Ім\'я', 'Email', 'Статус', 'Створено', ...(currentUserIsOwner ? ['Дії'] : [])].map((h) => (
                                <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h !== 'Дії' ? h : ''}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sysUsers.map((u, i) => (
                              <tr key={u.id} style={{ borderBottom: i < sysUsers.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                <td style={{ padding: '0.625rem 0.875rem', fontWeight: 500, color: '#1e293b' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {u.name}
                                    {u.is_owner && (
                                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: '#fef3c7', color: '#92400e' }}>owner</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '0.625rem 0.875rem', color: '#64748b' }}>{u.email}</td>
                                <td style={{ padding: '0.625rem 0.875rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: u.is_active ? '#f0fdf4' : '#fef2f2', color: u.is_active ? '#16a34a' : '#dc2626' }}>
                                    {u.is_active ? 'Активний' : 'Неактивний'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.625rem 0.875rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
                                  {new Date(u.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </td>
                                {currentUserIsOwner && (
                                  <td style={{ padding: '0.625rem 0.875rem' }}>
                                    {!u.is_owner && (
                                      <button
                                        onClick={() => handleDeleteUser(u.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '3px 6px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500 }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                        title="Видалити користувача"
                                      >
                                        Видалити
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Save Button — hidden on users and profile tabs */}
                {activeSettingsTab !== 'users' && activeSettingsTab !== 'profile' && (
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
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Navbar;
