/**
 * Studio API calls - Game Studio management
 */

import { apiClient } from './client';
import type { ProjectData } from '@engine/net';
import type { BlockDefinition } from '@engine/blocks';
import type { Vec3, Quat } from '@engine/core/math';

export interface StudioProject {
  id: string;
  userId: string;
  name: string;
  description?: string;
  projectData: ProjectData;
  thumbnailUrl?: string;
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  tags?: string[];
}

export interface StudioStats {
  userId: string;
  totalProjects: number;
  publishedProjects: number;
  totalViews: number;
  totalDownloads: number;
  totalLikes: number;
  studioRank?: number;
  lastUpdated: number;
}

export interface CreateStudioProjectRequest {
  name: string;
  description?: string;
  projectData: ProjectData;
  thumbnailUrl?: string;
  tags?: string[];
}

export interface UpdateStudioProjectRequest {
  name?: string;
  description?: string;
  projectData?: ProjectData;
  thumbnailUrl?: string;
  tags?: string[];
  isPublished?: boolean;
}

export interface PublishProjectRequest {
  title: string;
  description?: string;
  tags?: string[];
  price?: { currency: string; amount: number };
}

export interface LeaderboardEntry {
  userId: string;
  userName?: string;
  views: number;
  downloads: number;
  likes: number;
  projects: number;
  rank: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  metric: 'views' | 'downloads' | 'likes' | 'projects' | 'revenue' | 'score' | 'growth';
  period: 'all' | 'week' | 'month';
}

export interface StudioComparison {
  currentUser: {
    userId: string;
    totalProjects: number;
    publishedProjects: number;
    totalViews: number;
    totalDownloads: number;
    totalLikes: number;
  };
  comparedUser: {
    userId: string;
    totalProjects: number;
    publishedProjects: number;
    totalViews: number;
    totalDownloads: number;
    totalLikes: number;
  };
}

export interface StudioGoals {
  monthlyRevenueTarget?: number;
  monthlyReleasesTarget?: number;
  monthlyUpdatesTarget?: number;
}

export interface StudioSettings {
  userId: string;
  focus: 'games' | 'assets' | 'balanced';
  goals: StudioGoals;
  cadenceTarget: number;
  showRevenue: boolean;
  featureFlags?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface StudioRevenueResponse {
  gross: number;
  platformFee: number;
  net: number;
  topItems: Array<{ itemId: string; title?: string; gross: number }>;
  trend: Array<{ date: string; gross: number; net: number }>;
  period: 'week' | 'month' | 'quarter';
}

export interface StudioTeam {
  id: string;
  studioOwnerId: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: 'owner' | 'member';
  joinedAt: number;
  invitedBy: string;
  userName?: string;
  userEmail?: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeUserId?: string;
  inviteeEmail?: string;
  inviteeUsername?: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: number;
  createdAt: number;
}

export interface ProjectTeamAccess {
  projectId: string;
  teamId: string;
  accessLevel: 'read' | 'write';
  userId?: string;
}

export interface InviteMemberRequest {
  userId?: string;
  username?: string;
  email?: string;
}

export interface ShareProjectRequest {
  accessLevel: 'read' | 'write';
  userId?: string;
}

/**
 * Saved block data structure
 */
export interface SavedBlock {
  id: string;
  blockDefinition: BlockDefinition;
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
  createdAt: number;
  updatedAt: number;
}

/**
 * Request to save blocks
 */
export interface SaveBlocksRequest {
  blocks: Array<{
    blockDefinition: BlockDefinition;
    position: Vec3;
    rotation: Quat;
    scale: Vec3;
  }>;
}

export interface AvatarPreset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  avatarData: Record<string, unknown>; // AvatarLoadout
  thumbnailUrl?: string;
  tags: string[];
  isPublished: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateAvatarPresetRequest {
  name: string;
  description?: string;
  avatarData: Record<string, unknown>; // AvatarLoadout
  thumbnailUrl?: string;
  tags?: string[];
}

export interface UpdateAvatarPresetRequest {
  name?: string;
  description?: string;
  avatarData?: Record<string, unknown>; // AvatarLoadout
  thumbnailUrl?: string;
  tags?: string[];
  isPublished?: boolean;
}

export const studioApi = {
  /**
   * Get all projects for the current user
   */
  async getProjects(options?: { limit?: number; offset?: number }): Promise<{ projects: StudioProject[] }> {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset) {
      params.append('offset', String(options.offset));
    }
    const query = params.toString();
    return apiClient.get<{ projects: StudioProject[] }>(`/studio/projects${query ? `?${query}` : ''}`);
  },

  /**
   * Get a single project by ID
   */
  async getProject(id: string): Promise<StudioProject> {
    return apiClient.get<StudioProject>(`/studio/projects/${id}`);
  },

  /**
   * Create a new project
   */
  async createProject(data: CreateStudioProjectRequest): Promise<StudioProject> {
    return apiClient.post<StudioProject>('/studio/projects', data);
  },

  /**
   * Update a project
   */
  async updateProject(id: string, updates: UpdateStudioProjectRequest): Promise<StudioProject> {
    return apiClient.put<StudioProject>(`/studio/projects/${id}`, updates);
  },

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    return apiClient.delete(`/studio/projects/${id}`);
  },

  /**
   * Publish a project to marketplace
   */
  async publishProject(id: string, data: PublishProjectRequest): Promise<{ marketplaceItem: unknown; project: StudioProject }> {
    return apiClient.post(`/studio/projects/${id}/publish`, data);
  },

  /**
   * Get studio statistics for the current user
   */
  async getStats(): Promise<StudioStats> {
    return apiClient.get<StudioStats>('/studio/stats');
  },

  /**
   * Get studio leaderboard
   */
  async getLeaderboard(options?: {
    metric?: 'views' | 'downloads' | 'likes' | 'projects' | 'revenue' | 'score' | 'growth';
    period?: 'all' | 'week' | 'month';
    limit?: number;
  }): Promise<LeaderboardResponse> {
    const params = new URLSearchParams();
    if (options?.metric) {
      params.append('metric', options.metric);
    }
    if (options?.period) {
      params.append('period', options.period);
    }
    if (options?.limit) {
      params.append('limit', String(options.limit));
    }
    const query = params.toString();
    return apiClient.get<LeaderboardResponse>(`/studio/leaderboard${query ? `?${query}` : ''}`);
  },

  /**
   * Compare studio stats with another user
   */
  async compareStudio(userId: string): Promise<StudioComparison> {
    return apiClient.get<StudioComparison>(`/studio/compare/${userId}`);
  },

  // Settings
  async getSettings(): Promise<StudioSettings> {
    return apiClient.get<StudioSettings>('/studio/settings');
  },

  async updateSettings(settings: Partial<Pick<StudioSettings, 'focus' | 'goals' | 'cadenceTarget' | 'showRevenue' | 'featureFlags'>>): Promise<StudioSettings> {
    return apiClient.put<StudioSettings>('/studio/settings', settings as Record<string, unknown>);
  },

  // Revenue
  async getRevenue(options?: { period?: 'week' | 'month' | 'quarter' }): Promise<StudioRevenueResponse> {
    const params = new URLSearchParams();
    if (options?.period) params.append('period', options.period);
    const query = params.toString();
    return apiClient.get<StudioRevenueResponse>(`/studio/revenue${query ? `?${query}` : ''}`);
  },

  // Score
  async getScore(): Promise<{ score: number; breakdown: Record<string, number> }> {
    return apiClient.get<{ score: number; breakdown: Record<string, number> }>(`/studio/score`);
  },

  // Insights
  async getInsights(): Promise<{ insights: Array<{ id: string; message: string; impact: 'low'|'medium'|'high'; action?: { type: string; href?: string } }> }> {
    return apiClient.get(`/studio/insights`);
  },

  /**
   * ========================================
   * TEAM API
   * ========================================
   */

  /**
   * Create a team for the studio
   */
  async createTeam(data: { name: string; description?: string }): Promise<StudioTeam> {
    return apiClient.post<StudioTeam>('/studio/team', data);
  },

  /**
   * Get team for the studio
   */
  async getTeam(): Promise<StudioTeam> {
    return apiClient.get<StudioTeam>('/studio/team');
  },

  /**
   * Update team
   */
  async updateTeam(teamId: string, data: { name?: string; description?: string }): Promise<StudioTeam> {
    return apiClient.put<StudioTeam>(`/studio/team/${teamId}`, data);
  },

  /**
   * Delete team
   */
  async deleteTeam(teamId: string): Promise<void> {
    return apiClient.delete(`/studio/team/${teamId}`);
  },

  /**
   * Get team members
   */
  async getTeamMembers(): Promise<{ members: TeamMember[] }> {
    return apiClient.get<{ members: TeamMember[] }>('/studio/team/members');
  },

  /**
   * Invite user to team
   */
  async inviteMember(data: InviteMemberRequest): Promise<TeamInvitation> {
    return apiClient.post<TeamInvitation>('/studio/team/invite', data);
  },

  /**
   * Accept or decline invitation
   */
  async updateInvitation(invitationId: string, action: 'accept' | 'decline'): Promise<TeamInvitation> {
    return apiClient.put<TeamInvitation>(`/studio/team/invitations/${invitationId}`, { action });
  },

  /**
   * Get invitations
   */
  async getInvitations(teamId?: string): Promise<{ invitations: TeamInvitation[] }> {
    const params = teamId ? `?teamId=${teamId}` : '';
    return apiClient.get<{ invitations: TeamInvitation[] }>(`/studio/team/invitations${params}`);
  },

  /**
   * Remove member from team
   */
  async removeMember(userId: string): Promise<void> {
    return apiClient.delete(`/studio/team/members/${userId}`);
  },

  /**
   * Share project with team
   */
  async shareProjectWithTeam(projectId: string, data: ShareProjectRequest): Promise<ProjectTeamAccess> {
    return apiClient.post<ProjectTeamAccess>(`/studio/projects/${projectId}/share-team`, data);
  },

  /**
   * Get team access for a project
   */
  async getProjectTeamAccess(projectId: string): Promise<{ access: ProjectTeamAccess | null }> {
    return apiClient.get<{ access: ProjectTeamAccess | null }>(`/studio/projects/${projectId}/team-access`);
  },

  /**
   * Remove team access from project
   */
  async removeProjectTeamAccess(projectId: string): Promise<void> {
    return apiClient.delete(`/studio/projects/${projectId}/share-team`);
  },

  /**
   * Get projects shared with current user via teams
   */
  async getSharedProjects(): Promise<{
    projects: Array<{ project: StudioProject; access: ProjectTeamAccess }>;
  }> {
    return apiClient.get<{ projects: Array<{ project: StudioProject; access: ProjectTeamAccess }> }>(
      '/studio/shared-projects'
    );
  },

  /**
   * ========================================
   * BLOCKS API
   * ========================================
   */

  /**
   * Save blocks to API
   */
  async saveBlocks(data: SaveBlocksRequest): Promise<{ blocks: SavedBlock[] }> {
    return apiClient.post<{ blocks: SavedBlock[] }>('/studio/blocks', data);
  },

  /**
   * Get saved blocks from API
   */
  async getSavedBlocks(): Promise<{ blocks: SavedBlock[] }> {
    return apiClient.get<{ blocks: SavedBlock[] }>('/studio/blocks');
  },

  /**
   * ========================================
   * AVATAR PRESETS API
   * ========================================
   */

  /**
   * Get avatar presets for current user
   */
  async getAvatarPresets(): Promise<{ presets: AvatarPreset[] }> {
    return apiClient.get<{ presets: AvatarPreset[] }>('/studio/avatars');
  },

  /**
   * Create a new avatar preset
   */
  async createAvatarPreset(data: CreateAvatarPresetRequest): Promise<AvatarPreset> {
    return apiClient.post<AvatarPreset>('/studio/avatars', data);
  },

  /**
   * Get a single avatar preset
   */
  async getAvatarPreset(id: string): Promise<AvatarPreset> {
    return apiClient.get<AvatarPreset>(`/studio/avatars/${id}`);
  },

  /**
   * Update an avatar preset
   */
  async updateAvatarPreset(id: string, data: UpdateAvatarPresetRequest): Promise<AvatarPreset> {
    return apiClient.put<AvatarPreset>(`/studio/avatars/${id}`, data);
  },

  /**
   * Delete an avatar preset
   */
  async deleteAvatarPreset(id: string): Promise<void> {
    return apiClient.delete(`/studio/avatars/${id}`);
  },

  /**
   * Publish an avatar preset to marketplace
   */
  async publishAvatarPreset(id: string, data: { title: string; description?: string; tags?: string[] }): Promise<void> {
    return apiClient.post(`/studio/avatars/${id}/publish`, data);
  },

  /**
   * ========================================
   * MONETIZATION API
   * ========================================
   */

  /**
   * Get game monetization settings
   */
  async getMonetizationSettings(gameId: string): Promise<{
    gamePasses: GamePassConfig[];
    shopItems: ShopItemConfig[];
    revenue: RevenueStats;
  }> {
    return apiClient.get<{
      gamePasses: GamePassConfig[];
      shopItems: ShopItemConfig[];
      revenue: RevenueStats;
    }>(`/studio/games/${gameId}/monetization`);
  },

  /**
   * Create or update a game pass
   */
  async upsertGamePass(gameId: string, data: UpsertGamePassRequest): Promise<GamePassConfig> {
    return apiClient.post<GamePassConfig>(`/studio/games/${gameId}/monetization/passes`, data);
  },

  /**
   * Create or update a shop item
   */
  async upsertShopItem(gameId: string, data: UpsertShopItemRequest): Promise<ShopItemConfig> {
    return apiClient.post<ShopItemConfig>(`/studio/games/${gameId}/monetization/items`, data);
  },
};

export interface GamePassConfig {
  id: string;
  name: string;
  description?: string;
  monthlyPrice: { currency: string; amount: number };
  benefits: string[];
  active: boolean;
}

export interface ShopItemConfig {
  id: string;
  name: string;
  description?: string;
  price: { currency: string; amount: number };
  category: 'consumable' | 'cosmetic' | 'permanent';
  available: boolean;
  quantity?: number;
}

export interface UpsertGamePassRequest {
  id?: string;
  name: string;
  description?: string;
  monthlyPrice: { currency: string; amount: number };
  benefits: string[];
  active: boolean;
}

export interface UpsertShopItemRequest {
  id?: string;
  name: string;
  description?: string;
  price: { currency: string; amount: number };
  category: 'consumable' | 'cosmetic' | 'permanent';
  available: boolean;
  quantity?: number;
}

export interface RevenueStats {
  totalRevenue: { currency: string; amount: number };
  lastMonthRevenue: { currency: string; amount: number };
  creatorSplit: number; // percentage, e.g., 0.7 for 70%
}

