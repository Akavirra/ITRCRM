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
  video?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string; width?: number; height?: number };
  document?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string };
  audio?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string };
  voice?: { file_id: string; file_size?: number; mime_type?: string };
  animation?: { file_id: string; file_size?: number; file_name?: string; mime_type?: string; width?: number; height?: number };
  caption?: string;
  forum_topic_created?: { name: string; icon_color?: number };
  forum_topic_edited?: { name?: string };
}

interface MediaInfo {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  type: MediaType;
  width?: number;
  height?: number;
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
      width: largest.width,
      height: largest.height,
    };
  }
  if (msg.video) {
    return {
      fileId: msg.video.file_id,
      fileName: msg.video.file_name ?? `video_${msg.message_id}.mp4`,
      mimeType: msg.video.mime_type ?? 'video/mp4',
      fileSize: msg.video.file_size ?? 0,
      type: 'video',
      width: msg.video.width,
      height: msg.video.height,
    };
  }
  if (msg.document) {
    const mime = msg.document.mime_type ?? 'application/octet-stream';
    const docType: MediaType = mime.startsWith('image/') ? 'photo'
      : mime.startsWith('video/') ? 'video'
      : mime.startsWith('audio/') ? 'audio'
      : 'document';
    return {
      fileId: msg.document.file_id,
      fileName: msg.document.file_name ?? `document_${msg.message_id}`,
      mimeType: mime,
      fileSize: msg.document.file_size ?? 0,
      type: docType,
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
      width: msg.animation.width,
      height: msg.animation.height,
    };
  }
  return null;
}

async function downloadFromTelegram(fileId: string): Promise<{ buffer: Buffer; filePath: string; telegramFileName: string }> {
  const botToken = process.env.MEDIA_BOT_TOKEN;
  if (!botToken) throw new Error('MEDIA_BOT_TOKEN is not set');

  const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
  if (!infoRes.ok) throw new Error(`Telegram getFile failed: ${await infoRes.text()}`);
  const info = await infoRes.json();
  if (!info.ok) throw new Error(`Telegram getFile error: ${info.description}`);

  const filePath: string = info.result.file_path;
  // Extract actual filename from Telegram's file path (e.g. "photos/file_abc123.jpg" → "file_abc123.jpg")
  const telegramFileName = filePath.split('/').pop() ?? filePath;

  const fileRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
  if (!fileRes.ok) throw new Error(`Telegram file download failed`);

  const arrayBuffer = await fileRes.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), filePath, telegramFileName };
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

async function handleTopicCreated(msg: TelegramMessage, name: string): Promise<void> {
  const threadId = msg.message_thread_id;
  if (!threadId) return;

  const existing = await get<{ id: number }>(
    'SELECT id FROM media_topics WHERE thread_id = $1',
    [threadId]
  );
  if (existing) {
    // Update name and Drive folder name
    const driveFolderId = await getOrCreateTopicFolder(name);
    await run(
      'UPDATE media_topics SET name = $1, drive_folder_id = $2 WHERE thread_id = $3',
      [name, driveFolderId, threadId]
    );
  } else {
    const driveFolderId = await getOrCreateTopicFolder(name);
    await run(
      'INSERT INTO media_topics (thread_id, name, drive_folder_id) VALUES ($1, $2, $3)',
      [threadId, name, driveFolderId]
    );
  }
  console.log(`[media-webhook] Topic ${threadId} registered/updated: "${name}"`);
}

async function handleTopicEdited(msg: TelegramMessage, name: string): Promise<void> {
  const threadId = msg.message_thread_id;
  if (!threadId) return;

  const existing = await get<{ id: number; drive_folder_id: string }>(
    'SELECT id, drive_folder_id FROM media_topics WHERE thread_id = $1',
    [threadId]
  );
  if (!existing) return;

  // Create new Drive folder with updated name, keep old files where they are
  const driveFolderId = await getOrCreateTopicFolder(name);
  await run(
    'UPDATE media_topics SET name = $1, drive_folder_id = $2 WHERE thread_id = $3',
    [name, driveFolderId, threadId]
  );
  console.log(`[media-webhook] Topic ${threadId} renamed to: "${name}"`);
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

  // Handle topic created/edited service messages
  if (msg.forum_topic_created?.name) {
    try { await handleTopicCreated(msg, msg.forum_topic_created.name); } catch (err) {
      console.error('[media-webhook] Error handling topic_created:', err);
    }
    return NextResponse.json({ ok: true });
  }
  if (msg.forum_topic_edited?.name) {
    try { await handleTopicEdited(msg, msg.forum_topic_edited.name); } catch (err) {
      console.error('[media-webhook] Error handling topic_edited:', err);
    }
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
    const { buffer, telegramFileName } = await downloadFromTelegram(media.fileId);

    // For photos/voice (no original name), use Telegram's server filename
    const fileName = (media.type === 'photo' || media.type === 'voice')
      ? telegramFileName
      : media.fileName;

    // Upload to Google Drive
    const driveFile = await uploadFileToDrive(
      buffer,
      fileName,
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
         drive_file_id, drive_view_url, drive_download_url, uploaded_by_telegram_id, uploaded_by_name,
         media_width, media_height)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        topicId,
        media.fileId,
        msg.message_id,
        fileName,
        media.type,
        media.fileSize,
        driveFile.id,
        getDriveViewUrl(driveFile.id),
        getDriveDownloadUrl(driveFile.id),
        msg.from?.id ?? null,
        uploaderName,
        media.width ?? null,
        media.height ?? null,
      ]
    );

    console.log(`[media-webhook] Uploaded ${media.fileName} to Drive (topic ${msg.message_thread_id})`);
  } catch (err) {
    console.error('[media-webhook] Error processing file:', err);
    // Return 200 so Telegram doesn't retry — log the error but don't crash
  }

  return NextResponse.json({ ok: true });
}
