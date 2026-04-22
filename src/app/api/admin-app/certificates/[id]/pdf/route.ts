import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getAuthUser, unauthorized } from '@/lib/api-utils';
import { get } from '@/db';
import { Certificate } from '@/lib/certificates';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Font URLs (Reliable sources)
const FONT_URL = 'https://raw.githubusercontent.com/DmitryUshakov/bebas-neue-cyrillic/master/BebasNeueCyrillic.ttf';
const ERMILOV_FONT_URL = 'https://raw.githubusercontent.com/itroboticsmanager-rgb/ITRCRM/main/public/fonts/Ermilov-Bold.otf';
// Standard Google Fonts Roboto TTF (direct link to the file)
const FALLBACK_FONT_URL = 'https://github.com/google/fonts/raw/main/apache/roboto/static/Roboto-Regular.ttf';

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

function drawStyledText(
  page: any,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: any;
    color: any;
    rotate?: any;
    characterSpacing?: number;
    weight?: 'normal' | 'bold';
    style?: 'normal' | 'italic';
  }
) {
  const {
    weight = 'normal',
    style = 'normal',
    ...baseOptions
  } = options;

  const xSkew = style === 'italic' ? degrees(-12) : undefined;

  page.drawText(text, {
    ...baseOptions,
    xSkew,
  } as any);

  if (weight === 'bold') {
    page.drawText(text, {
      ...baseOptions,
      x: baseOptions.x + Math.max(0.45, options.size * 0.018),
      xSkew,
    } as any);
  }
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
    const cert = await get<Certificate>(
      'SELECT * FROM certificates WHERE id = $1',
      [certId]
    );

    if (!cert) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });

    // 1. Create PDF
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // 2. Load Fonts (with individual error handling for stability)
    let font;
    try {
      let fontBytes;
      const localBebasPath = path.join(process.cwd(), 'public', 'fonts', 'BebasNeueCyrillic.ttf');
      try {
        const buf = await fs.readFile(localBebasPath);
        fontBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
      } catch {
        try {
          fontBytes = await fetchFont(FONT_URL);
        } catch (e) {
          console.warn('Failed to fetch Bebas Neue Cyrillic font, using fallback:', e);
          fontBytes = await fetchFont(FALLBACK_FONT_URL);
        }
      }
      font = await pdfDoc.embedFont(fontBytes);
    } catch (fontError) {
      console.error('Critical font loading error (Bebas/Roboto):', fontError);
      // Last resort fallback to standard Helvetica (no cyrillic support but prevents 500 error)
      const { StandardFonts } = require('pdf-lib');
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    let ermilovFont;
    try {
      const localErmilovPath = path.join(process.cwd(), 'public', 'fonts', 'Ermilov-Bold.otf');
      let ermilovBytes;
      try {
        const buf = await fs.readFile(localErmilovPath);
        ermilovBytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.length);
      } catch {
        ermilovBytes = await fetchFont(ERMILOV_FONT_URL);
      }
      ermilovFont = await pdfDoc.embedFont(ermilovBytes);
    } catch (e) {
      console.warn('Failed to fetch Ermilov font, using main font as fallback:', e);
      ermilovFont = font;
    }

    // 3. Load Template from system_settings or default
    const templateRes = await get<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'certificate_template_url'"
    );
    const templateUrl = templateRes?.value;

    let bgImage;
    let width = 841.89; // A4 Landscape width
    let height = 595.28; // A4 Landscape height

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
          } catch (embedError) {
            // If content-type/extension was wrong, try the other one
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
      // Fallback to local file if URL not set or fetch failed
      const templatePath = path.join(process.cwd(), 'public', 'certificates', 'template.png');
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
      page.drawImage(bgImage, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
    } else {
      // Draw a placeholder if no image
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: height,
        borderColor: rgb(0, 0, 0),
        borderWidth: 2,
      });
      page.drawText('СЕРТИФІКАТ', {
        x: width / 2 - 100,
        y: height / 2 + 50,
        size: 40,
        font: font,
        color: rgb(0, 0, 0),
      });
    }

    // 4. Load ID Layout Settings
    const settingsRes = await get<{ value: string }>(
      "SELECT value FROM system_settings WHERE key = 'certificate_id_settings'"
    );
    const settings = settingsRes?.value ? JSON.parse(settingsRes.value) : {
      fontSize: 36,
      xPercent: 50,
      yPercent: 12,
      color: '#000000',
      idLetterSpacing: 1.5,
      idWeight: 'normal',
      idStyle: 'normal',
      amountFontSize: 48,
      amountXPercent: 78,
      amountYPercent: 28,
      amountColor: '#FFFFFF',
      amountRotation: -28,
      amountWeight: 'normal',
      amountStyle: 'normal'
    };

    // 5. Draw Certificate ID
    const idText = `${cert.public_id}`;
    const baseFontSize = settings.fontSize ?? 36;
    const baseCharacterSpacing = settings.idLetterSpacing ?? 1.5;
    
    // Scale factor: how much the image was scaled to fit the PDF page (or vice versa)
    // In our case, the page size IS the image size, so scale is 1.
    const fontSize = baseFontSize;
    const characterSpacing = baseCharacterSpacing;

    const textWidth = font.widthOfTextAtSize(idText, fontSize) + (idText.length - 1) * characterSpacing;
    
    // PDF coordinates start from BOTTOM-LEFT. 
    // Browser/CSS coordinates for the preview start from BOTTOM-LEFT (because I used bottom: % in CSS).
    // So Y coordinate is actually consistent! 
    // BUT: page.drawText(y) is the BASELINE of the text.
    const x = (width * (settings.xPercent / 100)) - (textWidth / 2);
    const idBottomAnchorY = height * (settings.yPercent / 100);
    const y = getBottomAlignedBaseline(font, fontSize, idBottomAnchorY);

    drawStyledText(page, idText, {
      x,
      y,
      size: fontSize,
      font: font,
      color: getHexColor(settings.color, [0, 0, 0]),
      characterSpacing: characterSpacing,
      weight: settings.idWeight ?? 'normal',
      style: settings.idStyle ?? 'normal',
    });

    // 6. Draw Amount
    const amountVal = `${cert.amount}`;
    const amountFontSize = settings.amountFontSize ?? 48;
    const amountWidth = ermilovFont.widthOfTextAtSize(amountVal, amountFontSize);
    const amountHeight = getTextHeight(ermilovFont, amountFontSize);

    const cssRotation = settings.amountRotation ?? 0;
    const H = amountHeight;
    const W = amountWidth;
    
    const cx = (width * (settings.amountXPercent / 100));
    const amountBottomAnchorY = height * (settings.amountYPercent / 100);
    const cy = getBottomAlignedBaseline(ermilovFont, amountFontSize, amountBottomAnchorY) + (H / 2);

    const phi = -cssRotation * (Math.PI / 180);
    const relX = -W / 2;
    const relY = -H / 2;
    
    const rotRelX = relX * Math.cos(phi) - relY * Math.sin(phi);
    const rotRelY = relX * Math.sin(phi) + relY * Math.cos(phi);

    const ax = cx + rotRelX;
    const ay = cy + rotRelY;

    drawStyledText(page, amountVal, {
      x: ax,
      y: ay,
      size: amountFontSize,
      font: ermilovFont,
      color: getHexColor(settings.amountColor, [1, 1, 1]),
      rotate: degrees(-cssRotation),
      weight: settings.amountWeight ?? 'normal',
      style: settings.amountStyle ?? 'normal',
    });

    const pdfBytes = await pdfDoc.save();
    
    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificate-${cert.public_id}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('PDF Gen Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
