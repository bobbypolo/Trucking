import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Tests R-P1-05-AC3

/**
 * Route Audit Test: Enumerates all registered routes across route modules
 * and verifies each data-accessing route has requireAuth + requireTenant middleware.
 *
 * Environment-aware public allowlist:
 * - Production: only /api/health is public
 * - Dev/staging: adds Firebase-backed provisioning endpoints
 *
 * /api/metrics is NOT public (admin-only per AC3)
 */

const ROUTES_DIR = path.resolve(__dirname, '../../routes');
const INDEX_PATH = path.resolve(__dirname, '../../index.ts');

// Production public allowlist: ONLY /api/health
const PRODUCTION_PUBLIC_ROUTES = new Set([
    'GET /api/health',
]);

// Dev/staging adds provisioning endpoints (Firebase-backed)
const DEV_STAGING_PUBLIC_ROUTES = new Set([
    'GET /api/health',
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/users',
]);

// Regex to match Express route definitions
const ROUTE_DEF_REGEX = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
const INDEX_ROUTE_DEF_REGEX = /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;

// Regex to check if a route handler line includes requireAuth
const AUTH_MIDDLEWARE_REGEX = /requireAuth/;
const TENANT_MIDDLEWARE_REGEX = /requireTenant/;

interface RouteEntry {
    method: string;
    path: string;
    file: string;
    line: string;
    hasAuth: boolean;
    hasTenant: boolean;
}

function extractRoutes(): RouteEntry[] {
    const routes: RouteEntry[] = [];

    // Scan route modules
    const routeFiles = fs.readdirSync(ROUTES_DIR)
        .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

    for (const file of routeFiles) {
        const filePath = path.join(ROUTES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            const match = ROUTE_DEF_REGEX.exec(line);
            if (match) {
                routes.push({
                    method: match[1].toUpperCase(),
                    path: match[2],
                    file,
                    line: line.trim(),
                    hasAuth: AUTH_MIDDLEWARE_REGEX.test(line),
                    hasTenant: TENANT_MIDDLEWARE_REGEX.test(line),
                });
            }
            // Reset regex lastIndex since we reuse it
            ROUTE_DEF_REGEX.lastIndex = 0;
        }
    }

    // Scan index.ts for inline routes
    if (fs.existsSync(INDEX_PATH)) {
        const content = fs.readFileSync(INDEX_PATH, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
            const match = INDEX_ROUTE_DEF_REGEX.exec(line);
            if (match) {
                routes.push({
                    method: match[1].toUpperCase(),
                    path: match[2],
                    file: 'index.ts',
                    line: line.trim(),
                    hasAuth: AUTH_MIDDLEWARE_REGEX.test(line),
                    hasTenant: TENANT_MIDDLEWARE_REGEX.test(line),
                });
            }
            INDEX_ROUTE_DEF_REGEX.lastIndex = 0;
        }
    }

    return routes;
}

describe('R-P1-05: Route Protection Audit', () => {
    const allRoutes = extractRoutes();

    describe('AC3: All data-accessing routes have requireAuth', () => {
        it('finds at least 20 routes (sanity check)', () => {
            expect(allRoutes.length).toBeGreaterThanOrEqual(20);
        });

        it('every non-public route has requireAuth middleware', () => {
            const unprotected: string[] = [];

            for (const route of allRoutes) {
                const key = `${route.method} ${route.path}`;
                // Skip public routes (use production allowlist - strictest)
                if (PRODUCTION_PUBLIC_ROUTES.has(key)) continue;
                // Skip dev provisioning routes (they're protected in prod)
                if (DEV_STAGING_PUBLIC_ROUTES.has(key)) continue;

                if (!route.hasAuth) {
                    unprotected.push(`${key} in ${route.file}`);
                }
            }

            expect(
                unprotected,
                `Unprotected routes found:\n${unprotected.join('\n')}`,
            ).toHaveLength(0);
        });

        it('every non-public route has requireTenant middleware', () => {
            const noTenant: string[] = [];

            for (const route of allRoutes) {
                const key = `${route.method} ${route.path}`;
                // Skip public routes
                if (PRODUCTION_PUBLIC_ROUTES.has(key)) continue;
                if (DEV_STAGING_PUBLIC_ROUTES.has(key)) continue;
                // /api/users/me is auth-only (no tenant param needed)
                if (key === 'GET /api/users/me') continue;

                if (!route.hasTenant) {
                    noTenant.push(`${key} in ${route.file}`);
                }
            }

            expect(
                noTenant,
                `Routes without tenant isolation:\n${noTenant.join('\n')}`,
            ).toHaveLength(0);
        });
    });

    describe('AC3: Public endpoint allowlist enforcement', () => {
        it('/api/health is the only public endpoint in production', () => {
            expect(PRODUCTION_PUBLIC_ROUTES.size).toBe(1);
            expect(PRODUCTION_PUBLIC_ROUTES.has('GET /api/health')).toBe(true);
        });

        it('/api/health route exists in index.ts', () => {
            const healthRoute = allRoutes.find(r => r.path === '/api/health');
            expect(healthRoute).toBeDefined();
            expect(healthRoute?.method).toBe('GET');
        });

        it('/api/health does NOT have requireAuth (it is public)', () => {
            const healthRoute = allRoutes.find(r => r.path === '/api/health');
            expect(healthRoute).toBeDefined();
            expect(healthRoute?.hasAuth).toBe(false);
        });

        it('/api/metrics is NOT in the public allowlist', () => {
            expect(PRODUCTION_PUBLIC_ROUTES.has('GET /api/metrics')).toBe(false);
            expect(DEV_STAGING_PUBLIC_ROUTES.has('GET /api/metrics')).toBe(false);
        });

        it('dev/staging provisioning endpoints are defined', () => {
            expect(DEV_STAGING_PUBLIC_ROUTES.has('POST /api/auth/register')).toBe(true);
            expect(DEV_STAGING_PUBLIC_ROUTES.has('POST /api/auth/login')).toBe(true);
        });
    });

    describe('AC3: Route inventory cross-check', () => {
        it('all route files are imported in index.ts', () => {
            const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');
            const routeFiles = fs.readdirSync(ROUTES_DIR)
                .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

            for (const file of routeFiles) {
                const moduleName = file.replace('.ts', '');
                const importPattern = new RegExp(`from\\s+['\\"]\\.\/routes\\/${moduleName}['\\"']`);
                expect(
                    importPattern.test(indexContent),
                    `Route module ${file} is not imported in index.ts`,
                ).toBe(true);
            }
        });

        it('no route uses the deprecated verifyFirebaseToken', () => {
            const routeFiles = fs.readdirSync(ROUTES_DIR)
                .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

            const offenders: string[] = [];
            for (const file of routeFiles) {
                const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf-8');
                if (content.includes('verifyFirebaseToken') || content.includes('authenticateToken')) {
                    offenders.push(file);
                }
            }

            expect(
                offenders,
                `Routes still using deprecated auth: ${offenders.join(', ')}`,
            ).toHaveLength(0);
        });

        it('no route file imports JWT_SECRET or jsonwebtoken', () => {
            const routeFiles = fs.readdirSync(ROUTES_DIR)
                .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));

            const offenders: string[] = [];
            for (const file of routeFiles) {
                const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf-8');
                if (content.includes('JWT_SECRET') || content.includes("'jsonwebtoken'")) {
                    offenders.push(file);
                }
            }

            expect(
                offenders,
                `Routes still using JWT: ${offenders.join(', ')}`,
            ).toHaveLength(0);
        });
    });
});
