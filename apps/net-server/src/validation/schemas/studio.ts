/**
 * Studio endpoint validation schemas.
 */

import { z } from 'zod';
import { uuidSchema, trimmedStringSchema, arraySchema } from './base';

/**
 * Project data schema (flexible structure).
 */
const projectDataSchema = z.record(z.unknown());

/**
 * Create studio project schema.
 */
export const createProjectSchema = z.object({
  name: trimmedStringSchema(200).min(1, 'Project name is required'),
  description: trimmedStringSchema(5000).optional(),
  tags: arraySchema(z.string(), 20).optional(),
});

/**
 * Update studio project schema.
 */
export const updateProjectSchema = z.object({
  name: trimmedStringSchema(200).optional(),
  description: trimmedStringSchema(5000).optional(),
  projectData: projectDataSchema.optional(),
  tags: arraySchema(z.string(), 20).optional(),
});

/**
 * Studio project ID param schema.
 */
export const studioProjectIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Create studio team schema.
 */
export const createStudioTeamSchema = z.object({
  name: trimmedStringSchema(200).min(1, 'Team name is required'),
  description: trimmedStringSchema(1000).optional(),
});

/**
 * Update studio team schema.
 */
export const updateStudioTeamSchema = z.object({
  name: trimmedStringSchema(200).optional(),
  description: trimmedStringSchema(1000).optional(),
});

/**
 * Studio team ID param schema.
 */
export const studioTeamIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Invite team member schema.
 */
export const inviteTeamMemberSchema = z
  .object({
    userId: uuidSchema.or(z.string().min(1)).optional(),
    email: z.string().email().optional(),
    username: trimmedStringSchema(100).optional(),
  })
  .refine((data) => data.userId || data.email || data.username, {
    message: 'Either userId, email, or username must be provided',
  });

/**
 * Team invitation ID param schema.
 */
export const teamInvitationIdParamSchema = z.object({
  id: uuidSchema.or(z.string().min(1)),
});

/**
 * Share project with team schema.
 */
export const shareProjectWithTeamSchema = z.object({
  teamId: uuidSchema.or(z.string().min(1)),
  accessLevel: z.enum(['read', 'write']),
});

/**
 * Update studio settings schema.
 */
export const updateStudioSettingsSchema = z.object({
  focus: z.enum(['games', 'assets', 'balanced']).optional(),
  goals: z
    .object({
      monthlyRevenueTarget: z.number().nonnegative().optional(),
      monthlyReleasesTarget: z.number().int().nonnegative().optional(),
      monthlyUpdatesTarget: z.number().int().nonnegative().optional(),
    })
    .optional(),
  cadenceTarget: z.number().int().positive().max(365).optional(),
  showRevenue: z.boolean().optional(),
  featureFlags: z.record(z.unknown()).optional(),
});

/**
 * Type exports.
 */
export type CreateProjectRequest = z.infer<typeof createProjectSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>;
export type StudioProjectIdParam = z.infer<typeof studioProjectIdParamSchema>;
export type CreateStudioTeamRequest = z.infer<typeof createStudioTeamSchema>;
export type UpdateStudioTeamRequest = z.infer<typeof updateStudioTeamSchema>;
export type StudioTeamIdParam = z.infer<typeof studioTeamIdParamSchema>;
export type InviteTeamMemberRequest = z.infer<typeof inviteTeamMemberSchema>;
export type TeamInvitationIdParam = z.infer<typeof teamInvitationIdParamSchema>;
export type ShareProjectWithTeamRequest = z.infer<typeof shareProjectWithTeamSchema>;
export type UpdateStudioSettingsRequest = z.infer<typeof updateStudioSettingsSchema>;
