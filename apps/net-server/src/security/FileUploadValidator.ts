/**
 * File upload validation and security.
 * Validates file uploads for type, size, and malicious content.
 */

import { createHash } from 'node:crypto';
import path from 'node:path';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  size?: number;
}

/**
 * Allowed file types and their configurations.
 */
const ALLOWED_FILE_TYPES = {
  // Images
  'image/jpeg': { maxSize: 10 * 1024 * 1024, extensions: ['.jpg', '.jpeg'] },
  'image/png': { maxSize: 10 * 1024 * 1024, extensions: ['.png'] },
  'image/gif': { maxSize: 10 * 1024 * 1024, extensions: ['.gif'] },
  'image/webp': { maxSize: 10 * 1024 * 1024, extensions: ['.webp'] },

  // 3D models and assets
  'application/json': { maxSize: 50 * 1024 * 1024, extensions: ['.json'] }, // Project data
  'model/gltf+json': { maxSize: 50 * 1024 * 1024, extensions: ['.gltf'] },
  'model/gltf-binary': { maxSize: 100 * 1024 * 1024, extensions: ['.glb'] },

  // Audio
  'audio/mpeg': { maxSize: 10 * 1024 * 1024, extensions: ['.mp3'] },
  'audio/wav': { maxSize: 10 * 1024 * 1024, extensions: ['.wav'] },
  'audio/ogg': { maxSize: 10 * 1024 * 1024, extensions: ['.ogg'] },

  // Text files (for scripts, configs)
  'text/plain': { maxSize: 5 * 1024 * 1024, extensions: ['.txt', '.js', '.ts', '.tsx'] },
  'application/javascript': { maxSize: 5 * 1024 * 1024, extensions: ['.js'] },
  'text/typescript': { maxSize: 5 * 1024 * 1024, extensions: ['.ts', '.tsx'] },
} as const;

/**
 * Magic bytes (file signatures) for validation.
 */
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (partial, WebP is more complex)

  // JSON files start with '{' or '['
  'application/json': [],
  'model/gltf+json': [],
  'model/gltf-binary': [[0x67, 0x6c, 0x54, 0x46]], // "glTF"

  // Audio
  'audio/mpeg': [[0xff, 0xfb], [0xff, 0xf3], [0xff, 0xf2]],
  'audio/wav': [[0x52, 0x49, 0x46, 0x46]], // RIFF
  'audio/ogg': [[0x4f, 0x67, 0x67, 0x53]], // "OggS"

  // Text files - no magic bytes, validate by content
  'text/plain': [],
  'application/javascript': [],
  'text/typescript': [],
};

/**
 * File upload validator.
 */
export class FileUploadValidator {
  /**
   * Validate file by buffer content.
   */
  async validateFile(
    buffer: Buffer,
    filename?: string,
    declaredMimeType?: string
  ): Promise<FileValidationResult> {
    // Check file size
    const size = buffer.length;
    if (size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    // Determine MIME type from content (magic bytes)
    const detectedMimeType = this.detectMimeType(buffer);
    const mimeType = declaredMimeType || detectedMimeType;

    if (!mimeType) {
      return { valid: false, error: 'Unable to determine file type' };
    }

    // Check if MIME type is allowed
    const allowedType = ALLOWED_FILE_TYPES[mimeType as keyof typeof ALLOWED_FILE_TYPES];
    if (!allowedType) {
      return { valid: false, error: `File type ${mimeType} is not allowed` };
    }

    // Check file size
    if (size > allowedType.maxSize) {
      return {
        valid: false,
        error: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(allowedType.maxSize / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    // Validate file extension if filename provided
    if (filename) {
      const ext = path.extname(filename).toLowerCase();
      const isValidExtension = (allowedType.extensions as readonly string[]).includes(ext);
      if (!isValidExtension) {
        return { valid: false, error: `File extension ${ext} does not match MIME type ${mimeType}` };
      }

      // Sanitize filename (prevent path traversal)
      const sanitized = this.sanitizeFilename(filename);
      if (sanitized !== filename) {
        return { valid: false, error: 'Invalid filename - contains dangerous characters' };
      }
    }

    // Validate magic bytes match declared type
    if (declaredMimeType && detectedMimeType && declaredMimeType !== detectedMimeType) {
      return {
        valid: false,
        error: `File content does not match declared type. Detected: ${detectedMimeType}, declared: ${declaredMimeType}`,
      };
    }

    return {
      valid: true,
      mimeType,
      size,
    };
}

/**
 * Detect MIME type from buffer content using magic bytes.
 */
private detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) {
    return null;
  }

  const firstBytes = Array.from(buffer.slice(0, 12));

  // Check each known file signature
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of signatures) {
      if (signature.length === 0) continue; // Skip types without magic bytes

      if (firstBytes.length >= signature.length) {
        const matches = signature.every((byte, index) => firstBytes[index] === byte);
        if (matches) {
          return mimeType;
        }
      }
    }
  }

  // Check for JSON (starts with '{' or '[')
  const firstChar = buffer.toString('utf-8', 0, 1);
  if (firstChar === '{' || firstChar === '[') {
    try {
      JSON.parse(buffer.toString('utf-8'));
      return 'application/json';
    } catch {
      // Not valid JSON
    }
  }

  // Check for text files
  try {
    const text = buffer.toString('utf-8', 0, Math.min(512, buffer.length));
    if (this.isTextFile(text)) {
      return 'text/plain';
    }
  } catch {
    // Not text
  }

  return null;
}

/**
 * Check if content is a text file.
 */
private isTextFile(content: string): boolean {
  // Check for common text file patterns
  if (/^[\s\S]*$/.test(content) && content.length > 0) {
    // Check for non-printable characters (except common whitespace)
    const nonPrintable = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;
    const nonPrintableCount = (content.match(nonPrintable) || []).length;
    // Allow up to 5% non-printable characters (for some special characters)
    return nonPrintableCount / content.length < 0.05;
  }
  return false;
}

/**
 * Sanitize filename to prevent path traversal attacks.
 */
private sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = path.basename(filename);
  
  // Remove dangerous characters
  const sanitized = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Prevent hidden files
  if (sanitized.startsWith('.')) {
    return sanitized.substring(1);
  }

  // Prevent reserved names (Windows)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  const nameWithoutExt = path.parse(sanitized).name.toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    return `_${sanitized}`;
  }

  return sanitized;
}

/**
 * Generate secure random filename.
 */
generateSecureFilename(originalFilename: string, userId?: string): string {
  const ext = path.extname(originalFilename);
  const randomBytes = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}-${userId || ''}`)
    .digest('hex')
    .substring(0, 16);

  return `${randomBytes}${ext}`;
}

/**
 * Static method to generate safe filename (alias for generateSecureFilename).
 */
static generateSafeFilename(originalFilename: string, userId?: string): string {
  const ext = path.extname(originalFilename);
  const randomBytes = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}-${userId || ''}`)
    .digest('hex')
    .substring(0, 16);

  return `${randomBytes}${ext}`;
}

/**
 * Static method to check if buffer is a valid image.
 */
static isValidImage(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }

  const firstBytes = Array.from(buffer.slice(0, 12));
  
  // JPEG: FF D8 FF
  if (firstBytes[0] === 0xff && firstBytes[1] === 0xd8 && firstBytes[2] === 0xff) {
    return true;
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (firstBytes.length >= 8 &&
      firstBytes[0] === 0x89 &&
      firstBytes[1] === 0x50 &&
      firstBytes[2] === 0x4e &&
      firstBytes[3] === 0x47 &&
      firstBytes[4] === 0x0d &&
      firstBytes[5] === 0x0a &&
      firstBytes[6] === 0x1a &&
      firstBytes[7] === 0x0a) {
    return true;
  }
  
  // GIF: 47 49 46 38 37 61 or 47 49 46 38 39 61
  if (firstBytes.length >= 6 &&
      firstBytes[0] === 0x47 &&
      firstBytes[1] === 0x49 &&
      firstBytes[2] === 0x46 &&
      firstBytes[3] === 0x38 &&
      (firstBytes[4] === 0x37 || firstBytes[4] === 0x39) &&
      firstBytes[5] === 0x61) {
    return true;
  }
  
  // WebP: RIFF signature (partial check)
  if (firstBytes.length >= 4 &&
      firstBytes[0] === 0x52 &&
      firstBytes[1] === 0x49 &&
      firstBytes[2] === 0x46 &&
      firstBytes[3] === 0x46) {
    return true;
  }
  
  return false;
}
}

// Singleton instance
export const fileUploadValidator = new FileUploadValidator();

