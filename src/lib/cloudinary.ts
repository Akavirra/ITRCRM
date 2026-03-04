import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  secure_url: string;
}

/**
 * Upload an image to Cloudinary
 * @param base64String - Base64 encoded image string (with or without data URL prefix)
 * @param folder - Cloudinary folder path (e.g., 'students', 'teachers', 'course-flyers')
 * @returns Upload result with URL and public ID
 */
export async function uploadImage(base64String: string, folder: string): Promise<UploadResult> {
  // Remove data URL prefix if present
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  
  const result = await cloudinary.uploader.upload(
    `data:image/jpeg;base64,${base64Data}`,
    {
      folder: `itrcrm/${folder}`,
      resource_type: 'image',
      transformation: [
        { width: 800, height: 800, crop: 'limit' }, // Limit max size
        { quality: 'auto:good' }, // Optimize quality
        { fetch_format: 'auto' }, // Auto format (webp, avif, etc.)
      ],
    }
  );

  return {
    url: result.secure_url,
    publicId: result.public_id,
    secure_url: result.secure_url,
  };
}

/**
 * Upload a file buffer to Cloudinary
 * @param buffer - File buffer
 * @param folder - Cloudinary folder path
 * @param filename - Original filename for format detection
 * @returns Upload result with URL and public ID
 */
export async function uploadBuffer(
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<UploadResult> {
  // Detect format from filename
  const format = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';

  const result = await cloudinary.uploader.upload(
    `data:${mimeType};base64,${buffer.toString('base64')}`,
    {
      folder: `itrcrm/${folder}`,
      resource_type: 'image',
      public_id: `${folder}-${Date.now()}`,
      transformation: [
        { width: 1200, height: 1200, crop: 'limit' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    }
  );

  return {
    url: result.secure_url,
    publicId: result.public_id,
    secure_url: result.secure_url,
  };
}

/**
 * Delete an image from Cloudinary
 * @param publicId - The public ID of the image to delete
 * @returns Deletion result
 */
export async function deleteImage(publicId: string): Promise<{ result: string }> {
  const result = await cloudinary.uploader.destroy(publicId);
  return { result };
}

/**
 * Extract public ID from a Cloudinary URL
 * @param url - Cloudinary URL
 * @returns Public ID
 */
export function getPublicIdFromUrl(url: string): string | null {
  if (!url || !url.includes('cloudinary.com')) {
    return null;
  }

  // Extract public_id from URL
  // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{version}/{public_id}.{format}
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export default cloudinary;
