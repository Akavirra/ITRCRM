import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getGroupById, archiveGroup, restoreGroup } from '@/lib/groups';

export const dynamic = 'force-dynamic';

// POST /api/groups/[id]/archive - Archive or restore a group
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const groupId = parseInt(params.id, 10);
  
  if (isNaN(groupId)) {
    return NextResponse.json({ error: 'Невірний ID групи' }, { status: 400 });
  }
  
  const existingGroup = await getGroupById(groupId);
  
  if (!existingGroup) {
    return notFound('Групу не знайдено');
  }
  
  try {
    const body = await request.json();
    const { action } = body; // 'archive' or 'restore'
    
    if (action === 'restore') {
      await restoreGroup(groupId);
      return NextResponse.json({ message: 'Групу успішно відновлено', status: 'active' });
    } else {
      // Default action is archive - set status to inactive
      await archiveGroup(groupId);
      return NextResponse.json({ message: 'Групу успішно архівовано', status: 'inactive' });
    }
  } catch (error) {
    console.error('Archive/restore group error:', error);
    return NextResponse.json(
      { error: 'Сталася помилка. Спробуйте ще раз.' },
      { status: 500 }
    );
  }
}
