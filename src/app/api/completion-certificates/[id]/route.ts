import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, notFound } from '@/lib/api-utils';
import { getCompletionCertificateById, deleteCompletionCertificate } from '@/lib/completion-certificates';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const cert = await getCompletionCertificateById(id);
    if (!cert) return notFound('Сертифікат не знайдено');
    return NextResponse.json(cert);
  } catch (error: any) {
    console.error('Completion Certificate GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    await deleteCompletionCertificate(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Completion Certificate DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
