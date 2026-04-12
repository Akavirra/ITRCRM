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
  NotebookPen,
} from 'lucide-react';
import { t } from '@/i18n/t';
import styles from './Navbar.module.css';
import TransitionLink from '@/components/TransitionLink';
import { useCalculator } from '@/components/CalculatorProvider';
import { useNotes } from '@/components/NotesProvider';
import GlobalSearch from '@/components/GlobalSearch/GlobalSearch';

// в”Ђв”Ђв”Ђ Notification types в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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
  if (diff < 60)     return 'С‰РѕР№РЅРѕ';
  if (diff < 3600)   return `${Math.floor(diff / 60)} С…РІ С‚РѕРјСѓ`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} РіРѕРґ С‚РѕРјСѓ`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} Рґ С‚РѕРјСѓ`;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { calcOpen, toggleCalc } = useCalculator();
  const { notesOpen, toggleNotes } = useNotes();
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [profilePhotoBase64, setProfilePhotoBase64] = useState<string | null>(null);
  const [dicebearSeed, setDicebearSeed] = useState<string>('');
  const [pendingDicebearSeed, setPendingDicebearSeed] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    try {
      let seed = localStorage.getItem('itrobot-avatar-seed');
      if (!seed) {
        seed = Math.random().toString(36).slice(2);
        localStorage.setItem('itrobot-avatar-seed', seed);
      }
      setDicebearSeed(seed);
    } catch (e) {
      console.warn('LocalStorage blocked or unavailable:', e);
      setDicebearSeed('default-seed');
    }
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      setPendingDicebearSeed(null);
    }
  }, [settingsOpen]);

  // в”Ђв”Ђ Notifications state в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasBirthday, setHasBirthday] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<number | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'general' | 'profile' | 'notifications' | 'salary' | 'system' | 'users'>('general');
  const [settings, setSettings] = useState({
    displayName: user?.name || '',
    email: '',
    phone: '',
    telegram_id: '',
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
  const [salarySettings, setSalarySettings] = useState({
    teacher_salary_group: '75',
    teacher_salary_individual: '100',
    lesson_price: '300',
    individual_lesson_price: '300',
  });
  const [salarySaving, setSalarySaving] = useState(false);
  const [sysUsers, setSysUsers] = useState<{ id: number; name: string; email: string; role: string; is_active: boolean; is_owner: boolean; created_at: string }[]>([]);
  const [currentUserIsOwner, setCurrentUserIsOwner] = useState(false);
  const [sysUsersLoading, setSysUsersLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [createUserSaving, setCreateUserSaving] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ name: string; password: string; copied: boolean } | null>(null);
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

  // в”Ђв”Ђ Poll unread count every 60 s в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  const broadcastNotificationState = useCallback((nextUnreadCount: number, nextHasBirthday: boolean) => {
    window.dispatchEvent(new CustomEvent('app:notifications-updated', {
      detail: {
        unreadCount: nextUnreadCount,
        hasBirthday: nextHasBirthday,
      },
    }));
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (document.hidden) {
      return;
    }

    try {
      const res = await fetch('/api/notifications?count=true');
      if (res.ok) {
        const data = await res.json();
        const newCount = data.unreadCount ?? 0;
        const nextHasBirthday = Boolean(data.hasBirthday);
        setUnreadCount(newCount);
        setHasBirthday(nextHasBirthday);
        broadcastNotificationState(newCount, nextHasBirthday);
        // Play sound when new notifications arrive (skip on first load)
        if (prevUnreadRef.current !== null && newCount > prevUnreadRef.current) {
          playNotificationSound();
        }
        prevUnreadRef.current = newCount;
      }
    } catch { /* silent */ }
  }, [broadcastNotificationState]);

  useEffect(() => {
    void fetchUnreadCount();

    const interval = setInterval(() => {
      void fetchUnreadCount();
    }, 30_000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void fetchUnreadCount();
      }
    };

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUnreadCount]);

  // в”Ђв”Ђ Close notification panel on outside click в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // в”Ђв”Ђ Clear all notifications for current user в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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
      broadcastNotificationState(0, hasBirthday);
    } catch { /* silent */ } finally {
      setClearing(false);
    }
  };

  // в”Ђв”Ђ Open panel: fetch full list + mark all read в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
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
        broadcastNotificationState(0, hasBirthday);
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
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault();
        searchInputRef.current?.focus();
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
          lesson_price: parseInt(salarySettings.lesson_price) || 300,
          individual_lesson_price: parseInt(salarySettings.individual_lesson_price) || 300,
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
        alert(d.error || 'РџРѕРјРёР»РєР°');
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
        setSettings(prev => ({
          ...prev,
          displayName: d.user.name || prev.displayName,
          email: d.user.email || prev.email,
          phone: d.user.phone || '',
          telegram_id: d.user.telegram_id || '',
        }));
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
          telegram_id: settings.telegram_id ?? undefined,
          photo: profilePhotoBase64 || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || 'РџРѕРјРёР»РєР°'); return; }
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

  const handlePasswordInputChange = (field: 'currentPassword' | 'newPassword' | 'confirmPassword', value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
    setPasswordMessage(null);
    setPasswordError(null);
  };

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordMessage(null);
    setPasswordError(null);
  };

  const handlePasswordSave = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Р—Р°РїРѕРІРЅС–С‚СЊ СѓСЃС– РїРѕР»СЏ РґР»СЏ Р·РјС–РЅРё РїР°СЂРѕР»СЏ');
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage(null);
    setPasswordError(null);

    try {
      const res = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      });
      const d = await res.json();

      if (!res.ok) {
        setPasswordError(d.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·РјС–РЅРёС‚Рё РїР°СЂРѕР»СЊ');
        return;
      }

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordMessage(d.message || 'РџР°СЂРѕР»СЊ СѓСЃРїС–С€РЅРѕ Р·РјС–РЅРµРЅРѕ');
    } catch {
      setPasswordError('РќРµ РІРґР°Р»РѕСЃСЏ Р·РјС–РЅРёС‚Рё РїР°СЂРѕР»СЊ');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Р’РёРґР°Р»РёС‚Рё РєРѕСЂРёСЃС‚СѓРІР°С‡Р°? Р¦СЋ РґС–СЋ РЅРµРјРѕР¶Р»РёРІРѕ СЃРєР°СЃСѓРІР°С‚Рё.')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'РџРѕРјРёР»РєР°'); return; }
    setSysUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleResetUserPassword = async (id: number, name: string) => {
    const manualPassword = window.prompt(
      `Р’РєР°Р¶С–С‚СЊ С‚РёРјС‡Р°СЃРѕРІРёР№ РїР°СЂРѕР»СЊ РґР»СЏ "${name}".\nР—Р°Р»РёС€С‚Рµ РїРѕР»Рµ РїРѕСЂРѕР¶РЅС–Рј, СЏРєС‰Рѕ С…РѕС‡РµС‚Рµ Р·РіРµРЅРµСЂСѓРІР°С‚Рё РїР°СЂРѕР»СЊ Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ.`,
      ''
    );

    if (manualPassword === null) return;

    setResettingUserId(id);
    try {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temporaryPassword: manualPassword.trim() }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || 'РџРѕРјРёР»РєР°'); return; }
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(d.temporaryPassword);
          copied = true;
        } catch {
          copied = false;
        }
      }
      setResetPasswordResult({
        name,
        password: d.temporaryPassword,
        copied,
      });
    } catch {
      alert('РќРµ РІРґР°Р»РѕСЃСЏ СЃРєРёРЅСѓС‚Рё РїР°СЂРѕР»СЊ');
    } finally {
      setResettingUserId(null);
    }
  };

  const handleCopyTemporaryPassword = async () => {
    if (!resetPasswordResult) return;

    try {
      await navigator.clipboard.writeText(resetPasswordResult.password);
      setResetPasswordResult(prev => prev ? { ...prev, copied: true } : prev);
    } catch {
      alert('РќРµ РІРґР°Р»РѕСЃСЏ СЃРєРѕРїС–СЋРІР°С‚Рё РїР°СЂРѕР»СЊ');
    }
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
        const systemSettings = d?.settings || d || {};
        if (d) setSalarySettings({
          teacher_salary_group: String(systemSettings.teacher_salary_group ?? 75),
          teacher_salary_individual: String(systemSettings.teacher_salary_individual ?? 100),
          lesson_price: String(systemSettings.lesson_price ?? 300),
          individual_lesson_price: String(systemSettings.individual_lesson_price ?? systemSettings.lesson_price ?? 300),
        });
      })
      .catch(() => {});
  }, [settingsOpen]);

  const handleSettingChange = (field: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const userName = user?.name || 'РњР°РєСЃРёРј Рџ.';
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
                title="РњРµРЅСЋ"
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
                id="global-search-input"
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder={t('search.placeholder') || 'РџРѕС€СѓРє РїРѕ СЃРёСЃС‚РµРјС–...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                autoComplete="off"
                spellCheck={false}
              />
              {!searchFocused && !searchQuery && (
                <div className={styles.searchHint}>
                  <Keyboard size={10} />
                  <kbd>Ctrl</kbd>
                  <kbd>K</kbd>
                </div>
              )}
              <GlobalSearch
                query={searchQuery}
                inputFocused={searchFocused}
                onClose={() => { setSearchQuery(''); setSearchFocused(false); searchInputRef.current?.blur(); }}
              />
            </div>
          </div>

          {/* Right section */}
          <div className={styles.navbarRight}>
            {/* Notes Button */}
            <button
              className={styles.iconButton}
              title="Р—Р°РїРёСЃРЅРёРє"
              onClick={toggleNotes}
              style={notesOpen ? { color: '#2563eb' } : undefined}
            >
              <NotebookPen size={20} strokeWidth={1.5} />
            </button>

            {/* Calculator Button */}
            <button
              className={styles.iconButton}
              title="РљР°Р»СЊРєСѓР»СЏС‚РѕСЂ"
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
                      РЎРїРѕРІС–С‰РµРЅРЅСЏ
                    </span>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleClearNotifications}
                        disabled={clearing}
                        title="РћС‡РёСЃС‚РёС‚Рё СЃРїРѕРІС–С‰РµРЅРЅСЏ"
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
                        РћС‡РёСЃС‚РёС‚Рё
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
                        Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                        <Bell size={28} style={{ color: '#d1d5db', marginBottom: '0.5rem' }} />
                        <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>РќРµРјР°С” СЃРїРѕРІС–С‰РµРЅСЊ</div>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <TransitionLink
                          key={n.id}
                          href={n.link || '/dashboard'}
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
                              title="Р’С–РґРєСЂРёС‚Рё Р·Р°РЅСЏС‚С‚СЏ"
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
                        </TransitionLink>
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
                    РњС–Р№ РїСЂРѕС„С–Р»СЊ
                  </button>
                  <button
                    className={`${styles.dropdownItem} ${styles.danger}`}
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    {t('actions.logout') || 'Р’РёР№С‚Рё'}
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
                РќР°Р»Р°С€С‚СѓРІР°РЅРЅСЏ
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
                  { id: 'general', label: 'Р—Р°РіР°Р»СЊРЅС–' },
                  { id: 'profile', label: 'РџСЂРѕС„С–Р»СЊ' },
                  { id: 'notifications', label: 'РЎРїРѕРІС–С‰РµРЅРЅСЏ' },
                  { id: 'salary', label: 'Р¦С–РЅРё С‚Р° Р·Р°СЂРїР»Р°С‚Р°' },
                  { id: 'system', label: 'РЎРёСЃС‚РµРјР°' },
                  ...(user?.role === 'admin' ? [{ id: 'users', label: 'РљРѕСЂРёСЃС‚СѓРІР°С‡С–' }] : []),
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
                        Р’С–РґР¶РµС‚ РїРѕРіРѕРґРё
                      </h3>
                      <div className="form-group">
                        <label className="form-label">РњС–СЃС‚Рѕ</label>
                        <input
                          type="text"
                          className="form-input"
                          value={settings.weatherCity}
                          onChange={e => handleSettingChange('weatherCity', e.target.value)}
                          placeholder="Kyiv, Kharkiv, Lviv..."
                          style={{ maxWidth: '280px' }}
                        />
                        <span className="form-hint">РќР°Р·РІР° РјС–СЃС‚Р° Р°РЅРіР»С–Р№СЃСЊРєРѕСЋ</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* Profile Tab */}
                {activeSettingsTab === 'profile' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Avatar upload */}
                    <div>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Р¤РѕС‚Рѕ РїСЂРѕС„С–Р»СЋ</h3>
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
                              Р’РёР±СЂР°С‚Рё С„РѕС‚Рѕ
                            </label>
                            {!userPhotoUrl && !profilePhotoPreview && (
                              <button
                                onClick={randomizeDicebear}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0.625rem', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e5e7eb', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem', lineHeight: 1, boxSizing: 'border-box' }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                                title="Р†РЅС€РёР№ СЂРѕР±РѕС‚"
                              >
                                <Shuffle size={15} />
                              </button>
                            )}
                          </div>
                          {profilePhotoPreview && (
                            <button onClick={() => { setProfilePhotoPreview(null); setProfilePhotoBase64(null); }}
                              style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#64748b' }}>
                              РЎРєР°СЃСѓРІР°С‚Рё
                            </button>
                          )}
                          {!profilePhotoPreview && userPhotoUrl && (
                            <button
                              onClick={async () => {
                                if (!confirm('Р’РёРґР°Р»РёС‚Рё С„РѕС‚Рѕ РїСЂРѕС„С–Р»СЋ?')) return;
                                await fetch('/api/auth/profile', { method: 'DELETE' });
                                setUserPhotoUrl(null);
                              }}
                              style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: '#ef4444' }}
                            >
                              Р’РёРґР°Р»РёС‚Рё С„РѕС‚Рѕ
                            </button>
                          )}
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.4rem 0 0' }}>JPG, PNG вЂ” РґРѕ 5 РњР‘</p>
                        </div>
                      </div>
                    </div>

                    {/* Info fields */}
                    <div>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>РћСЃРѕР±РёСЃС‚Р° С–РЅС„РѕСЂРјР°С†С–СЏ</h3>
                      <div className="form-group">
                        <label className="form-label">Р†Рј'СЏ</label>
                        <input type="text" className="form-input" value={settings.displayName}
                          onChange={e => handleSettingChange('displayName', e.target.value)} style={{ maxWidth: '360px' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email</label>
                        <input type="email" className="form-input" value={settings.email} disabled
                          style={{ maxWidth: '360px', opacity: 0.6 }} />
                        <span className="form-hint">Email Р·РјС–РЅСЋРІР°С‚Рё РЅРµ РјРѕР¶РЅР°</span>
                      </div>
                      <div className="form-group">
                        <label className="form-label">РўРµР»РµС„РѕРЅ</label>
                        <input type="tel" className="form-input" value={settings.phone}
                          onChange={e => handleSettingChange('phone', e.target.value)}
                          placeholder="+38 (0__) ___-__-__" style={{ maxWidth: '360px' }} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Telegram ID</label>
                        <input type="text" className="form-input" value={settings.telegram_id}
                          onChange={e => handleSettingChange('telegram_id', e.target.value)}
                          placeholder="123456789" style={{ maxWidth: '360px' }} />
                        <span className="form-hint">Р§РёСЃР»РѕРІРёР№ ID РІ Telegram. РќРµРѕР±С…С–РґРЅРёР№ РґР»СЏ РґРѕСЃС‚СѓРїСѓ РґРѕ РјС–РЅС–-РґРѕРґР°С‚РєСѓ.</span>
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                      <h3 style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Р—РјС–РЅР° РїР°СЂРѕР»СЏ</h3>
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setPasswordModalOpen(true)}
                        >
                          Р—РјС–РЅРёС‚Рё РїР°СЂРѕР»СЊ
                        </button>
                      </div>
                    </div>

                    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.75rem' }}>
                      <button className="btn btn-primary" onClick={handleProfileSave} disabled={profileSaving} style={{ minWidth: 120 }}>
                        <Save size={14} />
                        {profileSaving ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : saved ? 'Р—Р±РµСЂРµР¶РµРЅРѕ!' : 'Р—Р±РµСЂРµРіС‚Рё'}
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
                    }}>РљР°РЅР°Р»Рё СЃРїРѕРІС–С‰РµРЅСЊ</h3>
                    
                    {[
                      { key: 'emailNotifications', label: 'Email СЃРїРѕРІС–С‰РµРЅРЅСЏ', desc: 'РћС‚СЂРёРјСѓР№С‚Рµ СЃРїРѕРІС–С‰РµРЅРЅСЏ РЅР° email' },
                      { key: 'pushNotifications', label: 'Push-СЃРїРѕРІС–С‰РµРЅРЅСЏ', desc: 'РњРёС‚С‚С”РІС– СЃРїРѕРІС–С‰РµРЅРЅСЏ РІ Р±СЂР°СѓР·РµСЂС–' },
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
                    }}>РўРёРїРё СЃРїРѕРІС–С‰РµРЅСЊ</h3>
                    
                    {[
                      { key: 'lessonReminders', label: 'РќР°РіР°РґСѓРІР°РЅРЅСЏ РїСЂРѕ Р·Р°РЅСЏС‚С‚СЏ', desc: 'РџРµСЂРµРґ РїРѕС‡Р°С‚РєРѕРј Р·Р°РЅСЏС‚СЊ' },
                      { key: 'paymentAlerts', label: 'РЎРїРѕРІС–С‰РµРЅРЅСЏ РїСЂРѕ РїР»Р°С‚РµР¶С–', desc: 'РћРїР»Р°С‚Р° С‚Р° Р±РѕСЂРіРё' },
                      { key: 'weeklyReport', label: 'РўРёР¶РЅРµРІРёР№ Р·РІС–С‚', desc: 'РџС–РґСЃСѓРјРѕРє СЂРѕР±РѕС‚Рё Р·Р° С‚РёР¶РґРµРЅСЊ' },
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
                      Р—Р°СЂРїР»Р°С‚Р° РІРёРєР»Р°РґР°С‡С–РІ
                    </h3>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label">Р¦С–РЅР° Р·Р° Р·Р°РЅСЏС‚С‚СЏ РґР»СЏ СѓС‡РЅС–РІ (в‚ґ)</label>
                      <div style={{ maxWidth: '200px' }}>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={1}
                          value={salarySettings.lesson_price}
                          onChange={e => setSalarySettings(prev => ({ ...prev, lesson_price: e.target.value }))}
                        />
                      </div>
                      <span className="form-hint">Р¦С–РЅР° Р·Р° 1 Р·Р°РЅСЏС‚С‚СЏ РґР»СЏ СѓС‡РЅСЏ (Р±РµР· Р·РЅРёР¶РєРё). Р‘РѕСЂРі = РєС–Р»СЊРєС–СЃС‚СЊ РїСЂРѕРІРµРґРµРЅРёС… Р·Р°РЅСЏС‚СЊ Г— С†С–РЅР° Г— (1 в€’ Р·РЅРёР¶РєР°%)</span>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label">Р¦С–РЅР° 1 С–РЅРґРёРІС–РґСѓР°Р»СЊРЅРѕРіРѕ Р·Р°РЅСЏС‚С‚СЏ (в‚ґ)</label>
                      <div style={{ maxWidth: '200px' }}>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={1}
                          value={salarySettings.individual_lesson_price}
                          onChange={e => setSalarySettings(prev => ({ ...prev, individual_lesson_price: e.target.value }))}
                        />
                      </div>
                      <span className="form-hint">РћРєСЂРµРјР° С„С–РєСЃРѕРІР°РЅР° С†С–РЅР° РґР»СЏ С–РЅРґРёРІС–РґСѓР°Р»СЊРЅРёС… Р·Р°РЅСЏС‚СЊ. РќРµ Р·Р°Р»РµР¶РёС‚СЊ РІС–Рґ Р·РЅРёР¶РєРё СѓС‡РЅСЏ.</span>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', marginBottom: '1.25rem' }} />

                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 600 }}>
                      РЎС‚Р°РІРєР° РІРёРєР»Р°РґР°С‡Р° Р·Р° 1 РґРёС‚РёРЅСѓ РЅР° Р·Р°РЅСЏС‚С‚С–
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '400px', marginBottom: '1.25rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Р“СЂСѓРїРѕРІРµ Р·Р°РЅСЏС‚С‚СЏ (в‚ґ)</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={1}
                          value={salarySettings.teacher_salary_group}
                          onChange={e => setSalarySettings(prev => ({ ...prev, teacher_salary_group: e.target.value }))}
                        />
                        <span className="form-hint">в‚ґ Р·Р° 1 СѓС‡РЅСЏ</span>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Р†РЅРґРёРІС–РґСѓР°Р»СЊРЅРµ (в‚ґ)</label>
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          step={1}
                          value={salarySettings.teacher_salary_individual}
                          onChange={e => setSalarySettings(prev => ({ ...prev, teacher_salary_individual: e.target.value }))}
                        />
                        <span className="form-hint">в‚ґ Р·Р° 1 СѓС‡РЅСЏ</span>
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
                      <b>РџСЂРёРєР»Р°Рґ:</b> Р“СЂСѓРїРѕРІРµ Р·Р°РЅСЏС‚С‚СЏ Р· 5 РґС–С‚РµР№ в†’ {parseFloat(salarySettings.teacher_salary_group) || 0} Г— 5 = <b>{((parseFloat(salarySettings.teacher_salary_group) || 0) * 5).toFixed(0)} в‚ґ</b>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={handleSalarySave}
                      disabled={salarySaving}
                    >
                      <Save size={14} />
                      {salarySaving ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'Р—Р±РµСЂРµРіС‚Рё С‚Р°СЂРёС„Рё'}
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
                    }}>РЎРёСЃС‚РµРјРЅР° С–РЅС„РѕСЂРјР°С†С–СЏ</h3>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.5rem',
                    }}>
                      {[
                        { label: 'Р’РµСЂСЃС–СЏ СЃРёСЃС‚РµРјРё', value: 'ITRobotCRM v1.0.0' },
                        { label: 'Р РѕР»СЊ РєРѕСЂРёСЃС‚СѓРІР°С‡Р°', value: user?.role === 'admin' ? 'РђРґРјС–РЅС–СЃС‚СЂР°С‚РѕСЂ' : 'Р’РёРєР»Р°РґР°С‡' },
                        { label: 'РЎС‚Р°С‚СѓСЃ', value: 'РђРєС‚РёРІРЅР°', color: '#22c55e' },
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
                    }}>Р”Р°РЅС–</h3>

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary">Р•РєСЃРїРѕСЂС‚ РґР°РЅРёС…</button>
                      <button className="btn btn-secondary">Р РµР·РµСЂРІРЅР° РєРѕРїС–СЏ</button>
                    </div>
                  </div>
                )}

                {/* Users Tab */}
                {activeSettingsTab === 'users' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '0.8125rem', fontWeight: '600', color: '#374151', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        РљРѕСЂРёСЃС‚СѓРІР°С‡С– СЃРёСЃС‚РµРјРё
                      </h3>
                      <button
                        className="btn btn-primary"
                        onClick={() => { setShowCreateUser(v => !v); setCreateUserForm({ name: '', email: '', password: '', role: 'admin' }); }}
                        style={{ fontSize: '0.8125rem', padding: '0.4rem 0.875rem' }}
                      >
                        + РќРѕРІРёР№ РєРѕСЂРёСЃС‚СѓРІР°С‡
                      </button>
                    </div>

                    {/* Create User Form */}
                    {showCreateUser && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Р†Рј'СЏ *</label>
                            <input type="text" className="form-input" value={createUserForm.name} onChange={e => setCreateUserForm(f => ({ ...f, name: e.target.value }))} placeholder="Р†Рј'СЏ РєРѕСЂРёСЃС‚СѓРІР°С‡Р°" />
                          </div>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Email *</label>
                            <input type="email" className="form-input" value={createUserForm.email} onChange={e => setCreateUserForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                          </div>
                          <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
                            <label className="form-label">РџР°СЂРѕР»СЊ *</label>
                            <input type="password" className="form-input" value={createUserForm.password} onChange={e => setCreateUserForm(f => ({ ...f, password: e.target.value }))} placeholder="вЂўвЂўвЂўвЂўвЂўвЂўвЂўвЂў" style={{ maxWidth: '50%' }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" onClick={() => setShowCreateUser(false)} style={{ fontSize: '0.8125rem' }}>РЎРєР°СЃСѓРІР°С‚Рё</button>
                          <button
                            className="btn btn-primary"
                            onClick={handleCreateUser}
                            disabled={createUserSaving || !createUserForm.name.trim() || !createUserForm.email.trim() || !createUserForm.password.trim()}
                            style={{ fontSize: '0.8125rem' }}
                          >
                            {createUserSaving ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'РЎС‚РІРѕСЂРёС‚Рё'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Users Table */}
                    {sysUsersLoading ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>Р—Р°РІР°РЅС‚Р°Р¶РµРЅРЅСЏ...</div>
                    ) : sysUsers.length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>РљРѕСЂРёСЃС‚СѓРІР°С‡С–РІ РЅРµ Р·РЅР°Р№РґРµРЅРѕ</div>
                    ) : (
                      <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                              {['Р†Рј\'СЏ', 'Email', 'РЎС‚Р°С‚СѓСЃ', 'РЎС‚РІРѕСЂРµРЅРѕ', ...(currentUserIsOwner ? ['Р”С–С—'] : [])].map((h) => (
                                <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600, color: '#374151', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h !== 'Р”С–С—' ? h : ''}</th>
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
                                    {u.is_active ? 'РђРєС‚РёРІРЅРёР№' : 'РќРµР°РєС‚РёРІРЅРёР№'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.625rem 0.875rem', color: '#94a3b8', fontSize: '0.8125rem' }}>
                                  {new Date(u.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </td>
                                {currentUserIsOwner && (
                                  <td style={{ padding: '0.625rem 0.875rem' }}>
                                    {!u.is_owner && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button
                                          onClick={() => handleResetUserPassword(u.id, u.name)}
                                          style={{ background: 'none', border: 'none', cursor: resettingUserId === u.id ? 'wait' : 'pointer', color: '#2563eb', padding: '3px 6px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500 }}
                                          onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                          title="РЎРєРёРЅСѓС‚Рё РїР°СЂРѕР»СЊ РєРѕСЂРёСЃС‚СѓРІР°С‡Р°"
                                          disabled={resettingUserId === u.id}
                                        >
                                          {resettingUserId === u.id ? 'РЎРєРёРґР°РЅРЅСЏ...' : 'РЎРєРёРЅСѓС‚Рё РїР°СЂРѕР»СЊ'}
                                        </button>
                                        <button
                                          onClick={() => handleDeleteUser(u.id)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '3px 6px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500 }}
                                          onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                          title="Р’РёРґР°Р»РёС‚Рё РєРѕСЂРёСЃС‚СѓРІР°С‡Р°"
                                        >
                                          Р’РёРґР°Р»РёС‚Рё
                                        </button>
                                      </div>
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

                {/* Save Button вЂ” hidden on users and profile tabs */}
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
                      РЎРєР°СЃСѓРІР°С‚Рё
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleSettingsSave}
                      style={{ minWidth: '120px' }}
                    >
                      <Save size={16} />
                      {saved ? 'Р—Р±РµСЂРµР¶РµРЅРѕ!' : 'Р—Р±РµСЂРµРіС‚Рё'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {resetPasswordResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 10001,
          }}
          onClick={() => setResetPasswordResult(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
              padding: '1.25rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              РўРёРјС‡Р°СЃРѕРІРёР№ РїР°СЂРѕР»СЊ СЃС‚РІРѕСЂРµРЅРѕ
            </h3>
            <p style={{ margin: '0.65rem 0 1rem', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              РџРµСЂРµРґР°Р№С‚Рµ РїР°СЂРѕР»СЊ Р°РґРјС–РЅСѓ <strong>{resetPasswordResult.name}</strong> Р±РµР·РїРµС‡РЅРёРј РєР°РЅР°Р»РѕРј. РџС–СЃР»СЏ РІС…РѕРґСѓ СЃРёСЃС‚РµРјР° Р·РјСѓСЃРёС‚СЊ Р№РѕРіРѕ РѕРґСЂР°Р·Сѓ Р·РјС–РЅРёС‚Рё РїР°СЂРѕР»СЊ.
            </p>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.45rem' }}>
              РўРёРјС‡Р°СЃРѕРІРёР№ РїР°СЂРѕР»СЊ
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
              <input
                type="text"
                readOnly
                value={resetPasswordResult.password}
                className="form-input"
                style={{ flex: 1, fontFamily: 'monospace', letterSpacing: '0.04em' }}
                onFocus={e => e.currentTarget.select()}
              />
              <button className="btn btn-primary" onClick={handleCopyTemporaryPassword}>
                {resetPasswordResult.copied ? 'РЎРєРѕРїС–Р№РѕРІР°РЅРѕ' : 'РЎРєРѕРїС–СЋРІР°С‚Рё'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem' }}>
              <span style={{ fontSize: '0.8rem', color: resetPasswordResult.copied ? '#16a34a' : '#64748b' }}>
                {resetPasswordResult.copied ? 'РџР°СЂРѕР»СЊ СѓР¶Рµ СЃРєРѕРїС–Р№РѕРІР°РЅРѕ РІ Р±СѓС„РµСЂ РѕР±РјС–РЅСѓ.' : 'РњРѕР¶РЅР° РІРёРґС–Р»РёС‚Рё РїР°СЂРѕР»СЊ Р°Р±Рѕ СЃРєРѕРїС–СЋРІР°С‚Рё РєРЅРѕРїРєРѕСЋ.'}
              </span>
              <button className="btn btn-secondary" onClick={() => setResetPasswordResult(null)}>
                Р—Р°РєСЂРёС‚Рё
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            zIndex: 10001,
          }}
          onClick={closePasswordModal}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#fff',
              borderRadius: '16px',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
              padding: '1.25rem',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Р—РјС–РЅР° РїР°СЂРѕР»СЏ
            </h3>
            <p style={{ margin: '0.65rem 0 1rem', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
              Р’РєР°Р¶С–С‚СЊ РїРѕС‚РѕС‡РЅРёР№ РїР°СЂРѕР»СЊ С– РґРІС–С‡С– РІРІРµРґС–С‚СЊ РЅРѕРІРёР№.
            </p>

            <div className="form-group">
              <label className="form-label">РџРѕС‚РѕС‡РЅРёР№ РїР°СЂРѕР»СЊ</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.currentPassword}
                onChange={e => handlePasswordInputChange('currentPassword', e.target.value)}
                placeholder="Р’РІРµРґС–С‚СЊ РїРѕС‚РѕС‡РЅРёР№ РїР°СЂРѕР»СЊ"
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">РќРѕРІРёР№ РїР°СЂРѕР»СЊ</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.newPassword}
                onChange={e => handlePasswordInputChange('newPassword', e.target.value)}
                placeholder="РќРµ РјРµРЅС€Рµ 6 СЃРёРјРІРѕР»С–РІ"
                autoComplete="new-password"
              />
            </div>
            <div className="form-group">
              <label className="form-label">РџС–РґС‚РІРµСЂРґС–С‚СЊ РЅРѕРІРёР№ РїР°СЂРѕР»СЊ</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.confirmPassword}
                onChange={e => handlePasswordInputChange('confirmPassword', e.target.value)}
                placeholder="РџРѕРІС‚РѕСЂС–С‚СЊ РЅРѕРІРёР№ РїР°СЂРѕР»СЊ"
                autoComplete="new-password"
              />
            </div>

            {passwordError && (
              <div style={{ color: '#dc2626', fontSize: '0.875rem', fontWeight: 500, marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
                {passwordError}
              </div>
            )}

            {passwordMessage && (
              <div style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 500, marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
                {passwordMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={closePasswordModal}
                disabled={passwordSaving}
              >
                Р—Р°РєСЂРёС‚Рё
              </button>
              <button
                className="btn btn-primary"
                onClick={handlePasswordSave}
                disabled={passwordSaving}
              >
                <Save size={14} />
                {passwordSaving ? 'Р—Р±РµСЂРµР¶РµРЅРЅСЏ...' : 'Р—РјС–РЅРёС‚Рё РїР°СЂРѕР»СЊ'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Navbar;

