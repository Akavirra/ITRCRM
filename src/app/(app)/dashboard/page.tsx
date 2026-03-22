'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import PageLoading from '@/components/PageLoading';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'teacher';
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check auth
        const authRes = await fetch('/api/auth/me');
        if (!authRes.ok) {
          router.push('/login');
          return;
        }
        const authData = await authRes.json();
        setUser(authData.user);
      } catch (error) {
        console.error('Failed to fetch auth data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <Layout user={{ id: 0, name: '', email: '', role: 'admin' }}>
        <PageLoading />
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout user={user}>
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Дашбоард</h3>
        </div>
        <div className="card-body">
          <p style={{ color: '#6b7280' }}>Дашбоард очищено.</p>
        </div>
      </div>
    </Layout>
  );
}
