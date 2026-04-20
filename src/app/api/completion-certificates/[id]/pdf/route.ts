import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getAuthUser, unauthorized, notFound } from '@/lib/api-utils';
import { get } from '@/db';
import { getCompletionCertificateById } from '@/lib/completion-certificates';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BAD_SCRIPT_FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/badscript/BadScript-Regular.ttf';
const ROBOTO_FONT_URL = 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf';

async function fetchFont(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font from ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

function getHexColor(hexColor: string | undefined, fallback: [number, number, number]) {
  const hex = (hexColor || '').replace('#', '');
  if (hex.length !== 6) {
    return rgb(fallback[0], fallback[1], fallback[2]);
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) {
    return rgb(fallback[0], fallback[1], fallback[2]);
  }
  return rgb(r / 255, g / 255, b / 255);
}

function getTextHeight(font: any, size: number) {
  try {
    return font.heightAtSize(size, { descender: true });
  } catch {
    return font.heightAtSize(size);
  }
}

function getBottomAlignedBaseline(font: any, size: number, bottomAnchorY: number) {
  const textHeight = getTextHeight(font, size);
  const descenderAllowance = textHeight * 0.14;
  return bottomAnchorY + descenderAllowance;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  const certId = parseInt(params.id, 10);
  if (isNaN(certId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const cert = await getCompletionCertificateById(certId);
    if (!cert) return notFound('Сертифікат не знайдено');

    // 1. Create PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // 2. Load Fonts
    let scriptFont;
    try {
      const localScriptPath = path.join(process.cwd(), 'public', 'fonts', 'BadScript-Regular.ttf');
      let scriptBytes;
      try {
        const buf = await fs.readFile(localScriptPath);
        scriptBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
      } catch {
        scriptBytes = await fetchFont(BAD_SCRIPT_FONT_URL);
      }
      scriptFont = await pdfDoc.embedFont(scriptBytes);
    } catch (e) {
      console.warn('Failed to load Bad Script font, using fallback:', e);
      const { StandardFonts } = require('pdf-lib');
      scriptFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    let robotoFont;
    try {
      const localRobotoPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf');
      let robotoBytes;
      try {
        const buf = await fs.readFile(localRobotoPath);
        robotoBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
      } catch {
        robotoBytes = await fetchFont(ROBOTO_FONT_URL);
      }
      robotoFont = await pdfDoc.embedFont(robotoBytes);
    } catch (e) {
      console.warn('Failed to load Roboto font, using fallback:', e);
      robotoFont = scriptFont;
    }

    const fontMap: Record<string, any> = {
      script: scriptFont,
      roboto: robotoFont,
    };

    // 3. Load Template
    const templateRes = await get<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'completion_certificate_template_url'"
    );
    const templateUrl = templateRes?.value;

    let bgImage;
    let width = 841.89;
    let height = 595.28;

    if (templateUrl) {
      try {
        const res = await fetch(templateUrl);
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          const imageBytes = new Uint8Array(await res.arrayBuffer());
          try {
            if (contentType === 'image/png' || templateUrl.toLowerCase().endsWith('.png')) {
              bgImage = await pdfDoc.embedPng(imageBytes);
            } else {
              bgImage = await pdfDoc.embedJpg(imageBytes);
            }
          } catch {
            try {
              bgImage = await pdfDoc.embedPng(imageBytes);
            } catch {
              bgImage = await pdfDoc.embedJpg(imageBytes);
            }
          }
          if (bgImage) {
            width = bgImage.width;
            height = bgImage.height;
          }
        }
      } catch (e) {
        console.warn('Failed to fetch template from URL:', templateUrl, e);
      }
    }

    if (!bgImage) {
      const templatePath = path.join(process.cwd(), 'public', 'certificates', 'completion-template.png');
      try {
        const imageBytes = await fs.readFile(templatePath);
        bgImage = await pdfDoc.embedPng(imageBytes);
        width = bgImage.width;
        height = bgImage.height;
      } catch (e) {
        console.warn('Local template image not found at', templatePath);
      }
    }

    const page = pdfDoc.addPage([width, height]);

    if (bgImage) {
      page.drawImage(bgImage, { x: 0, y: 0, width, height });
    } else {
      page.drawRectangle({ x: 0, y: 0, width, height, borderColor: rgb(0, 0, 0), borderWidth: 2 });
      page.drawText('СЕРТИФІКАТ ПРО ЗАКІНЧЕННЯ', { x: width / 2 - 150, y: height / 2 + 50, size: 30, font: robotoFont, color: rgb(0, 0, 0) });
    }

    // 4. Load Settings
    const settingsRes = await get<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'completion_certificate_settings'"
    );
    const settings = settingsRes?.value
      ? JSON.parse(settingsRes.value)
      : {
          blocks: [
            { key: 'student_name', font: 'script', size: 42, xPercent: 50, yPercent: 45, color: '#1a237e', align: 'center' },
            { key: 'verb', font: 'roboto', size: 18, xPercent: 50, yPercent: 38, color: '#1a237e', align: 'center' },
            { key: 'course_name', font: 'roboto', size: 20, xPercent: 50, yPercent: 28, color: '#1565c0', align: 'center' },
            { key: 'issue_date', font: 'roboto', size: 14, xPercent: 80, yPercent: 8, color: '#1a237e', align: 'left' },
          ]
        };

    const blocks = settings.blocks || [];

    // 5. Build text values
    const textValues: Record<string, string> = {
      student_name: cert.student_name || '',
      verb: cert.gender === 'female' ? 'успішно завершила навчання' : 'успішно завершив навчання',
      course_name: cert.course_title ? `«${cert.course_title}»` : '',
      issue_date: `Дата видачі: ${formatDate(cert.issue_date)}`,
    };

    // 6. Draw each block
    for (const block of blocks) {
      const text = textValues[block.key] || '';
      if (!text) continue;

      const font = fontMap[block.font] || robotoFont;
      const size = block.size ?? 14;
      const color = getHexColor(block.color, [0, 0, 0]);
      const align = block.align || 'left';

      const textWidth = font.widthOfTextAtSize(text, size);
      const bottomAnchorY = height * (block.yPercent / 100);
      const baselineY = getBottomAlignedBaseline(font, size, bottomAnchorY);

      let x: number;
      if (align === 'center') {
        x = (width * (block.xPercent / 100)) - (textWidth / 2);
      } else if (align === 'right') {
        x = (width * (block.xPercent / 100)) - textWidth;
      } else {
        x = width * (block.xPercent / 100);
      }

      page.drawText(text, { x, y: baselineY, size, font, color });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="completion-certificate-${cert.student_name || cert.id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('Completion Certificate PDF Gen Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
