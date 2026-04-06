import { cookies } from '"'"'next/headers'"'"';
import { redirect } from '"'"'next/navigation'"'"';
import { getSession } from '"'"'@/lib/auth'"'"';

export const dynamic = '"'"'force-dynamic'"'"';

export default async function HomePage() {
  const sessionId = cookies().get('"'"'session_id'"'"')?.value;

  if (!sessionId) {
    redirect('"'"'/login'"'"');
  }

  const session = await getSession(sessionId);

  if (!session) {
    redirect('"'"'/login'"'"');
  }

  redirect('"'"'/dashboard'"'"');
}
