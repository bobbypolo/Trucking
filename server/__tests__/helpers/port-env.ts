/**
 * Cross-platform PORT environment variable helper for integration tests.
 *
 * Uses JavaScript process.env assignment instead of shell PORT=5000 syntax,
 * which is not compatible with Windows cmd/PowerShell.
 *
 * Usage: import this file at the top of integration test files that need
 * a predictable PORT value.
 */

process.env.PORT = "5001";
