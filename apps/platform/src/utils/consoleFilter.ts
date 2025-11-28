/**
 * Console Filter - Reduces console noise by filtering out expected/benign messages
 * 
 * This utility intercepts console.error and console.warn calls to filter out:
 * - Expected 404 errors for optional resources (e.g., avatar-loadout for new users)
 * - WebGPU timestamp warnings (expected fallback behavior)
 * - Other known benign messages
 */

type ConsoleMethod = 'error' | 'warn' | 'log' | 'info';

interface ConsoleFilterOptions {
  enabled: boolean;
  filters: Array<{
    method: ConsoleMethod[];
    pattern: RegExp | string;
    description?: string;
  }>;
  /** Deduplicate repeated messages within this time window (ms). 0 = disabled */
  dedupeWindowMs?: number;
}

/**
 * Track recent messages for deduplication (React StrictMode causes double logging)
 */
const recentMessages = new Map<string, number>();
const DEDUPE_WINDOW_MS = 100; // 100ms window for deduplication

function isDuplicateMessage(message: string): boolean {
  const now = Date.now();
  const lastTime = recentMessages.get(message);
  
  // Clean up old entries
  for (const [msg, time] of recentMessages.entries()) {
    if (now - time > DEDUPE_WINDOW_MS) {
      recentMessages.delete(msg);
    }
  }
  
  if (lastTime && now - lastTime < DEDUPE_WINDOW_MS) {
    return true;
  }
  
  recentMessages.set(message, now);
  return false;
}

/**
 * Default filters for expected/benign console messages
 */
const DEFAULT_FILTERS: ConsoleFilterOptions['filters'] = [
  // Filter 404 errors for avatar-loadout (expected for new users)
  {
    method: ['error'],
    pattern: /GET.*\/api\/users\/[^/]+\/avatar-loadout.*404/i,
    description: 'Expected 404 for avatar-loadout (new users without saved loadouts)',
  },
  // Filter WebGPU timestamp warnings (expected fallback behavior)
  {
    method: ['warn'],
    pattern: /timestamp period: no source available/i,
    description: 'WebGPU timestamp fallback (expected behavior)',
  },
  // Filter duplicate 404s (same request multiple times)
  {
    method: ['error'],
    pattern: /GET.*404.*Not Found/i,
    description: 'Network 404 errors',
  },
  // Filter React Router future flag warnings (already opted in)
  {
    method: ['warn'],
    pattern: /React Router Future Flag Warning/i,
    description: 'React Router v7 migration warnings (already handled)',
  },
  // Filter WebGPU powerPreference warnings (Chrome bug on Windows)
  {
    method: ['warn'],
    pattern: /powerPreference option is currently ignored/i,
    description: 'WebGPU Chrome bug on Windows (crbug.com/369219127)',
  },
];

/**
 * Check if a message matches any filter
 */
function shouldFilter(message: string, method: ConsoleMethod, filters: ConsoleFilterOptions['filters']): boolean {
  return filters.some((filter) => {
    if (!filter.method.includes(method)) {
      return false;
    }

    const pattern = typeof filter.pattern === 'string' ? new RegExp(filter.pattern, 'i') : filter.pattern;
    return pattern.test(message);
  });
}

/**
 * Create filtered console methods
 */
function createFilteredConsole(
  originalConsole: Console,
  options: ConsoleFilterOptions,
): Partial<Console> {
  const filtered: Partial<Console> = {};

  // Methods to intercept
  const methodsToFilter: ConsoleMethod[] = ['error', 'warn'];

  for (const method of methodsToFilter) {
    const original = originalConsole[method].bind(originalConsole);

    filtered[method] = (...args: unknown[]) => {
      if (!options.enabled) {
        original(...args);
        return;
      }

      // Convert all arguments to string for pattern matching
      const message = args
        .map((arg) => {
          if (arg instanceof Error) {
            return arg.message;
          }
          if (typeof arg === 'string') {
            return arg;
          }
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      // Check if this message should be filtered
      if (shouldFilter(message, method, options.filters)) {
        // Filtered - don't log
        return;
      }

      // Check for duplicate messages (React StrictMode double-logging)
      if (isDuplicateMessage(message)) {
        // Skip duplicate log
        return;
      }

      // Not filtered - log normally
      original(...args);
    };
  }

  // Forward other console methods unchanged
  const forwardMethods: ConsoleMethod[] = ['log', 'info', 'debug', 'table', 'group', 'groupEnd'];
  for (const method of forwardMethods) {
    filtered[method] = originalConsole[method].bind(originalConsole);
  }

  return filtered;
}

/**
 * Initialize console filtering
 * 
 * @param enabled - Whether filtering is enabled (default: true in development)
 * @param customFilters - Additional custom filters to add
 */
export function initConsoleFilter(
  enabled: boolean = import.meta.env.DEV,
  customFilters: ConsoleFilterOptions['filters'] = [],
): void {
  if (typeof window === 'undefined') {
    // Server-side - no console to filter
    return;
  }

  const options: ConsoleFilterOptions = {
    enabled,
    filters: [...DEFAULT_FILTERS, ...customFilters],
  };

  // Store original console methods
  const originalConsole = { ...window.console };

  // Create filtered console
  const filteredConsole = createFilteredConsole(window.console, options);

  // Replace console methods with filtered versions
  Object.assign(window.console, filteredConsole);

  // Expose original console methods as console.original for debugging
  (window.console as unknown as { original: Console }).original = originalConsole as Console;

  if (enabled) {
    console.log(
      `[Console Filter] Enabled with ${options.filters.length} filter(s). Use console.original to bypass.`,
    );
  }
}

/**
 * Disable console filtering (restore original console)
 */
export function disableConsoleFilter(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const original = (window.console as unknown as { original?: Console }).original;
  if (original) {
    Object.assign(window.console, original);
    delete (window.console as unknown as { original?: Console }).original;
    console.log('[Console Filter] Disabled');
  }
}

/**
 * Add a custom filter at runtime
 */
export function addConsoleFilter(
  method: ConsoleMethod[],
  pattern: RegExp | string,
  description?: string,
): void {
  // This would require storing filters externally and re-initializing
  // For now, call initConsoleFilter with additional custom filters
  console.warn('[Console Filter] addConsoleFilter not yet implemented. Use initConsoleFilter with custom filters instead.');
}

