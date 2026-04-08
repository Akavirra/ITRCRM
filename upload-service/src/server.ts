import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import type { MultipartFile } from '@fastify/multipart';
import { config } from './config.js';
import { verifyUploadToken } from './auth.js';
import { fetchLessonMediaContext, finalizeLessonMediaUpload } from './crm.js';
import { ensureLessonFolder, makeFilePublic, uploadStreamToDrive } from './google-drive.js';

const app = Fastify({
  logger: true,
  bodyLimit: config.maxUploadBytes,
});

app.register(cors, {
  origin: config.allowedOrigins.length > 0 ? config.allowedOrigins : true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

app.register(multipart, {
  limits: {
    files: 1,
    fileSize: config.maxUploadBytes,
  },
});

app.get('/health', async () => ({
  ok: true,
  service: 'itrcrm-upload-service',
}));

app.post('/upload/lesson-media', async (request, reply) => {
  let token = '';
  let lessonIdFromForm: number | null = null;
  let filePart: MultipartFile | null = null;

  const parts = request.parts();

  for await (const part of parts) {
    if (part.type === 'file') {
      filePart = part;
      break;
    }

    if (part.fieldname === 'token') {
      token = String(part.value || '');
    }

    if (part.fieldname === 'lessonId') {
      const parsed = Number(part.value);
      lessonIdFromForm = Number.isFinite(parsed) ? parsed : null;
    }
  }

  if (!token) {
    return reply.code(400).send({ error: 'Missing upload token' });
  }

  if (!filePart) {
    return reply.code(400).send({ error: 'Missing file' });
  }

  const tokenPayload = verifyUploadToken(token);
  const lessonId = lessonIdFromForm ?? tokenPayload.lessonId;

  if (lessonId !== tokenPayload.lessonId) {
    return reply.code(403).send({ error: 'Token lesson does not match request lesson' });
  }

  const mimeType = filePart.mimetype || 'application/octet-stream';
  const fileName = filePart.filename || 'lesson-media';

  try {
    const context = await fetchLessonMediaContext(lessonId);
    const folder = await ensureLessonFolder(context);
    const uploadedFile = await uploadStreamToDrive({
      stream: filePart.file,
      folderId: folder.id,
      fileName,
      mimeType,
    });

    await makeFilePublic(uploadedFile.id);

    const result = await finalizeLessonMediaUpload(lessonId, tokenPayload, {
      driveFileId: uploadedFile.id,
      fileName: uploadedFile.name,
      mimeType: uploadedFile.mimeType,
      fileSize: uploadedFile.size,
    });

    return reply.send({
      ok: true,
      driveFileId: uploadedFile.id,
      fileName: uploadedFile.name,
      mimeType: uploadedFile.mimeType,
      photoFolder: result.photoFolder,
      photos: result.photos,
      canManagePhotos: result.canManagePhotos ?? true,
    });
  } catch (error) {
    request.log.error({ error }, 'Lesson media upload failed');
    return reply.code(500).send({
      error: error instanceof Error ? error.message : 'Lesson media upload failed',
    });
  }
});

app.listen({ port: config.port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
