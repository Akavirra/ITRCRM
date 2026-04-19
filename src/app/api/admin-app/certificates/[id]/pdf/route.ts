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

// Bebas Neue Cyrillic font URL
const FONT_URL = 'https://cdn.jsdelivr.net/gh/DmitryUshakov/bebas-neue-cyrillic@master/BebasNeueCyrillic.ttf';
const FALLBACK_FONT_URL = 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxK.woff2';

async function fetchFont(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch font from ${url}`);
  return new Uint8Array(await res.arrayBuffer());
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

    // 2. Load Font (Bebas Neue Cyrillic with fallback to Roboto)
    let fontBytes;
    try {
      fontBytes = await fetchFont(FONT_URL);
    } catch (e) {
      console.warn('Failed to fetch Bebas Neue Cyrillic font, using fallback:', e);
      fontBytes = await fetchFont(FALLBACK_FONT_URL);
    }
    const font = await pdfDoc.embedFont(fontBytes, { subset: false });

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
      amountFontSize: 48,
      amountXPercent: 78,
      amountYPercent: 28,
      amountColor: '#FFFFFF',
      amountRotation: -28
    };

    // 5. Draw Certificate ID
    const idText = `${cert.public_id}`;
    const fontSize = settings.fontSize || 36;
    const textWidth = font.widthOfTextAtSize(idText, fontSize);
    
    // Convert percentages to points for ID
    const x = (width * (settings.xPercent / 100)) - (textWidth / 2);
    const y = height * (settings.yPercent / 100);

    // Parse ID color (hex to rgb)
    const hex = (settings.color || '#000000').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
    const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
    const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;

    page.drawText(idText, {
      x,
      y,
      size: fontSize,
      font: font,
      color: rgb(r, g, b),
    });

    // 6. Draw Amount
    const amountText = `${cert.amount} грн`;
    const amountFontSize = settings.amountFontSize || 48;
    const amountTextWidth = font.widthOfTextAtSize(amountText, amountFontSize);

    // Convert percentages to points for Amount
    const ax = (width * (settings.amountXPercent / 100)) - (amountTextWidth / 2);
    const ay = height * (settings.amountYPercent / 100);

    // Parse Amount color (hex to rgb)
    const aHex = (settings.amountColor || '#FFFFFF').replace('#', '');
    const ar = parseInt(aHex.substring(0, 2), 16) / 255 || 1;
    const ag = parseInt(aHex.substring(2, 4), 16) / 255 || 1;
    const ab = parseInt(aHex.substring(4, 6), 16) / 255 || 1;

    page.drawText(amountText, {
      x: ax,
      y: ay,
      size: amountFontSize,
      font: font,
      color: rgb(ar, ag, ab),
      rotate: degrees(settings.amountRotation || 0),
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
