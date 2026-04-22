import { getAuthUser, unauthorized, badRequest } from '@/lib/api-utils';
import { NextRequest, NextResponse } from 'next/server';
import { getCertificates, createCertificate } from '@/lib/certificates';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';
    const statusParam = searchParams.get('status');
    const status = statusParam && ['active', 'used', 'expired', 'canceled', 'printed', 'unprinted'].includes(statusParam)
      ? statusParam as 'active' | 'used' | 'expired' | 'canceled' | 'printed' | 'unprinted'
      : undefined;

    const certificates = await getCertificates({
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      search,
      status,
    });
    return NextResponse.json(certificates);
  } catch (error: any) {
    console.error('Certificates GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json();
    const { amount, notes, count = 1 } = body;

    if (!amount || amount <= 0) {
      return badRequest('Сума сертифіката має бути більшою за 0');
    }

    const createdCertificates = [];
    for (let i = 0; i < count; i++) {
      const cert = await createCertificate({
        amount,
        notes,
        created_by: user.id
      });
      createdCertificates.push(cert);
    }

    return NextResponse.json(createdCertificates);
  } catch (error: any) {
    console.error('Certificates POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
