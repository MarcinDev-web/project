/**
 * Shared authentication types used by platform and net-server
 */
export type UserRole = 'user' | 'moderator' | 'admin' | 'root';
export interface PublicUser {
    id: string;
    email: string;
    username?: string;
    createdAt: number;
    role?: UserRole;
}
export interface Session {
    token: string;
    refreshToken: string;
    expiresAt: number;
    userId: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    username: string;
    password: string;
}
//# sourceMappingURL=auth.d.ts.map