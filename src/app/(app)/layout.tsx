import type { Viewport } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, getUserById } from '@/lib/auth';
import Layout from '@/components/Layout';
import { NotesProvider } from '@/components/NotesProvider';
import { UserProvider, User } from '@/components/UserContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const sessionId = cookieStore.get('session_id')?.value;
  
  if (!sessionId) {
    redirect('/login');
  }
  
  const session = await getSession(sessionId);
  if (!session) {
    redirect('/login');
  }
  
  const user = await getUserById(session.user_id);
  if (!user || !user.is_active) {
    redirect('/login');
  }
  
  // Basic role check to ensure only known roles enter (app) group
  if (user.role !== 'admin' && user.role !== 'teacher') {
    redirect('/login');
  }
  
  const contextUser: User = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  
  return (
    <UserProvider user={contextUser}>
      <NotesProvider>
        <Layout user={contextUser}>
          {children}
        </Layout>
      </NotesProvider>
    </UserProvider>
  );
}
