import crypto from 'crypto';

// Character set for generating random alphanumeric strings (uppercase only)
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Prefixes for each entity type
export const PUBLIC_ID_PREFIXES = {
  student: 'STU',
  group: 'GRP',
  course: 'CRS',
  teacher: 'TCH',
} as const;

// Default length of the random part (after prefix and hyphen)
const DEFAULT_RANDOM_PART_LENGTH = 8;

// Min and max length for the random part
export const MIN_RANDOM_LENGTH = 8;
export const MAX_RANDOM_LENGTH = 10;

// Maximum retries for unique ID generation
export const MAX_RETRIES = 5;

/**
 * Generate a random alphanumeric string of specified length
 * Uses Node.js crypto for cryptographically secure random bytes
 */
function generateRandomString(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = '';
  
  for (let i = 0; i < length; i++) {
    // Use modulo to map byte value to charset index
    const index = bytes[i] % CHARSET.length;
    result += CHARSET[index];
  }
  
  return result;
}

/**
 * Generate a public ID for a specific entity type
 * Format: PREFIX-XXXXXXXX (e.g., STU-A1B2C3D4)
 * 
 * @param entityType - 'student', 'group', or 'course'
 * @param randomLength - Optional length of random part (8-10, defaults to 8)
 * @returns A unique public ID string
 */
export function generatePublicId(
  entityType: keyof typeof PUBLIC_ID_PREFIXES,
  randomLength: number = DEFAULT_RANDOM_PART_LENGTH
): string {
  // Clamp length to valid range
  const length = Math.max(MIN_RANDOM_LENGTH, Math.min(MAX_RANDOM_LENGTH, randomLength));
  const prefix = PUBLIC_ID_PREFIXES[entityType];
  const randomPart = generateRandomString(length);
  return `${prefix}-${randomPart}`;
}

/**
 * Validate that a public ID matches the expected format for an entity type
 * Supports variable length random parts (8-10 characters)
 * 
 * @param publicId - The public ID to validate
 * @param entityType - The expected entity type
 * @returns true if valid, false otherwise
 */
export function validatePublicId(
  publicId: string,
  entityType: keyof typeof PUBLIC_ID_PREFIXES
): boolean {
  const prefix = PUBLIC_ID_PREFIXES[entityType];
  // Pattern allows 8-10 uppercase alphanumeric characters after prefix
  const pattern = new RegExp(`^${prefix}-[A-Z0-9]{${MIN_RANDOM_LENGTH},${MAX_RANDOM_LENGTH}}$`);
  return pattern.test(publicId);
}

/**
 * Generate a unique public ID with retry logic
 * Retries up to MAX_RETRIES times if the uniqueness check fails
 * 
 * @param entityType - 'student', 'group', or 'course'
 * @param isUniqueCheck - Function that returns true if the ID is unique (not in DB). Can be sync or async.
 * @param randomLength - Optional length of random part (8-10, defaults to 8)
 * @returns The generated unique public ID, or throws if max retries exceeded
 * @throws Error if unable to generate a unique ID after MAX_RETRIES attempts
 */
export async function generateUniquePublicId(
  entityType: keyof typeof PUBLIC_ID_PREFIXES,
  isUniqueCheck: (id: string) => boolean | Promise<boolean>,
  randomLength: number = DEFAULT_RANDOM_PART_LENGTH
): Promise<string> {
  let attempts = 0;
  
  while (attempts < MAX_RETRIES) {
    const publicId = generatePublicId(entityType, randomLength);
    
    const isUnique = await Promise.resolve(isUniqueCheck(publicId));
    if (isUnique) {
      return publicId;
    }
    
    attempts++;
  }
  
  throw new Error(`Failed to generate unique public ID for ${entityType} after ${MAX_RETRIES} attempts`);
}