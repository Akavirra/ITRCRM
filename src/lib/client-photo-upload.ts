const MAX_UPLOAD_BATCH_BYTES = 2.5 * 1024 * 1024;
const MAX_UPLOAD_BATCH_FILES = 1;
const MAX_IMAGE_DIMENSION = 2000;
const JPEG_QUALITY = 0.82;
const MIN_SIZE_FOR_COMPRESSION = 2 * 1024 * 1024;
const MAX_DIRECT_VIDEO_UPLOAD_BYTES = 4 * 1024 * 1024;

export function splitFilesIntoUploadBatches<T>(
  files: readonly T[],
  getSize: (file: T) => number = (file) => {
    if (typeof file === 'object' && file && 'size' in file && typeof (file as { size?: unknown }).size === 'number') {
      return (file as { size: number }).size;
    }
    return 0;
  }
): T[][] {
  const batches: T[][] = [];
  let currentBatch: T[] = [];
  let currentBytes = 0;

  for (const file of files) {
    const fileSize = getSize(file);
    const wouldOverflowSize = currentBatch.length > 0 && currentBytes + fileSize > MAX_UPLOAD_BATCH_BYTES;
    const wouldOverflowCount = currentBatch.length >= MAX_UPLOAD_BATCH_FILES;

    if (wouldOverflowSize || wouldOverflowCount) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }

    currentBatch.push(file);
    currentBytes += fileSize;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

export function getUploadErrorMessage(errorData: unknown, fallback: string): string {
  if (typeof errorData === 'object' && errorData && 'error' in errorData && typeof (errorData as { error?: unknown }).error === 'string') {
    return (errorData as { error: string }).error;
  }

  return fallback;
}

function formatSizeMb(sizeInBytes: number): string {
  return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export function getOversizedVideoUploadMessage(file: File): string | null {
  if (!file.type.startsWith('video/')) {
    return null;
  }

  if (file.size <= MAX_DIRECT_VIDEO_UPLOAD_BYTES) {
    return null;
  }

  return `Відео "${file.name}" має розмір ${formatSizeMb(file.size)}. Зараз через технічне обмеження можна завантажувати відео до ${formatSizeMb(MAX_DIRECT_VIDEO_UPLOAD_BYTES)} напряму з CRM або Telegram Mini App.`;
}

export function validateFilesBeforeUpload(files: readonly File[]): string | null {
  for (const file of files) {
    const videoMessage = getOversizedVideoUploadMessage(file);
    if (videoMessage) {
      return videoMessage;
    }
  }

  return null;
}

function shouldCompressImage(file: File): boolean {
  if (!file.type.startsWith('image/')) {
    return false;
  }

  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return false;
  }

  return file.size >= MIN_SIZE_FOR_COMPRESSION;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Не вдалося обробити файл ${file.name}`));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function prepareImageFileForUpload(file: File): Promise<File> {
  if (!shouldCompressImage(file)) {
    return file;
  }

  try {
    const image = await loadImage(file);
    const longestSide = Math.max(image.width, image.height);
    const scale = longestSide > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longestSide : 1;
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const normalizedName = file.name.replace(/\.[^.]+$/, '') || 'lesson-photo';
    return new File([blob], `${normalizedName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function prepareImageFilesForUpload(files: readonly File[]): Promise<File[]> {
  return Promise.all(files.map((file) => prepareImageFileForUpload(file)));
}
