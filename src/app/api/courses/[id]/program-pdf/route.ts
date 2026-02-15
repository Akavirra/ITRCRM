import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, notFound } from '@/lib/api-utils';
import { getCourseById } from '@/lib/courses';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

// Helper to sanitize filename (replace forbidden characters)
function sanitizeFilename(name: string): string {
  // Replace characters that are forbidden in Windows filenames
  // Forbidden: \ / : * ? " < > | and control characters
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-');
}

// Word wrap text to fit within a given width
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Process text with newlines and word wrapping
function processText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      // Preserve empty lines as blank lines
      allLines.push('');
    } else {
      const wrappedLines = wrapText(paragraph, font, fontSize, maxWidth);
      allLines.push(...wrappedLines);
    }
  }

  return allLines;
}

// GET /api/courses/[id]/program-pdf - Download program as PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authorization
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Необхідна авторизація' }, { status: 401 });
    }
    
    // Parse and validate course ID
    const courseId = parseInt(params.id, 10);
    
    if (isNaN(courseId)) {
      return NextResponse.json({ error: 'Невірний ID курсу' }, { status: 400 });
    }
    
    // Fetch course
    const course = getCourseById(courseId);
    
    if (!course) {
      return NextResponse.json({ error: 'Курс не знайдено' }, { status: 404 });
    }
    
    // Get program text (or use placeholder if empty)
    const programText = course.program?.trim() || '';
    const courseTitle = course.title || 'Без назви';
    
    // Load the Roboto font with Cyrillic support
    const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Regular.ttf');
    
    let fontBytes: Buffer;
    try {
      fontBytes = fs.readFileSync(fontPath);
    } catch (fontError) {
      console.error('program-pdf error: Failed to load font', fontError);
      return NextResponse.json({ error: 'Помилка генерації PDF' }, { status: 500 });
    }
    
    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Register fontkit for font embedding (use default export)
    pdfDoc.registerFontkit(fontkit);
    
    // Embed the font
    const robotoFont = await pdfDoc.embedFont(fontBytes);
    
    // Page dimensions (A4)
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 50; // margin in points
    const contentWidth = pageWidth - 2 * margin;
    
    // Add first page
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Draw title
    const titleText = 'Програма курсу';
    const titleFontSize = 24;
    const titleWidth = robotoFont.widthOfTextAtSize(titleText, titleFontSize);
    const titleX = (pageWidth - titleWidth) / 2;
    
    currentPage.drawText(titleText, {
      x: titleX,
      y: pageHeight - margin - 30,
      size: titleFontSize,
      font: robotoFont,
      color: rgb(0, 0, 0),
    });
    
    // Draw course name
    const courseNameFontSize = 16;
    const courseNameWidth = robotoFont.widthOfTextAtSize(courseTitle, courseNameFontSize);
    const courseNameX = (pageWidth - courseNameWidth) / 2;
    
    currentPage.drawText(courseTitle, {
      x: courseNameX,
      y: pageHeight - margin - 60,
      size: courseNameFontSize,
      font: robotoFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Draw horizontal line
    currentPage.drawLine({
      start: { x: margin, y: pageHeight - margin - 80 },
      end: { x: pageWidth - margin, y: pageHeight - margin - 80 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    
    // Starting position for program text
    let y = pageHeight - margin - 110;
    const maxY = margin + 20; // bottom margin for content
    const programFontSize = 12;
    const lineHeight = programFontSize * 1.4; // in points
    
    // Handle empty program
    if (!programText) {
      const emptyMessage = 'Програма курсу ще не заповнена';
      const emptyMessageWidth = robotoFont.widthOfTextAtSize(emptyMessage, programFontSize);
      const emptyMessageX = (pageWidth - emptyMessageWidth) / 2;
      
      currentPage.drawText(emptyMessage, {
        x: emptyMessageX,
        y: y,
        size: programFontSize,
        font: robotoFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    } else {
      // Process program text with word wrapping
      const lines = processText(programText, robotoFont, programFontSize, contentWidth);
      
      for (const line of lines) {
        // Check if we need a new page
        if (y < maxY) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin - 30;
        }
        
        // Draw the line
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: programFontSize,
          font: robotoFont,
          color: rgb(0, 0, 0),
        });
        
        y -= lineHeight;
      }
    }
    
    // Generate PDF as buffer
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    
    // Generate filename with Ukrainian support
    const sanitizedTitle = sanitizeFilename(courseTitle);
    const filename = `Програма - ${sanitizedTitle}.pdf`;
    
    // Return PDF response with proper headers for Ukrainian filename
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    console.error('program-pdf error', err);
    return NextResponse.json({ error: 'Помилка генерації PDF' }, { status: 500 });
  }
}
