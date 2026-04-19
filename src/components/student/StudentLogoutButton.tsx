'use client';

import { useState } from 'react';

export default function StudentLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    if (!confirm('Вийти з порталу?')) return;

    setLoading(true);
    try {
      await fetch('/api/student/auth/logout', { method: 'POST' });
    } catch {
      // ignore — однаково редіректимо
    }
    window.location.href = '/login';
  }

  return (
    <button
      type="button"
      className="student-primary-btn"
      style={{ background: '#dc2626' }}
      onClick={handleLogout}
      disabled={loading}
    >
      {loading ? 'Вихід…' : 'Вийти з акаунту'}
    </button>
  );
}
