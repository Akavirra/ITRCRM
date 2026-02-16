export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/api-utils';
import { getCourseById } from '@/lib/courses';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';

// Helper to sanitize filename (replace forbidden characters)
function sanitizeFilename(name: string): string {
  // Replace characters that are forbidden in Windows filenames
  // Forbidden: \ / : * ? " < > | and control characters
  return name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-');
}

// Word wrap text to fit within a given width using font width measurement
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  if (!text || text.trim() === '') {
    return [];
  }
  
  // Helper to safely measure text width
  const measureText = (str: string): number => {
    try {
      const width = font.widthOfTextAtSize(str, fontSize);
      // If width is 0 or NaN, use fallback estimation (avg char width ~0.5 * fontSize)
      if (!width || width <= 0 || !isFinite(width)) {
        return str.length * fontSize * 0.5;
      }
      return width;
    } catch {
      return str.length * fontSize * 0.5;
    }
  };
  
  // Split by any whitespace (spaces, tabs, etc.)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    // Check if the word itself is too long for a line
    const wordWidth = measureText(word);
    
    if (wordWidth > maxWidth) {
      // Word is too long - need to break it character by character
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      
      // Break long word into chunks
      let chunk = '';
      for (const char of word) {
        const testChunk = chunk + char;
        const chunkWidth = measureText(testChunk);
        
        if (chunkWidth > maxWidth && chunk) {
          lines.push(chunk);
          chunk = char;
        } else {
          chunk = testChunk;
        }
      }
      if (chunk) {
        currentLine = chunk;
      }
      continue;
    }
    
    // Normal word wrapping
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureText(testLine);

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

// Process text with newlines and word wrapping, preserving paragraphs
function processText(text: string, font: any, fontSize: number, maxWidth: number): { lines: string[]; isParagraphBreak: boolean[] } {
  // Split by \n to preserve paragraphs (normalize \r\n and \r to \n)
  const paragraphs = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const allLines: string[] = [];
  const paragraphBreaks: boolean[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const trimmedParagraph = paragraph.trim();
    
    if (trimmedParagraph === '') {
      // Empty line - mark as paragraph break (will add extra spacing)
      if (allLines.length > 0) {
        paragraphBreaks[allLines.length - 1] = true;
      }
    } else {
      const wrappedLines = wrapText(trimmedParagraph, font, fontSize, maxWidth);
      for (const line of wrappedLines) {
        allLines.push(line);
        paragraphBreaks.push(false);
      }
    }
  }

  return { lines: allLines, isParagraphBreak: paragraphBreaks };
}

// Draw page footer with page number and optional generation date
function drawPageFooter(
  page: any,
  pageIndex: number,
  totalPages: number,
  font: any,
  pageWidth: number,
  pageHeight: number,
  margin: number
): void {
  const footerFontSize = 9;
  const footerY = 30;
  
  // Page number on the right
  const pageNumberText = `Сторінка ${pageIndex + 1}`;
  const pageNumberWidth = font.widthOfTextAtSize(pageNumberText, footerFontSize);
  
  page.drawText(pageNumberText, {
    x: pageWidth - margin - pageNumberWidth,
    y: footerY,
    size: footerFontSize,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  // Generation date on the left
  const genDate = new Date().toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const dateText = `Згенеровано: ${genDate}`;
  
  page.drawText(dateText, {
    x: margin,
    y: footerY,
    size: footerFontSize,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
}

// Draw page header with title, course name, and divider
function drawPageHeader(
  page: any,
  courseTitle: string,
  font: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  isFirstPage: boolean
): number {
  // Header starts lower on first page (with title), higher on subsequent pages
  let y = pageHeight - margin;
  
  if (isFirstPage) {
    // Draw main title "Програма курсу"
    const titleText = 'Програма курсу';
    const titleFontSize = 24;
    const titleWidth = font.widthOfTextAtSize(titleText, titleFontSize);
    const titleX = (pageWidth - titleWidth) / 2;
    
    page.drawText(titleText, {
      x: titleX,
      y: y - 30,
      size: titleFontSize,
      font: font,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    y -= 55;
    
    // Draw course name
    const courseNameFontSize = 16;
    const courseNameWidth = font.widthOfTextAtSize(courseTitle, courseNameFontSize);
    const courseNameX = (pageWidth - courseNameWidth) / 2;
    
    page.drawText(courseTitle, {
      x: courseNameX,
      y: y,
      size: courseNameFontSize,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    y -= 25;
  } else {
    // Subsequent pages: smaller header
    const headerText = `Програма курсу: ${courseTitle}`;
    const headerFontSize = 12;
    const headerWidth = font.widthOfTextAtSize(headerText, headerFontSize);
    const headerX = (pageWidth - headerWidth) / 2;
    
    page.drawText(headerText, {
      x: headerX,
      y: y - 25,
      size: headerFontSize,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    y -= 40;
  }
  
  // Draw thin divider line
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: pageWidth - margin, y: y },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });
  
  return y - 20; // Return Y position for content start
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
    
    // Load Unicode font that supports Cyrillic
    const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Regular.ttf');
    const fontBytes = fs.readFileSync(fontPath);
    
    // Create PDF document and register fontkit
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    
    // Embed Unicode font (supports Cyrillic)
    // Note: Don't use subset: true as it can cause issues with width measurement
    const font = await pdfDoc.embedFont(fontBytes, { subset: false });
    
    // Page dimensions (A4)
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 55; // margin in points
    // Use slightly smaller content width for safety margin
    const contentWidth = pageWidth - 2 * margin - 10; // 10pt safety margin
    
    // Layout settings
    const programFontSize = 12;
    const lineHeight = 17; // in points
    const bottomMargin = 50; // space for footer
    
    // Process program text with word wrapping and paragraph preservation
    const { lines, isParagraphBreak } = processText(programText, font, programFontSize, contentWidth);
    
    // Calculate how many lines fit per page
    const headerHeightFirstPage = 130; // approximate height of first page header
    const headerHeightOtherPages = 80; // approximate height of other page headers
    const contentStartY = pageHeight - margin;
    
    // We need to know total pages first, so let's do a layout pass
    // First, calculate lines per page
    const linesPerPageFirst = Math.floor((contentStartY - headerHeightFirstPage - bottomMargin) / lineHeight);
    const linesPerPageOther = Math.floor((contentStartY - headerHeightOtherPages - bottomMargin) / lineHeight);
    
    // Calculate total pages needed
    let totalPages = 1;
    let linesRemaining = lines.length;
    
    // First page can hold fewer lines (due to bigger header)
    linesRemaining -= linesPerPageFirst;
    
    // Subsequent pages
    while (linesRemaining > 0) {
      totalPages++;
      linesRemaining -= linesPerPageOther;
    }
    
    // Now create pages and draw content
    let currentPageIndex = 0;
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    
    // Draw header on first page
    let y = drawPageHeader(currentPage, courseTitle, font, pageWidth, pageHeight, margin, true);
    
    // Handle empty program
    if (lines.length === 0) {
      const emptyMessage = 'Програма курсу ще не заповнена';
      const emptyMessageWidth = font.widthOfTextAtSize(emptyMessage, programFontSize);
      const emptyMessageX = (pageWidth - emptyMessageWidth) / 2;
      
      currentPage.drawText(emptyMessage, {
        x: emptyMessageX,
        y: y,
        size: programFontSize,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
    } else {
      // Draw program text
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if we need a new page
        if (y < bottomMargin + lineHeight) {
          // Draw footer on current page before switching
          drawPageFooter(currentPage, currentPageIndex, totalPages, font, pageWidth, pageHeight, margin);
          
          // Create new page
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentPageIndex++;
          
          // Draw header on new page
          y = drawPageHeader(currentPage, courseTitle, font, pageWidth, pageHeight, margin, false);
        }
        
        // Draw the line
        currentPage.drawText(line, {
          x: margin,
          y: y,
          size: programFontSize,
          font: font,
          color: rgb(0.15, 0.15, 0.15),
        });
        
        // Move Y cursor
        if (isParagraphBreak[i]) {
          y -= lineHeight * 1.5; // Extra spacing between paragraphs
        } else {
          y -= lineHeight;
        }
      }
    }
    
    // Draw footer on the last page
    drawPageFooter(currentPage, currentPageIndex, totalPages, font, pageWidth, pageHeight, margin);
    
    // Generate PDF as buffer
    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    
    // Build filename: Програма - <course title>.pdf
    const filename = `Програма - ${courseTitle}.pdf`;
    
    // Sanitize for Windows: replace forbidden characters
    const sanitizedFilename = sanitizeFilename(filename);
    
    // Return PDF response with proper headers
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('program-pdf error:', err);
    
    // In dev mode, return detailed error info
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      return Response.json(
        { error: 'Помилка генерації PDF', details: errorMessage },
        { status: 500 }
      );
    }
    
    return Response.json({ error: 'Помилка генерації PDF' }, { status: 500 });
  }
}
