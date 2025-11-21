export type AssetType = 'texture' | 'model' | 'animation' | 'audio' | 'json' | 'binary' | 'unknown';
export interface Asset {
    id: string;
    type: AssetType;
}
export interface LoadOptions {
    cache?: boolean;
    cacheId?: string;
    [key: string]: unknown;
}
//# sourceMappingURL=types.d.ts.map