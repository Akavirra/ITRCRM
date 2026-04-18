import { NextResponse } from 'next/server';
import { getCourses } from '@/lib/courses';
import { getOrSetServerCache } from '@/lib/server-cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  const courses = await getOrSetServerCache('public:courses:active', 60 * 1000, async () => {
    const rows = await getCourses(false);
    return rows.map((course) => ({
      id: course.id,
      title: course.title,
      public_id: course.public_id,
    }));
  });

  return NextResponse.json({ courses });
}
