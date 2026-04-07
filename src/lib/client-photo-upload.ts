const MAX_UPLOAD_BATCH_BYTES = 3.5 * 1024 * 1024;
const MAX_UPLOAD_BATCH_FILES = 2;

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
