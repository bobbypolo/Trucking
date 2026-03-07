/**
 * Route protection configuration and public route allowlist.
 *
 * Defines which routes are public (no auth required) and which
 * require authentication + tenant isolation.
 */

/**
 * Public routes that do NOT require authentication.
 *
 * PRODUCTION: Only /api/health is public.
 * DEV/STAGING: Adds provisioning endpoints for Firebase-backed setup.
 */
export const PUBLIC_ROUTES_PRODUCTION: ReadonlySet<string> = new Set([
    'GET /api/health',
]);

/**
 * Dev/staging provisioning endpoints.
 * These are Firebase-backed and used for initial setup.
 */
export const PUBLIC_ROUTES_DEV_STAGING: ReadonlySet<string> = new Set([
    'GET /api/health',
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/companies',
    'POST /api/users',
]);

/**
 * Returns the public route allowlist for the current environment.
 */
export function getPublicRoutes(): ReadonlySet<string> {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') {
        return PUBLIC_ROUTES_PRODUCTION;
    }
    return PUBLIC_ROUTES_DEV_STAGING;
}

/**
 * Check if a route+method combination is public.
 */
export function isPublicRoute(method: string, path: string): boolean {
    const key = `${method.toUpperCase()} ${path}`;
    return getPublicRoutes().has(key);
}
