import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { generateLessonsForAllGroups } from '@/lib/lessons';

export const dynamic = 'force-dynamic';

// POST /api/schedule/generate-all - Generate lessons for all active groups
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    const weeksAhead = body.weeksAhead || 8;
    
    const results = await generateLessonsForAllGroups(weeksAhead, user.id);
    
    const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    
    return NextResponse.json({
      message: 'Заняття успішно згенеровано',
      totalGenerated,
      totalSkipped,
      results,
    });
  } catch (error) {
    console.error('Generate all lessons error:', error);
    return NextResponse.json(
      { error: 'Не вдалося згенерувати заняття' },
      { status: 500 }
    );
  }
}
