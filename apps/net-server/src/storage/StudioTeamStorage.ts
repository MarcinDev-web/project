/**
 * Studio Team Storage - manages teams, members, invitations and project access
 * Supports both PostgreSQL (preferred) and JSON file storage (fallback)
 */

// @ts-expect-error - Prisma client is generated at build time
import type { PrismaClient } from '../../node_modules/.prisma/net-client';
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
  constructor(private readonly prisma: PrismaClient) {}

  async initialize(): Promise<void> {
    // Schema is managed by ensureSchema() in db.ts
  }

  private generateToken(): string {
    const bytes = randomBytes(32);
    return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  async createTeam(studioOwnerId: string, data: CreateTeamRequest): Promise<StudioTeam> {
    // Check if team already exists for this studio
    const existing = await this.getTeamByStudioOwner(studioOwnerId);
    if (existing) {
      throw new Error('Team already exists for this studio');
    }

    const id = `team_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Use Prisma transaction
    const team = await this.prisma.$transaction(async (tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0]) => {
      // Create team
      const createdTeam = await tx.studioTeam.create({
        data: {
          id,
          studioOwnerId,
          name: data.name,
          description: data.description ?? null,
        },
      });

      // Add owner as member
      await tx.teamMember.create({
        data: {
          teamId: id,
          userId: studioOwnerId,
          role: 'owner',
          invitedBy: studioOwnerId,
        },
      });

      return createdTeam;
    });

    return {
      id: team.id,
      studioOwnerId: team.studioOwnerId,
      name: team.name,
      ...(team.description && { description: team.description }),
      createdAt: team.createdAt.getTime(),
      updatedAt: team.updatedAt.getTime(),
    };
  }

  async getTeam(teamId: string): Promise<StudioTeam | null> {
    const team = await this.prisma.studioTeam.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      return null;
    }

    return {
      id: team.id,
      studioOwnerId: team.studioOwnerId,
      name: team.name,
      ...(team.description && { description: team.description }),
      createdAt: team.createdAt.getTime(),
      updatedAt: team.updatedAt.getTime(),
    };
  }

  async getTeamByStudioOwner(studioOwnerId: string): Promise<StudioTeam | null> {
    const team = await this.prisma.studioTeam.findFirst({
      where: { studioOwnerId },
    });

    if (!team) {
      return null;
    }

    return {
      id: team.id,
      studioOwnerId: team.studioOwnerId,
      name: team.name,
      ...(team.description && { description: team.description }),
      createdAt: team.createdAt.getTime(),
      updatedAt: team.updatedAt.getTime(),
    };
  }

  async updateTeam(
    teamId: string,
    updates: { name?: string; description?: string }
  ): Promise<StudioTeam> {
    const updateData: {
      name?: string;
      description?: string | null;
    } = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description ?? null;
    }

    if (Object.keys(updateData).length === 0) {
      const team = await this.getTeam(teamId);
      if (!team) {
        throw new Error('Team not found');
      }
      return team;
    }

    const updated = await this.prisma.studioTeam.update({
      where: { id: teamId },
      data: updateData,
    });

    return {
      id: updated.id,
      studioOwnerId: updated.studioOwnerId,
      name: updated.name,
      ...(updated.description && { description: updated.description }),
      createdAt: updated.createdAt.getTime(),
      updatedAt: updated.updatedAt.getTime(),
    };
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    try {
      await this.prisma.studioTeam.delete({
        where: { id: teamId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getMembers(teamId: string): Promise<TeamMember[]> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((member: { teamId: string; userId: string; role: string; joinedAt: Date; invitedBy: string | null }) => ({
      teamId: member.teamId,
      userId: member.userId,
      role: member.role as 'owner' | 'member',
      joinedAt: member.joinedAt.getTime(),
      invitedBy: member.invitedBy ?? '',
    }));
  }

  async addMember(teamId: string, userId: string, invitedBy: string): Promise<TeamMember> {
    await this.prisma.teamMember.upsert({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      create: {
        teamId,
        userId,
        role: 'member',
        invitedBy,
      },
      update: {},
    });

    const members = await this.getMembers(teamId);
    const member = members.find((m) => m.userId === userId);
    if (!member) {
      throw new Error('Failed to add member');
    }
    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    // Don't allow removing owner
    const member = await this.getMember(teamId, userId);
    if (member?.role === 'owner') {
      throw new Error('Cannot remove team owner');
    }

    try {
      await this.prisma.teamMember.delete({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const member = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!member) {
      return null;
    }

    return {
      teamId: member.teamId,
      userId: member.userId,
      role: member.role as 'owner' | 'member',
      joinedAt: member.joinedAt.getTime(),
      invitedBy: member.invitedBy,
    };
  }

  async createInvitation(
    teamId: string,
    inviterId: string,
    request: InviteMemberRequest
  ): Promise<TeamInvitation> {
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const invitation = await this.prisma.teamInvitation.create({
      data: {
        id,
        teamId,
        inviterId,
        inviteeUserId: request.userId ?? null,
        inviteeEmail: request.email ?? null,
        inviteeUsername: request.username ?? null,
        token,
        status: 'pending',
        expiresAt,
      },
    });

    return {
      id: invitation.id,
      teamId: invitation.teamId,
      inviterId: invitation.inviterId,
      ...(invitation.inviteeUserId && { inviteeUserId: invitation.inviteeUserId }),
      ...(invitation.inviteeEmail && { inviteeEmail: invitation.inviteeEmail }),
      ...(invitation.inviteeUsername && { inviteeUsername: invitation.inviteeUsername }),
      token: invitation.token,
      status: invitation.status as TeamInvitation['status'],
      expiresAt: invitation.expiresAt.getTime(),
      createdAt: invitation.createdAt.getTime(),
    };
  }

  async getInvitation(invitationId: string): Promise<TeamInvitation | null> {
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return null;
    }

    return {
      id: invitation.id,
      teamId: invitation.teamId,
      inviterId: invitation.inviterId,
      ...(invitation.inviteeUserId && { inviteeUserId: invitation.inviteeUserId }),
      ...(invitation.inviteeEmail && { inviteeEmail: invitation.inviteeEmail }),
      ...(invitation.inviteeUsername && { inviteeUsername: invitation.inviteeUsername }),
      token: invitation.token,
      status: invitation.status as TeamInvitation['status'],
      expiresAt: invitation.expiresAt.getTime(),
      createdAt: invitation.createdAt.getTime(),
    };
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | null> {
    const invitation = await this.prisma.teamInvitation.findFirst({
      where: { token },
    });

    if (!invitation) {
      return null;
    }

    return {
      id: invitation.id,
      teamId: invitation.teamId,
      inviterId: invitation.inviterId,
      ...(invitation.inviteeUserId && { inviteeUserId: invitation.inviteeUserId }),
      ...(invitation.inviteeEmail && { inviteeEmail: invitation.inviteeEmail }),
      ...(invitation.inviteeUsername && { inviteeUsername: invitation.inviteeUsername }),
      token: invitation.token,
      status: invitation.status as TeamInvitation['status'],
      expiresAt: invitation.expiresAt.getTime(),
      createdAt: invitation.createdAt.getTime(),
    };
  }

  async getInvitations(teamId?: string, userId?: string): Promise<TeamInvitation[]> {
    const where: {
      teamId?: string;
      OR?: Array<{ inviteeUserId: string } | { inviterId: string }>;
    } = {};

    if (teamId) {
      where.teamId = teamId;
    }

    if (userId) {
      where.OR = [
        { inviteeUserId: userId },
        { inviterId: userId },
      ];
    }

    const invitations = await this.prisma.teamInvitation.findMany({
      ...(teamId || userId ? { where } : {}),
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((invitation: { id: string; teamId: string; inviterId: string; inviteeUserId: string | null; inviteeEmail: string | null; inviteeUsername: string | null; token: string; status: string; expiresAt: Date; createdAt: Date }) => ({
      id: invitation.id,
      teamId: invitation.teamId,
      inviterId: invitation.inviterId,
      ...(invitation.inviteeUserId && { inviteeUserId: invitation.inviteeUserId }),
      ...(invitation.inviteeEmail && { inviteeEmail: invitation.inviteeEmail }),
      ...(invitation.inviteeUsername && { inviteeUsername: invitation.inviteeUsername }),
      token: invitation.token,
      status: invitation.status as TeamInvitation['status'],
      expiresAt: invitation.expiresAt.getTime(),
      createdAt: invitation.createdAt.getTime(),
    }));
  }

  async updateInvitation(
    invitationId: string,
    status: 'accepted' | 'declined' | 'expired'
  ): Promise<TeamInvitation> {
    const invitation = await this.prisma.teamInvitation.update({
      where: { id: invitationId },
      data: { status },
    });

    return {
      id: invitation.id,
      teamId: invitation.teamId,
      inviterId: invitation.inviterId,
      ...(invitation.inviteeUserId && { inviteeUserId: invitation.inviteeUserId }),
      ...(invitation.inviteeEmail && { inviteeEmail: invitation.inviteeEmail }),
      ...(invitation.inviteeUsername && { inviteeUsername: invitation.inviteeUsername }),
      token: invitation.token,
      status: invitation.status as TeamInvitation['status'],
      expiresAt: invitation.expiresAt.getTime(),
      createdAt: invitation.createdAt.getTime(),
    };
  }

  async deleteInvitation(invitationId: string): Promise<boolean> {
    try {
      await this.prisma.teamInvitation.delete({
        where: { id: invitationId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async cleanupExpiredInvitations(): Promise<void> {
    await this.prisma.teamInvitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: new Date(),
        },
      },
      data: {
        status: 'expired',
      },
    });
  }

  async shareProjectWithTeam(
    projectId: string,
    teamId: string,
    accessLevel: 'read' | 'write',
    userId?: string
  ): Promise<ProjectTeamAccess> {
    const access = await this.prisma.projectTeamAccess.upsert({
      where: {
        projectId_teamId: {
          projectId,
          teamId,
        },
      },
      create: {
        projectId,
        teamId,
        accessLevel,
        userId: userId ?? null,
      },
      update: {
        accessLevel,
        userId: userId ?? null,
      },
    });

    return {
      projectId: access.projectId,
      teamId: access.teamId,
      accessLevel: access.accessLevel as 'read' | 'write',
      ...(access.userId && { userId: access.userId }),
    };
  }

  async getProjectTeamAccess(projectId: string, teamId: string): Promise<ProjectTeamAccess | null> {
    const access = await this.prisma.projectTeamAccess.findUnique({
      where: {
        projectId_teamId: {
          projectId,
          teamId,
        },
      },
    });

    if (!access) {
      return null;
    }

    return {
      projectId: access.projectId,
      teamId: access.teamId,
      accessLevel: access.accessLevel as 'read' | 'write',
      ...(access.userId && { userId: access.userId }),
    };
  }

  async getProjectsForTeam(teamId: string): Promise<ProjectTeamAccess[]> {
    const accesses = await this.prisma.projectTeamAccess.findMany({
      where: { teamId },
    });

    return accesses.map((access: { projectId: string; teamId: string; accessLevel: string; userId: string | null }) => ({
      projectId: access.projectId,
      teamId: access.teamId,
      accessLevel: access.accessLevel as 'read' | 'write',
      ...(access.userId && { userId: access.userId }),
    }));
  }

  async getProjectsForUser(userId: string): Promise<ProjectTeamAccess[]> {
    // Get all teams user is member of
    const members = await this.prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });

    if (members.length === 0) {
      return [];
    }

    const teamIds = members.map((m: { teamId: string }) => m.teamId);
    const accesses = await this.prisma.projectTeamAccess.findMany({
      where: {
        teamId: {
          in: teamIds,
        },
        OR: [
          { userId: null },
          { userId },
        ],
      },
    });

    return accesses.map((access: { projectId: string; teamId: string; accessLevel: string; userId: string | null }) => ({
      projectId: access.projectId,
      teamId: access.teamId,
      accessLevel: access.accessLevel as 'read' | 'write',
      ...(access.userId && { userId: access.userId }),
    }));
  }

  async removeProjectTeamAccess(projectId: string, teamId: string): Promise<boolean> {
    try {
      await this.prisma.projectTeamAccess.delete({
        where: {
          projectId_teamId: {
            projectId,
            teamId,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
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
    return bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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

  async updateTeam(
    teamId: string,
    updates: { name?: string; description?: string }
  ): Promise<StudioTeam> {
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
    if (members[teamId].some((m) => m.userId === userId)) {
      return members[teamId].find((m) => m.userId === userId)!;
    }

    const member: TeamMember = {
      teamId,
      userId,
      role: 'member',
      joinedAt: Date.now(),
      invitedBy,
    };

    members[teamId].push(member);
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
      filtered = filtered.filter((inv) => inv.inviteeUserId === userId || inv.inviterId === userId);
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

    const existing = access[teamId].findIndex((a) => a.projectId === projectId);
    const newAccess: ProjectTeamAccess = {
      projectId,
      teamId,
      accessLevel,
      ...(userId !== undefined && { userId }),
    };

    if (existing >= 0) {
      access[teamId][existing] = newAccess;
    } else {
      access[teamId].push(newAccess);
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
