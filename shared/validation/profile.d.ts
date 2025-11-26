/**
 * Validation utilities for user profile data
 */
export interface ProfileValidationErrors {
    bio?: string;
    displayName?: string;
    avatarUrl?: string;
}
export declare function validateBio(bio?: string): string | undefined;
export declare function validateDisplayName(displayName?: string): string | undefined;
export declare function validateAvatarUrl(avatarUrl?: string): string | undefined;
export declare function validateProfileUpdate(data: {
    bio?: string;
    displayName?: string;
    avatarUrl?: string;
}): ProfileValidationErrors;
export declare function hasValidationErrors(errors: ProfileValidationErrors): boolean;
//# sourceMappingURL=profile.d.ts.map