import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getCourseById, updateCourseFlyerPath, getCourseFlyerPath } from '@/lib/courses';
import { writeFile, unlink } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// Ukrainian error messages
const ERROR_MESSAGES = {
  invalidCourseId: 'Невірний ID курсу',
  courseNotFound: 'Курс не знайдено',
  noFile: 'Файл не обрано',
  invalidFileType: 'Непідтримуваний тип файлу. Дозволяються лише JPEG та PNG',
  fileTooLarge: 'Файл занадто великий. Максимальний розмір: 5MB',
  uploadFailed: 'Не вдалося завантажити флаєр',
  deleteFailed: 'Не вдалося видалити флаєр',
  noFlyer: 'Флаєр не знайдено',
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Upload directory (relative to project root)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'course-flyers');

// Ensure upload directory exists
function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

// Generate unique filename
function generateFilename(coursePublicId: string, extension: string): string {
  const timestamp = Date.now();
  return `${coursePublicId}-${timestamp}.${extension}`;
}

// POST /api/courses/[id]/flyer - Upload flyer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const courseId = parseInt(params.id, 10);
  
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }
  
  const course = getCourseById(courseId);
  
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('flyer') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: ERROR_MESSAGES.noFile }, { status: 400 });
    }
    
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidFileType }, { status: 400 });
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: ERROR_MESSAGES.fileTooLarge }, { status: 400 });
    }
    
    // Ensure upload directory exists
    ensureUploadDir();
    
    // Delete old flyer if exists
    const oldFlyerPath = getCourseFlyerPath(courseId);
    if (oldFlyerPath) {
      const oldFilePath = path.join(process.cwd(), 'public', oldFlyerPath);
      try {
        await unlink(oldFilePath);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }
    
    // Generate filename and save
    const extension = file.type === 'image/jpeg' ? 'jpg' : 'png';
    const filename = generateFilename(course.public_id, extension);
    const filePath = path.join(UPLOAD_DIR, filename);
    
    // Convert File to Buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    
    // Store relative path in database
    const relativePath = `/uploads/course-flyers/${filename}`;
    updateCourseFlyerPath(courseId, relativePath);
    
    return NextResponse.json({
      message: 'Флаєр успішно завантажено',
      flyer_path: relativePath,
    });
  } catch (error) {
    console.error('Upload flyer error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.uploadFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/courses/[id]/flyer - Delete flyer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  const courseId = parseInt(params.id, 10);
  
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }
  
  const course = getCourseById(courseId);
  
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  try {
    const flyerPath = getCourseFlyerPath(courseId);
    
    if (!flyerPath) {
      return NextResponse.json({ error: ERROR_MESSAGES.noFlyer }, { status: 404 });
    }
    
    // Delete file from filesystem
    const filePath = path.join(process.cwd(), 'public', flyerPath);
    try {
      await unlink(filePath);
    } catch {
      // Ignore errors if file doesn't exist
    }
    
    // Clear path in database
    updateCourseFlyerPath(courseId, null);
    
    return NextResponse.json({ message: 'Флаєр успішно видалено' });
  } catch (error) {
    console.error('Delete flyer error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.deleteFailed },
      { status: 500 }
    );
  }
}

// GET /api/courses/[id]/flyer - Get flyer info
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  const courseId = parseInt(params.id, 10);
  
  if (isNaN(courseId)) {
    return NextResponse.json({ error: ERROR_MESSAGES.invalidCourseId }, { status: 400 });
  }
  
  const course = getCourseById(courseId);
  
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  const flyerPath = getCourseFlyerPath(courseId);
  
  return NextResponse.json({
    flyer_path: flyerPath,
    has_flyer: !!flyerPath,
  });
}