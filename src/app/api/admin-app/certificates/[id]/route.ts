import { getAuthUser, unauthorized, badRequest, notFound } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';
import { deleteCertificate, updateCertificateStatus, getCertificateByPublicId } from '@/lib/certificates';
import { run } from '@/db';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return badRequest('Невірний ID');

  try {
    await deleteCertificate(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Certificates DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const id = parseInt(params.id, 10);
  if (isNaN(id)) return badRequest('Невірний ID');

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'print') {
      await run(
        'UPDATE certificates SET printed_at = NOW(), updated_at = NOW() WHERE id = $1',
        [id]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'unprint') {
      await run(
        'UPDATE certificates SET printed_at = NULL, updated_at = NOW() WHERE id = $1',
        [id]
      );
      return NextResponse.json({ success: true });
    }

    return badRequest('Невідома дія');
  } catch (error: any) {
    console.error('Certificates PATCH Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
