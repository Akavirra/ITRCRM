import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { get, run, all } from '@/db';
import {
  getOrCreateTopicFolder,
  uploadFileToDrive,
  makeFilePublic,
  getDriveViewUrl,
  getDriveDownloadUrl,
} from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

const SUPPORTED_TYPES = ['photo', 'video', 'document', 'audio', 'voice', 'animation'] as const;
type MediaType = typeof SUPPORTED_TYPES[number];

function verifySecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  const expected = process.env.MEDIA_BOT_SECRET;
  if (!expected || !secret) return false;
  // Constant-time comparison
  const expectedBuf = Buffer.from(expected);
  const secretBuf = Buffer.from(secret);
  if (expectedBuf.length !== secretBuf.length) return false;
  return createHmac('sha256', 'verify').update(expectedBuf).digest().equals(
    createHmac('sha256', 'verify').update(secretBuf).digest()
  );
}

interface TelegramMessage {
  message_id: number;
  message_thread_id?: number;
  from?: { id: number; first_name?: string; last_name?: string; username?: string };
  chat: { id: number; type: string };
  photo?: Array<{ file_id: string; file_size?: number; width: number; height: number }>;
  video?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string };
  document?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string };
  audio?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string };
  voice?: { file_id: string; file_size?: number; mime_type?: string };
  animation?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string };
  caption?: string;
}

interface MediaInfo {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  type: MediaType;
}

function extractMedia(msg: TelegramMessage): MediaInfo | null {
  if (msg.photo?.length) {
    const largest = msg.photo[msg.photo.length - 1];
    return {
      fileId: largest.file_id,
      fileName: `photo_${msg.message_id}.jpg`,
      mimeType: 'image/jpeg',
      fileSize: largest.file_size ?? 0,
      type: 'photo',
    };
  }
  if (msg.video) {
    return {
      fileId: msg.video.file_id,
      fileName: msg.video.file_name ?? `video_${msg.message_id}.mp4`,
      mimeType: msg.video.mime_type ?? 'video/mp4',
      fileSize: msg.video.file_size ?? 0,
      type: 'video',
    };
  }
  if (msg.document) {
    return {
      fileId: msg.document.file_id,
      fileName: msg.document.file_name ?? `document_${msg.message_id}`,
      mimeType: msg.document.mime_type ?? 'application/octet-stream',
      fileSize: msg.document.file_size ?? 0,
      type: 'document',
    };
  }
  if (msg.audio) {
    return {
      fileId: msg.audio.file_id,
      fileName: msg.audio.file_name ?? `audio_${msg.message_id}.mp3`,
      mimeType: msg.audio.mime_type ?? 'audio/mpeg',
      fileSize: msg.audio.file_size ?? 0,
      type: 'audio',
    };
  }
  if (msg.voice) {
    return {
      fileId: msg.voice.file_id,
      fileName: `voice_${msg.message_id}.ogg`,
      mimeType: msg.voice.mime_type ?? 'audio/ogg',
      fileSize: msg.voice.file_size ?? 0,
      type: 'voice',
    };
  }
  if (msg.animation) {
    return {
      fileId: msg.animation.file_id,
      fileName: msg.animation.file_name ?? `animation_${msg.message_id}.gif`,
      mimeType: msg.animation.mime_type ?? 'image/gif',
      fileSize: msg.animation.file_size ?? 0,
      type: 'animation',
    };
  }
  return null;
}

async function downloadFromTelegram(fileId: string): Promise<{ buffer: Buffer; filePath: string }> {
  const botToken = process.env.MEDIA_BOT_TOKEN;
  if (!botToken) throw new Error('MEDIA_BOT_TOKEN is not set');

  // Get file path from Telegram
  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  if (!infoRes.ok) throw new Error(`Telegram getFile failed: ${await infoRes.text()}`);
  const info = await infoRes.json();
  if (!info.ok) throw new Error(`Telegram getFile error: ${info.description}`);

  const filePath: string = info.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileRes.ok) throw new Error(`Telegram file download failed`);

  const arrayBuffer = await fileRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), filePath };
}

async function getOrCreateTopic(threadId: number, topicName: string): Promise<number> {
  const existing = await get<{ id: number }>(
    'SELECT id FROM media_topics WHERE thread_id = $1',
    [threadId]
  );
  if (existing) return existing.id;

  const driveFolderId = await getOrCreateTopicFolder(topicName);
  const result = await get<{ id: number }>(
    'INSERT INTO media_topics (thread_id, name, drive_folder_id) VALUES ($1, $2, $3) RETURNING id',
    [threadId, topicName, driveFolderId]
  );
  return result!.id;
}

export async function POST(request: NextRequest) {
  if (!verifySecret(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: { message?: TelegramMessage };
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true });

  // Only process messages from the school group
  const groupId = process.env.TELEGRAM_SCHOOL_GROUP_ID;
  if (groupId && String(msg.chat.id) !== groupId) {
    return NextResponse.json({ ok: true });
  }

  // Only process messages in a thread (topic)
  if (!msg.message_thread_id) return NextResponse.json({ ok: true });

  const media = extractMedia(msg);
  if (!media) return NextResponse.json({ ok: true });

  // Ignore files > 20MB (Telegram Bot API limit)
  if (media.fileSize > 20 * 1024 * 1024) {
    console.warn(`File too large (${media.fileSize} bytes), skipping`);
    return NextResponse.json({ ok: true });
  }

  try {
    // Use thread_id as topic identifier; name will be updated when admin configures it
    const topicName = `Топік ${msg.message_thread_id}`;
    const topicId = await getOrCreateTopic(msg.message_thread_id, topicName);

    // Get Drive folder for this topic
    const topic = await get<{ drive_folder_id: string }>(
      'SELECT drive_folder_id FROM media_topics WHERE id = $1',
      [topicId]
    );
    if (!topic) throw new Error('Topic not found after creation');

    // Download from Telegram
    const { buffer } = await downloadFromTelegram(media.fileId);

    // Upload to Google Drive
    const driveFile = await uploadFileToDrive(
      buffer,
      media.fileName,
      media.mimeType,
      topic.drive_folder_id
    );

    // Make publicly accessible
    await makeFilePublic(driveFile.id);

    const uploaderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || null;

    // Save to DB
    await run(
      `INSERT INTO media_files
        (topic_id, telegram_file_id, telegram_message_id, file_name, file_type, file_size,
         drive_file_id, drive_view_url, drive_download_url, uploaded_by_telegram_id, uploaded_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        topicId,
        media.fileId,
        msg.message_id,
        media.fileName,
        media.type,
        media.fileSize,
        driveFile.id,
        getDriveViewUrl(driveFile.id),
        getDriveDownloadUrl(driveFile.id),
        msg.from?.id ?? null,
        uploaderName,
      ]
    );

    console.log(`[media-webhook] Uploaded ${media.fileName} to Drive (topic ${msg.message_thread_id})`);
  } catch (err) {
    console.error('[media-webhook] Error processing file:', err);
    // Return 200 so Telegram doesn't retry — log the error but don't crash
  }

  return NextResponse.json({ ok: true });
}
