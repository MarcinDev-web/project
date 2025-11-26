const DEFAULT_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
];
const ORIGIN_SEPARATOR = /[\s,]+/u;
export const CORS_ALLOWED_HEADERS = [
    'Content-Type',
    'Authorization',
    'X-XSRF-TOKEN',
    'X-Requested-With',
];
export const CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
let cachedConfig = null;
let cachedKey = null;
function buildCacheKey() {
    return [
        process.env.NODE_ENV ?? '',
        process.env.FRONTEND_URL ?? '',
        process.env.PRIMARY_FRONTEND_URL ?? '',
        process.env.CORS_ALLOWED_ORIGINS ?? '',
        process.env.ALLOWED_ORIGINS ?? '',
    ].join('||');
}
function isProductionEnv() {
    return process.env.NODE_ENV === 'production';
}
export function normalizeOrigin(origin) {
    const trimmed = origin.trim();
    if (!trimmed) {
        return null;
    }
    // Auto-add https:// if protocol is missing
    let urlToParse = trimmed;
    if (!trimmed.match(/^https?:\/\//i)) {
        urlToParse = `https://${trimmed}`;
    }
    try {
        const parsed = new URL(urlToParse);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return `${parsed.protocol}//${parsed.host}`;
    }
    catch {
        return null;
    }
}
function sanitizeOriginEntry(entry) {
    const normalized = normalizeOrigin(entry);
    if (normalized) {
        return normalized;
    }
    // Allow wildcard domains like https://*.vercel.app
    const wildcardMatch = entry.trim().match(/^(https?):\/\/([^/]+)$/);
    if (!wildcardMatch || wildcardMatch.length < 3) {
        return null;
    }
    const [, protocol, hostPattern] = wildcardMatch;
    if (!hostPattern || !hostPattern.includes('*')) {
        return normalizeOrigin(entry);
    }
    return `${protocol}://${hostPattern}`;
}
function createPattern(originPattern) {
    const sanitized = sanitizeOriginEntry(originPattern);
    if (!sanitized) {
        return null;
    }
    if (!sanitized.includes('*')) {
        const exact = normalizeOrigin(sanitized);
        if (!exact) {
            return null;
        }
        return {
            raw: exact,
            regex: new RegExp(`^${exact.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')}$`, 'iu'),
            cspSource: exact,
        };
    }
    const parts = sanitized.split('://');
    if (parts.length < 2) {
        return null;
    }
    const [protocol, hostPattern] = parts;
    if (!hostPattern) {
        return null;
    }
    const escaped = hostPattern
        .split('*')
        .map((segment) => segment.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&'))
        .join('.*');
    const regex = new RegExp(`^${protocol}://${escaped}$`, 'iu');
    return {
        raw: sanitized,
        regex,
        cspSource: sanitized,
    };
}
function splitOrigins(value) {
    if (!value) {
        return [];
    }
    return value
        .split(ORIGIN_SEPARATOR)
        .map((origin) => origin.trim())
        .filter(Boolean);
}
function collectOrigins(values) {
    const exactSet = new Set();
    const patterns = [];
    for (const entry of values) {
        const sanitized = sanitizeOriginEntry(entry);
        if (!sanitized) {
            continue;
        }
        if (sanitized.includes('*')) {
            const pattern = createPattern(sanitized);
            if (pattern) {
                const duplicate = patterns.find((p) => p.cspSource === pattern.cspSource);
                if (!duplicate) {
                    patterns.push(pattern);
                }
            }
            continue;
        }
        const normalized = normalizeOrigin(sanitized);
        if (normalized) {
            exactSet.add(normalized);
        }
    }
    return { exact: [...exactSet], wildcard: patterns };
}
function getDefaultDevOrigins() {
    return DEFAULT_DEV_ORIGINS.map((origin) => normalizeOrigin(origin)).filter((origin) => !!origin);
}
export function buildCorsConfig() {
    const frontendValues = splitOrigins(process.env.FRONTEND_URL);
    const additionalValues = [
        ...splitOrigins(process.env.CORS_ALLOWED_ORIGINS),
        ...splitOrigins(process.env.ALLOWED_ORIGINS),
    ];
    const primaryCollection = collectOrigins(frontendValues);
    const additionalCollection = collectOrigins(additionalValues);
    let exactOrigins = [...primaryCollection.exact, ...additionalCollection.exact];
    const wildcardOrigins = [...primaryCollection.wildcard, ...additionalCollection.wildcard];
    // Remove duplicates while preserving order
    exactOrigins = exactOrigins.filter((origin, index) => exactOrigins.indexOf(origin) === index);
    if (exactOrigins.length === 0 && wildcardOrigins.length === 0) {
        const defaults = getDefaultDevOrigins();
        if (defaults.length === 0) {
            throw new Error('Failed to derive default development origins');
        }
        if (isProductionEnv()) {
            throw new Error('No CORS origins configured. Set FRONTEND_URL to your frontend URL.');
        }
        exactOrigins = defaults;
    }
    else if (!isProductionEnv() && exactOrigins.length === 0) {
        // Ensure dev tools work even if only wildcard origins provided
        exactOrigins = [...getDefaultDevOrigins(), ...exactOrigins];
        exactOrigins = exactOrigins.filter((origin, index) => exactOrigins.indexOf(origin) === index);
    }
    let primaryOrigin = primaryCollection.exact[0] ?? exactOrigins[0];
    const primaryOverride = process.env.PRIMARY_FRONTEND_URL
        ? normalizeOrigin(process.env.PRIMARY_FRONTEND_URL)
        : null;
    if (primaryOverride) {
        primaryOrigin = primaryOverride;
        if (!exactOrigins.includes(primaryOrigin)) {
            exactOrigins = [primaryOrigin, ...exactOrigins];
        }
    }
    if (!primaryOrigin) {
        const defaults = getDefaultDevOrigins();
        primaryOrigin = defaults[0];
    }
    if (!primaryOrigin) {
        throw new Error('Unable to determine primary frontend origin for share URLs.');
    }
    return {
        exactOrigins,
        wildcardOrigins,
        primaryOrigin,
    };
}
export function getCorsConfig(options = {}) {
    const { forceRecompute = false } = options;
    const currentKey = buildCacheKey();
    if (!forceRecompute && cachedConfig && cachedKey === currentKey) {
        return cachedConfig;
    }
    const config = buildCorsConfig();
    cachedConfig = config;
    cachedKey = currentKey;
    return config;
}
export function resetCorsConfigCache() {
    cachedConfig = null;
    cachedKey = null;
}
export function isOriginAllowed(origin, config = getCorsConfig()) {
    const normalized = normalizeOrigin(origin);
    if (normalized && config.exactOrigins.includes(normalized)) {
        return true;
    }
    for (const pattern of config.wildcardOrigins) {
        if (pattern.regex.test(origin) || (normalized && pattern.regex.test(normalized))) {
            return true;
        }
    }
    return false;
}
export function describeAllowedOrigins(config = getCorsConfig()) {
    const parts = [...config.exactOrigins];
    if (config.wildcardOrigins.length > 0) {
        parts.push(...config.wildcardOrigins.map((pattern) => pattern.raw));
    }
    return parts.join(', ');
}
//# sourceMappingURL=cors.js.map