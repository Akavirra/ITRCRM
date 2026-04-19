/**
 * POST /api/students/[id]/pin-card/pdf — АДМІН-ТІЛЬКИ
 *
 * Генерує PDF PIN-картки для друку. Приймає code і pin у body — сервер їх НЕ зберігає,
 * а використовує тільки для рендерингу (БД вже має bcrypt-хеш з /pin-card POST).
 *
 * Body: { code: string, pin: string }
 * Response: application/pdf (PIN-картка A6 портрет, з QR + кодом + PIN)
 *
 * Навіщо передавати pin у body, а не генерувати PDF одразу при POST /pin-card?
 *   - /pin-card POST повертає { code, pin } у JSON, щоб UI показав PIN адміну на екрані
 *   - Потім UI викликає /pdf з тим самим pin для друку
 *   - Це дає адміну контроль: він БАЧИТЬ PIN до друку і може скопіювати, а не тільки друкувати
 *   - Альтернатива (pdf-lib у браузері) роздула б bundle на ~1MB
 */

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import QRCode from 'qrcode';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get } from '@/db';
import { codeToStudentId } from '@/lib/student-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// A6 портрет у пунктах (1pt = 1/72 inch, 1mm ≈ 2.834 pt)
// A6 = 105×148 mm ≈ 297.64×419.53 pt
const PAGE_WIDTH = 297.64;
const PAGE_HEIGHT = 419.53;
const MARGIN = 24;

/** Roboto з Google CDN — той самий, що в /api/courses/[id]/program-pdf. Підтримує кирилицю. */
const FONT_REGULAR_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2';
const FONT_BOLD_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmWUlfBBc4.woff2';

async function fetchFont(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load font ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const studentId = parseInt(params.id, 10);
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: 'Невірний ID учня' }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Невірний JSON' }, { status: 400 });
  }

  const code = typeof body?.code === 'string' ? body.code.trim() : '';
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : '';

  // Перевірки: код має збігатися з цим учнем, PIN — 6 цифр
  if (codeToStudentId(code) !== studentId) {
    return NextResponse.json({ error: 'Код не збігається з ID учня' }, { status: 400 });
  }
  if (!/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN має бути 6 цифр' }, { status: 400 });
  }

  // Витягуємо ім'я учня (від адмінської ролі, тому повний доступ)
  const student = await get<{ full_name: string }>(
    `SELECT full_name FROM students WHERE id = $1`,
    [studentId]
  );
  if (!student) {
    return NextResponse.json({ error: 'Учня не знайдено' }, { status: 404 });
  }

  try {
    const pdfBytes = await buildPinCardPdf({
      code,
      pin,
      fullName: student.full_name,
    });

    const filename = `pin-card-${code}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('[pin-card/pdf] generation failed:', error);
    return NextResponse.json({ error: 'Не вдалося згенерувати PDF' }, { status: 500 });
  }
}

// PDF rendering --------------------------------------------------------------

interface CardData {
  code: string;
  pin: string;
  fullName: string;
}

async function buildPinCardPdf(data: CardData): Promise<Uint8Array> {
  const portalUrl =
    process.env.NEXT_PUBLIC_STUDENT_PORTAL_URL ||
    'https://students.itrobotics.com.ua';
  const loginUrl = `${portalUrl.replace(/\/$/, '')}/login?code=${encodeURIComponent(data.code)}`;

  // QR як PNG (ширина 512 px — з запасом, pdf-lib масштабує)
  const qrPngBuffer = await QRCode.toBuffer(loginUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    fetchFont(FONT_REGULAR_URL),
    fetchFont(FONT_BOLD_URL),
  ]);
  const fontRegular = await pdf.embedFont(regularBytes, { subset: false });
  const fontBold = await pdf.embedFont(boldBytes, { subset: false });

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const qrImage = await pdf.embedPng(qrPngBuffer);

  const W = PAGE_WIDTH;
  const H = PAGE_HEIGHT;

  // Тло: тонка рамка, щоб легше різати на друкованому аркуші
  page.drawRectangle({
    x: 4, y: 4, width: W - 8, height: H - 8,
    borderColor: rgb(0.85, 0.85, 0.88),
    borderWidth: 0.5,
  });

  // Header band
  const headerH = 48;
  page.drawRectangle({
    x: 0, y: H - headerH, width: W, height: headerH,
    color: rgb(0.13, 0.37, 0.82),
  });
  drawCentered(page, 'ITRobotics', W, H - 22, fontBold, 18, rgb(1, 1, 1));
  drawCentered(page, 'Портал учня', W, H - 38, fontRegular, 10, rgb(0.9, 0.92, 1));

  let y = H - headerH - 18;

  // Ім'я учня (з word-wrap якщо довге)
  const nameLines = wrapText(data.fullName, fontBold, 13, W - 2 * MARGIN);
  for (const line of nameLines.slice(0, 2)) {
    drawCentered(page, line, W, y, fontBold, 13, rgb(0.1, 0.1, 0.1));
    y -= 16;
  }
  y -= 4;

  // QR-код у центрі
  const qrSize = 130;
  const qrX = (W - qrSize) / 2;
  const qrY = y - qrSize;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  // Підпис під QR
  drawCentered(page, 'Скануйте щоб увійти', W, qrY - 14, fontRegular, 9, rgb(0.45, 0.45, 0.5));

  y = qrY - 34;

  // Або: поля "Код" + "PIN" великими літерами
  const labelColor = rgb(0.45, 0.45, 0.5);
  const valueColor = rgb(0.1, 0.1, 0.1);

  drawCentered(page, 'КОД УЧНЯ', W, y, fontRegular, 8, labelColor);
  y -= 16;
  drawCentered(page, data.code, W, y, fontBold, 22, valueColor);
  y -= 22;

  drawCentered(page, 'PIN', W, y, fontRegular, 8, labelColor);
  y -= 16;
  // PIN з пробілами: "123 456" — легше читати
  const prettyPin = `${data.pin.slice(0, 3)} ${data.pin.slice(3)}`;
  drawCentered(page, prettyPin, W, y, fontBold, 22, valueColor);
  y -= 28;

  // Footer-попередження
  const warning = 'Не передавайте картку іншим. Зверніться до адміністратора у разі втрати.';
  const warningLines = wrapText(warning, fontRegular, 7.5, W - 2 * MARGIN);
  for (const line of warningLines) {
    drawCentered(page, line, W, y, fontRegular, 7.5, rgb(0.55, 0.55, 0.6));
    y -= 10;
  }

  // URL порталу внизу
  drawCentered(
    page,
    portalUrl.replace(/^https?:\/\//, ''),
    W, 12, fontRegular, 7, rgb(0.3, 0.3, 0.35)
  );

  return pdf.save();
}

function drawCentered(
  page: any,
  text: string,
  pageWidth: number,
  y: number,
  font: any,
  size: number,
  color: ReturnType<typeof rgb>
): void {
  const width = safeWidthOf(text, font, size);
  page.drawText(text, {
    x: (pageWidth - width) / 2,
    y,
    size,
    font,
    color,
  });
}

function safeWidthOf(text: string, font: any, size: number): number {
  try {
    const w = font.widthOfTextAtSize(text, size);
    return Number.isFinite(w) && w > 0 ? w : text.length * size * 0.5;
  } catch {
    return text.length * size * 0.5;
  }
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (safeWidthOf(candidate, font, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Приспати неіспольована StandardFonts (може стати у пригоді при fallback)
void StandardFonts;
