/**
 * Studio Team Storage - manages teams, members, invitations and project access
 * Supports both PostgreSQL (preferred) and JSON file storage (fallback)
 */

import type { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'fs';
import path from 'path';

export interface StudioTeam {
  id: string;
  studioOwnerId: string; // User ID właściciela studia
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: 'owner' | 'member'; // Only owner and member roles
  joinedAt: number;
  invitedBy: string;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeUserId?: string;
  inviteeEmail?: string;
  inviteeUsername?: string; // For search by username
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: number;
  createdAt: number;
}

export interface ProjectTeamAccess {
  projectId: string;
  teamId: string;
  accessLevel: 'read' | 'write'; // Only read and write, publish is owner-only
  userId?: string; // Specific member assigned to this project
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
}

export interface InviteMemberRequest {
  userId?: string;
  username?: string;
  email?: string;
}

/**
 * PostgreSQL-based storage for studio teams
 */
export class StudioTeamStorageDB {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
  }

  private generateToken(): string {
    const bytes = randomBytes(32);
    return bytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async createTeam(studioOwnerId: string, data: CreateTeamRequest): Promise<StudioTeam> {
    // Check if team already exists for this studio
    const existing = await this.getTeamByStudioOwner(studioOwnerId);
    if (existing) {
      throw new Error('Team already exists for this studio');
    }

    const id = `team_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create team
      await client.query(
        `INSERT INTO studio_teams (id, studio_owner_id, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [id, studioOwnerId, data.name, data.description || null]
      );

      // Add owner as member
      await client.query(
        `INSERT INTO team_members (team_id, user_id, role, joined_at, invited_by)
         VALUES ($1, $2, $3, NOW(), $2)`,
        [id, studioOwnerId, 'owner']
      );

      await client.query('COMMIT');

      return this.getTeam(id) as Promise<StudioTeam>;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getTeam(teamId: string): Promise<StudioTeam | null> {
    const result = await this.pool.query<{
      id: string;
      studio_owner_id: string;
      name: string;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM studio_teams WHERE id = $1', [teamId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    const team: StudioTeam = {
      id: row.id,
      studioOwnerId: row.studio_owner_id,
      name: row.name,
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
    };
    
    if (row.description !== null) {
      team.description = row.description;
    }
    
    return team;
  }

  async getTeamByStudioOwner(studioOwnerId: string): Promise<StudioTeam | null> {
    const result = await this.pool.query<{
      id: string;
      studio_owner_id: string;
      name: string;
      description: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM studio_teams WHERE studio_owner_id = $1', [studioOwnerId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    const team: StudioTeam = {
      id: row.id,
      studioOwnerId: row.studio_owner_id,
      name: row.name,
      createdAt: row.created_at.getTime(),
      updatedAt: row.updated_at.getTime(),
    };
    
    if (row.description !== null) {
      team.description = row.description;
    }
    
    return team;
  }

  async updateTeam(teamId: string, updates: { name?: string; description?: string }): Promise<StudioTeam> {
    const updatesList: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      updatesList.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      updatesList.push(`description = $${paramIndex++}`);
      params.push(updates.description || null);
    }

    if (updatesList.length === 0) {
      return this.getTeam(teamId) as Promise<StudioTeam>;
    }

    updatesList.push(`updated_at = NOW()`);
    params.push(teamId);

    await this.pool.query(
      `UPDATE studio_teams SET ${updatesList.join(', ')} WHERE id = $${paramIndex}`,
      params
    );

    return this.getTeam(teamId) as Promise<StudioTeam>;
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM studio_teams WHERE id = $1', [teamId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getMembers(teamId: string): Promise<TeamMember[]> {
    const result = await this.pool.query<{
      team_id: string;
      user_id: string;
      role: string;
      joined_at: Date;
      invited_by: string;
    }>('SELECT * FROM team_members WHERE team_id = $1 ORDER BY joined_at ASC', [teamId]);

    return result.rows.map((row) => ({
      teamId: row.team_id,
      userId: row.user_id,
      role: row.role as 'owner' | 'member',
      joinedAt: row.joined_at.getTime(),
      invitedBy: row.invited_by,
    }));
  }

  async addMember(teamId: string, userId: string, invitedBy: string): Promise<TeamMember> {
    await this.pool.query(
      `INSERT INTO team_members (team_id, user_id, role, joined_at, invited_by)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (team_id, user_id) DO NOTHING`,
      [teamId, userId, 'member', invitedBy]
    );

    const members = await this.getMembers(teamId);
    return members.find((m) => m.userId === userId)!;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    // Don't allow removing owner
    const member = await this.getMember(teamId, userId);
    if (member?.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    const result = await this.pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const result = await this.pool.query<{
      team_id: string;
      user_id: string;
      role: string;
      joined_at: Date;
      invited_by: string;
    }>('SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    return {
      teamId: row.team_id,
      userId: row.user_id,
      role: row.role as 'owner' | 'member',
      joinedAt: row.joined_at.getTime(),
      invitedBy: row.invited_by,
    };
  }

  async createInvitation(
    teamId: string,
    inviterId: string,
    request: InviteMemberRequest
  ): Promise<TeamInvitation> {
    const token = this.generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    await this.pool.query(
      `INSERT INTO team_invitations (
        id, team_id, inviter_id, invitee_user_id, invitee_email, invitee_username,
        token, status, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TO_TIMESTAMP($9 / 1000.0), NOW())`,
      [
        id,
        teamId,
        inviterId,
        request.userId || null,
        request.email || null,
        request.username || null,
        token,
        'pending',
        expiresAt,
      ]
    );

    return this.getInvitation(id) as Promise<TeamInvitation>;
  }

  async getInvitation(invitationId: string): Promise<TeamInvitation | null> {
    const result = await this.pool.query<{
      id: string;
      team_id: string;
      inviter_id: string;
      invitee_user_id: string | null;
      invitee_email: string | null;
      invitee_username: string | null;
      token: string;
      status: string;
      expires_at: Date;
      created_at: Date;
    }>('SELECT * FROM team_invitations WHERE id = $1', [invitationId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    const invitation: TeamInvitation = {
      id: row.id,
      teamId: row.team_id,
      inviterId: row.inviter_id,
      token: row.token,
      status: row.status as TeamInvitation['status'],
      expiresAt: row.expires_at.getTime(),
      createdAt: row.created_at.getTime(),
    };
    
    if (row.invitee_user_id !== null) {
      invitation.inviteeUserId = row.invitee_user_id;
    }
    if (row.invitee_email !== null) {
      invitation.inviteeEmail = row.invitee_email;
    }
    if (row.invitee_username !== null) {
      invitation.inviteeUsername = row.invitee_username;
    }
    
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | null> {
    const result = await this.pool.query<{
      id: string;
      team_id: string;
      inviter_id: string;
      invitee_user_id: string | null;
      invitee_email: string | null;
      invitee_username: string | null;
      token: string;
      status: string;
      expires_at: Date;
      created_at: Date;
    }>('SELECT * FROM team_invitations WHERE token = $1', [token]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    const invitation: TeamInvitation = {
      id: row.id,
      teamId: row.team_id,
      inviterId: row.inviter_id,
      token: row.token,
      status: row.status as TeamInvitation['status'],
      expiresAt: row.expires_at.getTime(),
      createdAt: row.created_at.getTime(),
    };
    
    if (row.invitee_user_id !== null) {
      invitation.inviteeUserId = row.invitee_user_id;
    }
    if (row.invitee_email !== null) {
      invitation.inviteeEmail = row.invitee_email;
    }
    if (row.invitee_username !== null) {
      invitation.inviteeUsername = row.invitee_username;
    }
    
    return invitation;
  }

  async getInvitations(teamId?: string, userId?: string): Promise<TeamInvitation[]> {
    let query = 'SELECT * FROM team_invitations WHERE 1=1';
    const params: unknown[] = [];
    let paramIndex = 1;

    if (teamId) {
      query += ` AND team_id = $${paramIndex++}`;
      params.push(teamId);
    }

    if (userId) {
      query += ` AND (invitee_user_id = $${paramIndex} OR inviter_id = $${paramIndex})`;
      params.push(userId);
      paramIndex++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query<{
      id: string;
      team_id: string;
      inviter_id: string;
      invitee_user_id: string | null;
      invitee_email: string | null;
      invitee_username: string | null;
      token: string;
      status: string;
      expires_at: Date;
      created_at: Date;
    }>(query, params);

    return result.rows.map((row) => {
      const invitation: TeamInvitation = {
        id: row.id,
        teamId: row.team_id,
        inviterId: row.inviter_id,
        token: row.token,
        status: row.status as TeamInvitation['status'],
        expiresAt: row.expires_at.getTime(),
        createdAt: row.created_at.getTime(),
      };
      
      if (row.invitee_user_id !== null) {
        invitation.inviteeUserId = row.invitee_user_id;
      }
      if (row.invitee_email !== null) {
        invitation.inviteeEmail = row.invitee_email;
      }
      if (row.invitee_username !== null) {
        invitation.inviteeUsername = row.invitee_username;
      }
      
      return invitation;
    });
  }

  async updateInvitation(
    invitationId: string,
    status: 'accepted' | 'declined' | 'expired'
  ): Promise<TeamInvitation> {
    await this.pool.query('UPDATE team_invitations SET status = $1 WHERE id = $2', [
      status,
      invitationId,
    ]);

    return this.getInvitation(invitationId) as Promise<TeamInvitation>;
  }

  async deleteInvitation(invitationId: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM team_invitations WHERE id = $1', [
      invitationId,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async cleanupExpiredInvitations(): Promise<void> {
    await this.pool.query(
      `UPDATE team_invitations 
       SET status = 'expired' 
       WHERE status = 'pending' AND expires_at < NOW()`
    );
  }

  async shareProjectWithTeam(
    projectId: string,
    teamId: string,
    accessLevel: 'read' | 'write',
    userId?: string
  ): Promise<ProjectTeamAccess> {
    await this.pool.query(
      `INSERT INTO project_team_access (project_id, team_id, access_level, user_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, team_id) 
       DO UPDATE SET access_level = $3, user_id = $4`,
      [projectId, teamId, accessLevel, userId || null]
    );

    const access = await this.getProjectTeamAccess(projectId, teamId);
    if (!access) {
      throw new Error('Failed to create project team access');
    }
    return access;
  }

  async getProjectTeamAccess(projectId: string, teamId: string): Promise<ProjectTeamAccess | null> {
    const result = await this.pool.query<{
      project_id: string;
      team_id: string;
      access_level: string;
      user_id: string | null;
    }>('SELECT * FROM project_team_access WHERE project_id = $1 AND team_id = $2', [
      projectId,
      teamId,
    ]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    const access: ProjectTeamAccess = {
      projectId: row.project_id,
      teamId: row.team_id,
      accessLevel: row.access_level as 'read' | 'write',
    };
    
    if (row.user_id !== null) {
      access.userId = row.user_id;
    }
    
    return access;
  }

  async getProjectsForTeam(teamId: string): Promise<ProjectTeamAccess[]> {
    const result = await this.pool.query<{
      project_id: string;
      team_id: string;
      access_level: string;
      user_id: string | null;
    }>('SELECT * FROM project_team_access WHERE team_id = $1', [teamId]);

    return result.rows.map((row) => {
      const access: ProjectTeamAccess = {
        projectId: row.project_id,
        teamId: row.team_id,
        accessLevel: row.access_level as 'read' | 'write',
      };
      
      if (row.user_id !== null) {
        access.userId = row.user_id;
      }
      
      return access;
    });
  }

  async getProjectsForUser(userId: string): Promise<ProjectTeamAccess[]> {
    // Get all teams user is member of
    const teams = await this.pool.query<{ team_id: string }>(
      'SELECT team_id FROM team_members WHERE user_id = $1',
      [userId]
    );

    if (teams.rows.length === 0) {
      return [];
    }

    const teamIds = teams.rows.map((r) => r.team_id);
    const result = await this.pool.query<{
      project_id: string;
      team_id: string;
      access_level: string;
      user_id: string | null;
    }>(
      `SELECT * FROM project_team_access 
       WHERE team_id = ANY($1) 
       AND (user_id IS NULL OR user_id = $2)`,
      [teamIds, userId]
    );

    return result.rows.map((row) => {
      const access: ProjectTeamAccess = {
        projectId: row.project_id,
        teamId: row.team_id,
        accessLevel: row.access_level as 'read' | 'write',
      };
      
      if (row.user_id !== null) {
        access.userId = row.user_id;
      }
      
      return access;
    });
  }

  async removeProjectTeamAccess(projectId: string, teamId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM project_team_access WHERE project_id = $1 AND team_id = $2',
      [projectId, teamId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

/**
 * JSON file-based storage for studio teams (fallback)
 */
export class StudioTeamStorage {
  private readonly dataDir: string;
  private readonly teamsFile: string;
  private readonly membersFile: string;
  private readonly invitationsFile: string;
  private readonly accessFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.teamsFile = path.join(dataDir, 'studio-teams.json');
    this.membersFile = path.join(dataDir, 'team-members.json');
    this.invitationsFile = path.join(dataDir, 'team-invitations.json');
    this.accessFile = path.join(dataDir, 'project-team-access.json');
  }

  private generateToken(): string {
    const bytes = randomBytes(32);
    return bytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    for (const file of [this.teamsFile, this.membersFile, this.invitationsFile, this.accessFile]) {
      try {
        await fs.access(file);
      } catch {
        await fs.writeFile(file, JSON.stringify({}, null, 2));
      }
    }
  }

  private async readTeams(): Promise<Record<string, StudioTeam>> {
    try {
      const data = await fs.readFile(this.teamsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeTeams(teams: Record<string, StudioTeam>): Promise<void> {
    await fs.writeFile(this.teamsFile, JSON.stringify(teams, null, 2));
  }

  private async readMembers(): Promise<Record<string, TeamMember[]>> {
    try {
      const data = await fs.readFile(this.membersFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeMembers(members: Record<string, TeamMember[]>): Promise<void> {
    await fs.writeFile(this.membersFile, JSON.stringify(members, null, 2));
  }

  private async readInvitations(): Promise<Record<string, TeamInvitation>> {
    try {
      const data = await fs.readFile(this.invitationsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeInvitations(invitations: Record<string, TeamInvitation>): Promise<void> {
    await fs.writeFile(this.invitationsFile, JSON.stringify(invitations, null, 2));
  }

  private async readAccess(): Promise<Record<string, ProjectTeamAccess[]>> {
    try {
      const data = await fs.readFile(this.accessFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async writeAccess(access: Record<string, ProjectTeamAccess[]>): Promise<void> {
    await fs.writeFile(this.accessFile, JSON.stringify(access, null, 2));
  }

  async createTeam(studioOwnerId: string, data: CreateTeamRequest): Promise<StudioTeam> {
    const teams = await this.readTeams();

    // Check if team already exists
    const existing = Object.values(teams).find((t) => t.studioOwnerId === studioOwnerId);
    if (existing) {
      throw new Error('Team already exists for this studio');
    }

    const id = `team_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = Date.now();

    const team: StudioTeam = {
      id,
      studioOwnerId,
      name: data.name,
      ...(data.description !== undefined && { description: data.description }),
      createdAt: now,
      updatedAt: now,
    };

    teams[id] = team;
    await this.writeTeams(teams);

    // Add owner as member
    await this.addMember(id, studioOwnerId, studioOwnerId);

    return team;
  }

  async getTeam(teamId: string): Promise<StudioTeam | null> {
    const teams = await this.readTeams();
    return teams[teamId] || null;
  }

  async getTeamByStudioOwner(studioOwnerId: string): Promise<StudioTeam | null> {
    const teams = await this.readTeams();
    return Object.values(teams).find((t) => t.studioOwnerId === studioOwnerId) || null;
  }

  async updateTeam(teamId: string, updates: { name?: string; description?: string }): Promise<StudioTeam> {
    const teams = await this.readTeams();
    const team = teams[teamId];
    if (!team) {
      throw new Error('Team not found');
    }

    const updated: StudioTeam = {
      ...team,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      updatedAt: Date.now(),
    };

    teams[teamId] = updated;
    await this.writeTeams(teams);

    return updated;
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    const teams = await this.readTeams();
    if (!teams[teamId]) {
      return false;
    }

    delete teams[teamId];
    await this.writeTeams(teams);

    // Also remove members and access
    const members = await this.readMembers();
    delete members[teamId];
    await this.writeMembers(members);

    const access = await this.readAccess();
    delete access[teamId];
    await this.writeAccess(access);

    return true;
  }

  async getMembers(teamId: string): Promise<TeamMember[]> {
    const members = await this.readMembers();
    return members[teamId] || [];
  }

  async addMember(teamId: string, userId: string, invitedBy: string): Promise<TeamMember> {
    const members = await this.readMembers();
    if (!members[teamId]) {
      members[teamId] = [];
    }

    // Check if already member
    if (members[teamId]!.some((m) => m.userId === userId)) {
      return members[teamId]!.find((m) => m.userId === userId)!;
    }

    const member: TeamMember = {
      teamId,
      userId,
      role: 'member',
      joinedAt: Date.now(),
      invitedBy,
    };

    members[teamId]!.push(member);
    await this.writeMembers(members);

    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    const members = await this.readMembers();
    const teamMembers = members[teamId];
    if (!teamMembers) {
      return false;
    }

    const member = teamMembers.find((m) => m.userId === userId);
    if (member?.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    const index = teamMembers.findIndex((m) => m.userId === userId);
    if (index === -1) {
      return false;
    }

    teamMembers.splice(index, 1);
    await this.writeMembers(members);

    return true;
  }

  async getMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const members = await this.readMembers();
    const teamMembers = members[teamId] || [];
    return teamMembers.find((m) => m.userId === userId) || null;
  }

  async createInvitation(
    teamId: string,
    inviterId: string,
    request: InviteMemberRequest
  ): Promise<TeamInvitation> {
    const invitations = await this.readInvitations();
    const token = this.generateToken();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const invitation: TeamInvitation = {
      id,
      teamId,
      inviterId,
      ...(request.userId !== undefined && { inviteeUserId: request.userId }),
      ...(request.email !== undefined && { inviteeEmail: request.email }),
      ...(request.username !== undefined && { inviteeUsername: request.username }),
      token,
      status: 'pending',
      expiresAt,
      createdAt: Date.now(),
    };

    invitations[id] = invitation;
    await this.writeInvitations(invitations);

    return invitation;
  }

  async getInvitation(invitationId: string): Promise<TeamInvitation | null> {
    const invitations = await this.readInvitations();
    return invitations[invitationId] || null;
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | null> {
    const invitations = await this.readInvitations();
    return Object.values(invitations).find((inv) => inv.token === token) || null;
  }

  async getInvitations(teamId?: string, userId?: string): Promise<TeamInvitation[]> {
    const invitations = await this.readInvitations();
    let filtered = Object.values(invitations);

    if (teamId) {
      filtered = filtered.filter((inv) => inv.teamId === teamId);
    }

    if (userId) {
      filtered = filtered.filter(
        (inv) => inv.inviteeUserId === userId || inv.inviterId === userId
      );
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  }

  async updateInvitation(
    invitationId: string,
    status: 'accepted' | 'declined' | 'expired'
  ): Promise<TeamInvitation> {
    const invitations = await this.readInvitations();
    const invitation = invitations[invitationId];
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const updated: TeamInvitation = {
      ...invitation,
      status,
    };

    invitations[invitationId] = updated;
    await this.writeInvitations(invitations);

    return updated;
  }

  async deleteInvitation(invitationId: string): Promise<boolean> {
    const invitations = await this.readInvitations();
    if (!invitations[invitationId]) {
      return false;
    }

    delete invitations[invitationId];
    await this.writeInvitations(invitations);

    return true;
  }

  async cleanupExpiredInvitations(): Promise<void> {
    const invitations = await this.readInvitations();
    const now = Date.now();

    for (const [_id, invitation] of Object.entries(invitations)) {
      if (invitation.status === 'pending' && invitation.expiresAt < now) {
        invitation.status = 'expired';
      }
    }

    await this.writeInvitations(invitations);
  }

  async shareProjectWithTeam(
    projectId: string,
    teamId: string,
    accessLevel: 'read' | 'write',
    userId?: string
  ): Promise<ProjectTeamAccess> {
    const access = await this.readAccess();
    if (!access[teamId]) {
      access[teamId] = [];
    }

    const existing = access[teamId]!.findIndex((a) => a.projectId === projectId);
    const newAccess: ProjectTeamAccess = {
      projectId,
      teamId,
      accessLevel,
      ...(userId !== undefined && { userId }),
    };

    if (existing >= 0) {
      access[teamId]![existing] = newAccess;
    } else {
      access[teamId]!.push(newAccess);
    }

    await this.writeAccess(access);

    return newAccess;
  }

  async getProjectTeamAccess(projectId: string, teamId: string): Promise<ProjectTeamAccess | null> {
    const access = await this.readAccess();
    const teamAccess = access[teamId] || [];
    return teamAccess.find((a) => a.projectId === projectId) || null;
  }

  async getProjectsForTeam(teamId: string): Promise<ProjectTeamAccess[]> {
    const access = await this.readAccess();
    return access[teamId] || [];
  }

  async getProjectsForUser(userId: string): Promise<ProjectTeamAccess[]> {
    const members = await this.readMembers();
    const userTeams = Object.keys(members).filter((teamId) =>
      members[teamId]!.some((m) => m.userId === userId)
    );

    const access = await this.readAccess();
    const userProjects: ProjectTeamAccess[] = [];

    for (const teamId of userTeams) {
      const teamAccess = access[teamId] || [];
      for (const projectAccess of teamAccess) {
        // Include if no specific user assigned, or assigned to this user
        if (!projectAccess.userId || projectAccess.userId === userId) {
          userProjects.push(projectAccess);
        }
      }
    }

    return userProjects;
  }

  async removeProjectTeamAccess(projectId: string, teamId: string): Promise<boolean> {
    const access = await this.readAccess();
    const teamAccess = access[teamId];
    if (!teamAccess) {
      return false;
    }

    const index = teamAccess.findIndex((a) => a.projectId === projectId);
    if (index === -1) {
      return false;
    }

    teamAccess.splice(index, 1);
    await this.writeAccess(access);

    return true;
  }
}

