import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, checkGroupAccess, forbidden } from '@/lib/api-utils';
import { getGroupHistory, getRecentGroupHistory } from '@/lib/group-history';

export const dynamic = 'force-dynamic';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidGroupId: 'Невірний ID групи',
  groupNotFound: 'Групу не знайдено',
};

// GET /api/groups/[id]/history - Get group history
export async function GET(
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
  
  const { searchParams } = new URL(request.url);
  const recent = searchParams.get('recent') === 'true';
  const limit = searchParams.get('limit');
  
  let history;
  
  if (recent) {
    const limitCount = limit ? parseInt(limit, 10) : 4;
    history = await getRecentGroupHistory(groupId, limitCount);
  } else {
    history = await getGroupHistory(groupId);
  }
  
  return NextResponse.json({ history });
}
