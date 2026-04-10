# ITRCRM Upload Service

Small standalone upload service for large lesson media files. The main CRM stays on Vercel, while this service accepts large uploads and streams them into Google Drive.

## What this service does

- accepts large `multipart/form-data` uploads for lesson media
- verifies a short-lived JWT upload token issued by the CRM
- fetches lesson media context from the CRM
- creates the correct Google Drive folder structure
- uploads the file into Google Drive
- calls the CRM finalize endpoint so the uploaded file appears in the lesson gallery

## Expected CRM flow

1. CRM issues a short-lived upload token for a lesson
2. Browser uploads the file to this service
3. This service stores the file in Google Drive
4. This service calls back into the CRM finalize endpoint
5. CRM stores metadata in `lesson_photo_files`

## Required CRM internal endpoints

This scaffold expects the main CRM to expose:

- `GET /api/internal/lessons/:id/media-context`
- `POST /api/internal/lessons/:id/media-finalize`

Both endpoints should require the `X-Internal-Secret` header.

### `GET /api/internal/lessons/:id/media-context`

Expected response:

```json
{
  "lessonId": 83,
  "courseTitle": "Robotics Start",
  "groupTitle": "RS-12",
  "lessonDate": "2026-04-07",
  "topic": "Автомобіль"
}
```

### `POST /api/internal/lessons/:id/media-finalize`

Expected request body:

```json
{
  "driveFileId": "abc123",
  "fileName": "lesson-video.mp4",
  "mimeType": "video/mp4",
  "fileSize": 1234567,
  "uploadedBy": 5,
  "uploadedByName": "Admin User",
  "uploadedVia": "admin",
  "uploadedByTelegramId": null
}
```

Expected response:

```json
{
  "photoFolder": {
    "id": "folder-id",
    "name": "07.04.26 Автомобіль",
    "url": "https://drive.google.com/drive/folders/folder-id",
    "exists": true
  },
  "photos": []
}
```

## Local development

```bash
npm install
npm run dev
```

## Railway

1. Create an Empty Service
2. Connect this repo
3. Add variables from `.env.example`
4. Deploy

## Healthcheck

- `GET /health`

