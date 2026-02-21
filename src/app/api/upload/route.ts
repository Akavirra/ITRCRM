import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, isAdmin, forbidden } from '@/lib/api-utils';
import { uploadBuffer, deleteImage, getPublicIdFromUrl } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Ukrainian error messages
const ERROR_MESSAGES = {
  noFile: 'Файл не обрано',
  invalidFileType: 'Непідтримуваний тип файлу. Дозволяються лише JPEG та PNG',
  fileTooLarge: 'Файл занадто великий. Максимальний розмір: 5MB',
  uploadFailed: 'Не вдалося завантажити файл',
  invalidFolder: 'Невірна папка. Дозволяються: students, teachers',
  deleteFailed: 'Не вдалося видалити файл',
};

const ALLOWED_FOLDERS = ['students', 'teachers'];

// POST /api/upload - Upload image
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = formData.get('folder') as string | null;
    
    if (!file) {
      return NextResponse.json({ error: ERROR_MESSAGES.noFile }, { status: 400 });
    }
    
    // Validate folder
    if (!folder || !ALLOWED_FOLDERS.includes(folder)) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidFolder }, { status: 400 });
    }
    
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: ERROR_MESSAGES.invalidFileType }, { status: 400 });
    }
    
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: ERROR_MESSAGES.fileTooLarge }, { status: 400 });
    }
    
    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Upload to Cloudinary
    const result = await uploadBuffer(buffer, folder, file.name);
    
    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.uploadFailed },
      { status: 500 }
    );
  }
}

// DELETE /api/upload - Delete image
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  
  if (!user) {
    return unauthorized();
  }
  
  if (!isAdmin(user)) {
    return forbidden();
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const publicId = searchParams.get('publicId');
    
    let idToDelete = publicId;
    
    // If no publicId provided, try to extract from URL
    if (!idToDelete && url) {
      idToDelete = getPublicIdFromUrl(url);
    }
    
    if (!idToDelete) {
      return NextResponse.json(
        { error: 'Не вказано URL або publicId файлу' },
        { status: 400 }
      );
    }
    
    await deleteImage(idToDelete);
    
    return NextResponse.json({ message: 'Файл успішно видалено' });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: ERROR_MESSAGES.deleteFailed },
      { status: 500 }
    );
  }
}
