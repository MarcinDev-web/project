/**
 * Marketplace validation module
 */

import DOMPurify from 'isomorphic-dompurify';

export interface ValidationError {
  field: string;
  message: string;
}

export interface MarketplaceValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Constants for validation limits
 */
const VALIDATION_LIMITS = {
  TITLE_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 5000,
  TAGS_MAX_COUNT: 20,
  TAG_MAX_LENGTH: 50,
  BUILD_DATA_MAX_SIZE_MB: 10,
} as const;

/**
 * Sanitize HTML content
 */
function sanitizeHtml(content: string, allowedTags?: string[]): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: allowedTags ?? [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Validate title
 */
function validateTitle(title: unknown): ValidationError | null {
  if (typeof title !== 'string') {
    return { field: 'title', message: 'Title must be a string' };
  }

  if (title.trim().length === 0) {
    return { field: 'title', message: 'Title cannot be empty' };
  }

  if (title.length > VALIDATION_LIMITS.TITLE_MAX_LENGTH) {
    return {
      field: 'title',
      message: `Title too long (max ${VALIDATION_LIMITS.TITLE_MAX_LENGTH} characters)`,
    };
  }

  return null;
}

/**
 * Validate description
 */
function validateDescription(description: unknown): ValidationError | null {
  if (description === undefined || description === null) {
    return null; // Optional field
  }

  if (typeof description !== 'string') {
    return { field: 'description', message: 'Description must be a string' };
  }

  if (description.length > VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH) {
    return {
      field: 'description',
      message: `Description too long (max ${VALIDATION_LIMITS.DESCRIPTION_MAX_LENGTH} characters)`,
    };
  }

  return null;
}

/**
 * Validate tags array
 */
function validateTags(tags: unknown): ValidationError | null {
  if (tags === undefined || tags === null) {
    return null; // Optional field
  }

  if (!Array.isArray(tags)) {
    return { field: 'tags', message: 'Tags must be an array' };
  }

  if (tags.length > VALIDATION_LIMITS.TAGS_MAX_COUNT) {
    return {
      field: 'tags',
      message: `Too many tags (max ${VALIDATION_LIMITS.TAGS_MAX_COUNT})`,
    };
  }

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof tag !== 'string') {
      return { field: `tags[${i}]`, message: 'Each tag must be a string' };
    }

    if (tag.length > VALIDATION_LIMITS.TAG_MAX_LENGTH) {
      return {
        field: `tags[${i}]`,
        message: `Tag too long (max ${VALIDATION_LIMITS.TAG_MAX_LENGTH} characters)`,
      };
    }

    if (tag.trim().length === 0) {
      return { field: `tags[${i}]`, message: 'Tag cannot be empty' };
    }
  }

  return null;
}

/**
 * Validate file URL
 */
function validateFileUrl(fileUrl: unknown): ValidationError | null {
  if (typeof fileUrl !== 'string') {
    return { field: 'fileUrl', message: 'File URL must be a string' };
  }

  if (fileUrl.trim().length === 0) {
    return { field: 'fileUrl', message: 'File URL cannot be empty' };
  }

  // Basic URL validation (check if it starts with http/https or /)
  try {
    if (
      !fileUrl.startsWith('http://') &&
      !fileUrl.startsWith('https://') &&
      !fileUrl.startsWith('/')
    ) {
      return { field: 'fileUrl', message: 'Invalid file URL format' };
    }
  } catch {
    return { field: 'fileUrl', message: 'Invalid file URL format' };
  }

  return null;
}

/**
 * Validate ProjectData structure
 */
function validateProjectDataStructure(buildData: unknown): ValidationError | null {
  if (!buildData || typeof buildData !== 'object') {
    return { field: 'buildData', message: 'Build data must be an object' };
  }

  const data = buildData as Record<string, unknown>;

  // Check metadata
  if (!data.metadata || typeof data.metadata !== 'object') {
    return { field: 'buildData.metadata', message: 'Build data must have metadata object' };
  }

  const metadata = data.metadata as Record<string, unknown>;
  if (typeof metadata.id !== 'string') {
    return { field: 'buildData.metadata.id', message: 'Metadata must have string id' };
  }
  if (typeof metadata.name !== 'string') {
    return { field: 'buildData.metadata.name', message: 'Metadata must have string name' };
  }

  // Check scene
  if (!data.scene || typeof data.scene !== 'object') {
    return { field: 'buildData.scene', message: 'Build data must have scene object' };
  }

  return null;
}

/**
 * Validate build data size
 */
function validateBuildDataSize(buildData: unknown): ValidationError | null {
  try {
    const jsonString = JSON.stringify(buildData);
    const sizeBytes = Buffer.byteLength(jsonString, 'utf-8');
    const sizeMB = sizeBytes / (1024 * 1024);

    if (sizeMB > VALIDATION_LIMITS.BUILD_DATA_MAX_SIZE_MB) {
      return {
        field: 'buildData',
        message: `Build data too large (max ${VALIDATION_LIMITS.BUILD_DATA_MAX_SIZE_MB}MB)`,
      };
    }

    return null;
  } catch (error) {
    return { field: 'buildData', message: 'Failed to validate build data size' };
  }
}

/**
 * Validate marketplace publish request
 */
export function validateMarketplacePublishRequest(body: unknown): MarketplaceValidationResult {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be an object' }],
    };
  }

  const data = body as Record<string, unknown>;

  // Validate required fields
  if (!data.type) {
    errors.push({ field: 'type', message: 'Type is required' });
  } else if (data.type !== 'build' && data.type !== 'avatar') {
    errors.push({ field: 'type', message: 'Type must be "build" or "avatar"' });
  }

  // Validate title
  const titleError = validateTitle(data.title);
  if (titleError) {
    errors.push(titleError);
  }

  // Validate description
  const descriptionError = validateDescription(data.description);
  if (descriptionError) {
    errors.push(descriptionError);
  }

  // Validate tags
  const tagsError = validateTags(data.tags);
  if (tagsError) {
    errors.push(tagsError);
  }

  // Validate fileUrl
  const fileUrlError = validateFileUrl(data.fileUrl);
  if (fileUrlError) {
    errors.push(fileUrlError);
  }

  // Validate buildData if provided
  if (data.buildData) {
    if (data.type !== 'build') {
      errors.push({ field: 'buildData', message: 'Build data can only be provided for builds' });
    } else {
      const structureError = validateProjectDataStructure(data.buildData);
      if (structureError) {
        errors.push(structureError);
      } else {
        const sizeError = validateBuildDataSize(data.buildData);
        if (sizeError) {
          errors.push(sizeError);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize marketplace publish request
 */
export function sanitizeMarketplacePublishRequest(
  body: Record<string, unknown>
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...body };

  // Sanitize title (no HTML allowed)
  if (typeof sanitized.title === 'string') {
    sanitized.title = sanitizeHtml(sanitized.title);
  }

  // Sanitize description (allow basic formatting)
  if (typeof sanitized.description === 'string') {
    sanitized.description = sanitizeHtml(sanitized.description, ['p', 'br']);
  }

  // Sanitize tags
  if (Array.isArray(sanitized.tags)) {
    sanitized.tags = sanitized.tags.map((tag: unknown) => {
      if (typeof tag === 'string') {
        return sanitizeHtml(tag);
      }
      return tag;
    });
  }

  return sanitized;
}

