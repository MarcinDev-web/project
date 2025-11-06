export interface CorsPattern {
    raw: string;
    regex: RegExp;
    cspSource: string;
}
export interface CorsConfig {
    exactOrigins: string[];
    wildcardOrigins: CorsPattern[];
    primaryOrigin: string;
}
export declare const CORS_ALLOWED_HEADERS: string[];
export declare const CORS_ALLOWED_METHODS: string[];
export declare function normalizeOrigin(origin: string): string | null;
export declare function buildCorsConfig(): CorsConfig;
export declare function getCorsConfig(options?: {
    forceRecompute?: boolean;
}): CorsConfig;
export declare function resetCorsConfigCache(): void;
export declare function isOriginAllowed(origin: string, config?: CorsConfig): boolean;
export declare function describeAllowedOrigins(config?: CorsConfig): string;
//# sourceMappingURL=cors.d.ts.map