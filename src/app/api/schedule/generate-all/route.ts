import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { generateLessonsForAllGroups } from '@/lib/lessons';
import { format, addMonths, endOfMonth, startOfMonth } from 'date-fns';
import { uk } from 'date-fns/locale';

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
    // Default to 1 month ahead (current month + next month)
    const monthsAhead = 1;
    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const targetMonthEnd = endOfMonth(addMonths(today, monthsAhead));
    
    const monthsLabel = `${format(currentMonthStart, 'MMMM yyyy', { locale: uk })} - ${format(targetMonthEnd, 'MMMM yyyy', { locale: uk })}`;
    
    const results = await generateLessonsForAllGroups(8, user.id, monthsAhead);
    
    const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    
    return NextResponse.json({
      message: 'Заняття успішно згенеровано',
      totalGenerated,
      totalSkipped,
      monthsLabel,
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
