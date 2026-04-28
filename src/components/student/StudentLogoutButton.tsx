'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';

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
      className="student-secondary-btn"
      onClick={handleLogout}
      disabled={loading}
    >
      <LogOut size={16} strokeWidth={1.75} />
      {loading ? 'Вихід…' : 'Вийти'}
    </button>
  );
}
