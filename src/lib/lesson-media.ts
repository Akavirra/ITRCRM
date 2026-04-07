const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mpeg', '.mpg', '.3gp', '.mkv'];

export function isImageMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('image/');
}

export function isVideoMimeType(mimeType: string | null | undefined): boolean {
  return typeof mimeType === 'string' && mimeType.startsWith('video/');
}

export function isSupportedLessonMediaFile(file: File): boolean {
  if (file.type && (isImageMimeType(file.type) || isVideoMimeType(file.type))) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS].some((ext) => lowerName.endsWith(ext));
}

export function resolveLessonMediaMimeType(file: File): string {
  if (file.type && (isImageMimeType(file.type) || isVideoMimeType(file.type))) {
    return file.type;
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.heic')) return 'image/heic';
  if (lowerName.endsWith('.heif')) return 'image/heif';
  if (lowerName.endsWith('.mov')) return 'video/quicktime';
  if (lowerName.endsWith('.webm')) return 'video/webm';
  if (lowerName.endsWith('.m4v')) return 'video/x-m4v';
  if (lowerName.endsWith('.avi')) return 'video/x-msvideo';
  if (lowerName.endsWith('.mpeg') || lowerName.endsWith('.mpg')) return 'video/mpeg';
  if (lowerName.endsWith('.3gp')) return 'video/3gpp';
  if (lowerName.endsWith('.mkv')) return 'video/x-matroska';
  if (lowerName.endsWith('.mp4')) return 'video/mp4';
  return 'image/jpeg';
}
