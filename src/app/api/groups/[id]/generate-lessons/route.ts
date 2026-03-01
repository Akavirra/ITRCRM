import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { generateLessonsForGroup, generateLessonsForAllGroups } from '@/lib/lessons';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidGroupId: 'Невірний ID групи',
  generateFailed: 'Не вдалося згенерувати заняття',
};

// POST /api/groups/[id]/generate-lessons - Generate lessons for a group
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidGroupId }, { status: 400 });
  }
  
  // Check access
  const hasAccess = await checkGroupAccess(user, groupId);
  
  if (!hasAccess) {
    return forbidden();
  }
  
  try {
    const body = await request.json();
    const weeksAhead = body.weeksAhead || 8;
    
    console.log('[generate-lessons] Starting for group:', groupId, 'weeksAhead:', weeksAhead);
    
    const result = await generateLessonsForGroup(groupId, weeksAhead, user.id);
    
    console.log('[generate-lessons] Completed for group:', groupId, 'result:', result);
    
    return NextResponse.json({
      message: 'Заняття успішно згенеровано',
      generated: result.generated,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('[generate-lessons] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : ERROR_MESSAGES.generateFailed },
      { status: 500 }
    );
  }
}
