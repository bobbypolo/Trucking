/**
 * Environment variable validation — fail fast on boot.
 *
 * Required env vars:
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   FIREBASE_PROJECT_ID  OR  GOOGLE_APPLICATION_CREDENTIALS
 *
 * JWT_SECRET is NOT required (Firebase-only auth per R-P1-05).
 * No hardcoded fallback values — empty strings are treated as missing.
 */

const REQUIRED_DB_VARS = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
] as const;

/**
 * Validates that all required environment variables are set.
 * Throws an Error with a descriptive message listing ALL missing vars.
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const varName of REQUIRED_DB_VARS) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  }

  // Firebase: need at least one of FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS
  const hasProjectId =
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PROJECT_ID.trim() !== '';
  const hasCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    process.env.GOOGLE_APPLICATION_CREDENTIALS.trim() !== '';

  if (!hasProjectId && !hasCredentials) {
    missing.push('FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Server cannot start without these. ' +
        'Set them in your .env file or environment.',
    );
  }
}
