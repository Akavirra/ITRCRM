import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden, notFound } from '@/lib/api-utils';
import { getCourseById, updateCourseFlyerPath, getCourseFlyerPath } from '@/lib/courses';
import { uploadBuffer, deleteImage, getPublicIdFromUrl } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

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
  
  const course = await getCourseById(courseId);
  
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
    
    // Delete old flyer if exists (Cloudinary URL)
    const oldFlyerPath = await getCourseFlyerPath(courseId);
    if (oldFlyerPath) {
      // Check if it's a Cloudinary URL
      if (oldFlyerPath.startsWith('https://')) {
        const oldPublicId = getPublicIdFromUrl(oldFlyerPath);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }
      // If it's a local path, we can't delete it but we'll replace it anyway
    }
    
    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Generate filename
    const extension = file.type === 'image/jpeg' ? 'jpg' : 'png';
    const filename = `flyer-${course.public_id}-${Date.now()}.${extension}`;
    
    // Upload to Cloudinary
    const uploadResult = await uploadBuffer(buffer, 'course-flyers', filename);
    
    // Store Cloudinary URL in database
    await updateCourseFlyerPath(courseId, uploadResult.url);
    
    return NextResponse.json({
      message: 'Флаєр успішно завантажено',
      flyer_path: uploadResult.url,
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
  
  const course = await getCourseById(courseId);
  
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  try {
    const flyerPath = await getCourseFlyerPath(courseId);
    
    if (!flyerPath) {
      return NextResponse.json({ error: ERROR_MESSAGES.noFlyer }, { status: 404 });
    }
    
    // Delete old Cloudinary flyer if exists
    if (flyerPath.startsWith('https://')) {
      const publicId = getPublicIdFromUrl(flyerPath);
      if (publicId) {
        await deleteImage(publicId);
      }
    }
    
    // Clear path in database
    await updateCourseFlyerPath(courseId, null);
    
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
  
  const course = await getCourseById(courseId);
  
  if (!course) {
    return notFound(ERROR_MESSAGES.courseNotFound);
  }
  
  const flyerPath = await getCourseFlyerPath(courseId);
  
  return NextResponse.json({
    flyer_path: flyerPath,
    has_flyer: !!flyerPath,
  });
}