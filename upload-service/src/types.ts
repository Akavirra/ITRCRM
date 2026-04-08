export interface UploadTokenPayload {
  lessonId: number;
  userId: number | null;
  userName: string | null;
  via: 'admin' | 'telegram';
  telegramId?: string | null;
  exp: number;
}

export interface LessonMediaContext {
  lessonId: number;
  courseTitle: string | null;
  groupTitle: string | null;
  lessonDate: string | null;
  topic: string | null;
}

export interface LessonPhotoFolderInfo {
  id: string;
  name: string;
  url: string;
  exists: boolean;
}

export interface FinalizeUploadResult {
  photoFolder: LessonPhotoFolderInfo | null;
  photos: unknown[];
  canManagePhotos?: boolean;
}
