import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, checkGroupAccess } from '@/lib/api-utils';
import { generateLessonsForGroup, generateLessonsForAllGroups } from '@/lib/lessons';

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
    
    const result = generateLessonsForGroup(groupId, weeksAhead, user.id);
    
    return NextResponse.json({
      message: 'Заняття успішно згенеровано',
      generated: result.generated,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error('Generate lessons error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.generateFailed },
      { status: 500 }
    );
  }
}
