'use client';

import { useState } from 'react';

export default function TeacherLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/teacher/auth/logout', { method: 'POST' });
    } catch {
      /* ігноруємо — все одно очистимо UI */
    }
    window.location.href = '/login';
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="teacher-secondary-btn"
      disabled={loading}
    >
      {loading ? 'Вихід…' : 'Вийти з кабінету'}
    </button>
  );
}
