/**
 * Validation utilities for user profile data
 */
const MAX_BIO_LENGTH = 500;
const MIN_DISPLAY_NAME_LENGTH = 2;
const MAX_DISPLAY_NAME_LENGTH = 50;
const MAX_AVATAR_URL_LENGTH = 2048;
// URL validation regex - allows http, https, data URIs
const URL_REGEX = /^(https?:\/\/|data:image\/)[^\s<>"{}|\\^`\[\]]+$/i;
export function validateBio(bio) {
    if (bio === undefined || bio === '') {
        return undefined; // Optional field
    }
    if (bio.length > MAX_BIO_LENGTH) {
        return `Bio must be ${MAX_BIO_LENGTH} characters or less`;
    }
    // Check for potentially dangerous content (basic XSS prevention)
    if (/<script|javascript:|onerror=|onload=/i.test(bio)) {
        return 'Bio contains invalid content';
    }
    return undefined;
}
export function validateDisplayName(displayName) {
    if (displayName === undefined || displayName === '') {
        return undefined; // Optional field
    }
    const trimmed = displayName.trim();
    if (trimmed.length < MIN_DISPLAY_NAME_LENGTH) {
        return `Display name must be at least ${MIN_DISPLAY_NAME_LENGTH} characters`;
    }
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
        return `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or less`;
    }
    // Prevent potentially dangerous content
    if (/<script|javascript:|onerror=|onload=/i.test(displayName)) {
        return 'Display name contains invalid content';
    }
    return undefined;
}
export function validateAvatarUrl(avatarUrl) {
    if (avatarUrl === undefined || avatarUrl === '') {
        return undefined; // Optional field
    }
    if (avatarUrl.length > MAX_AVATAR_URL_LENGTH) {
        return `Avatar URL must be ${MAX_AVATAR_URL_LENGTH} characters or less`;
    }
    if (!URL_REGEX.test(avatarUrl)) {
        return 'Avatar URL must be a valid HTTP/HTTPS URL or data URI';
    }
    // For data URIs, validate they're image data
    if (avatarUrl.startsWith('data:')) {
        if (!avatarUrl.startsWith('data:image/')) {
            return 'Data URI must be an image (data:image/...)';
        }
    }
    return undefined;
}
export function validateProfileUpdate(data) {
    const errors = {};
    const bioError = validateBio(data.bio);
    if (bioError) {
        errors.bio = bioError;
    }
    const displayNameError = validateDisplayName(data.displayName);
    if (displayNameError) {
        errors.displayName = displayNameError;
    }
    const avatarUrlError = validateAvatarUrl(data.avatarUrl);
    if (avatarUrlError) {
        errors.avatarUrl = avatarUrlError;
    }
    return errors;
}
export function hasValidationErrors(errors) {
    return Object.keys(errors).length > 0;
}
//# sourceMappingURL=profile.js.map