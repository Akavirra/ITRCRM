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
    console.log('[generate-all] Starting lesson generation for all groups');
    
    // Default to 1 month ahead (current month + next month)
    const monthsAhead = 1;
    const today = new Date();
    console.log('[generate-all] Today:', today.toISOString());
    
    const currentMonthStart = startOfMonth(today);
    const targetMonthEnd = endOfMonth(addMonths(today, monthsAhead));
    console.log('[generate-all] Date range:', currentMonthStart.toISOString(), 'to', targetMonthEnd.toISOString());
    
    const monthsLabel = `${format(currentMonthStart, 'MMMM yyyy', { locale: uk })} - ${format(targetMonthEnd, 'MMMM yyyy', { locale: uk })}`;
    
    const results = await generateLessonsForAllGroups(8, user.id, monthsAhead);
    
    console.log('[generate-all] Generation completed, results:', results);
    
    const totalGenerated = results.reduce((sum, r) => sum + r.generated, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    
    console.log('[generate-all] Returning response. Total generated:', totalGenerated, 'Total skipped:', totalSkipped);
    
    return NextResponse.json({
      message: 'Заняття успішно згенеровано',
      totalGenerated,
      totalSkipped,
      monthsLabel,
      results,
    });
  } catch (error) {
    console.error('[generate-all] Error:', error);
    return NextResponse.json(
      { error: 'Не вдалося згенерувати заняття' },
      { status: 500 }
    );
  }
}
