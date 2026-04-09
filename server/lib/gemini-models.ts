/**
 * Centralized Gemini model defaults for the live demo and local development.
 *
 * Default to AI Studio free-tier-compatible Flash models so a plain API key
 * can power the demo without requiring paid Pro access. Override with env vars
 * when a specific deployment needs a different model.
 */

export const GEMINI_FAST_MODEL =
  process.env.GEMINI_MODEL_FAST || "gemini-3-flash-preview";

export const GEMINI_COMPLEX_MODEL =
  process.env.GEMINI_MODEL_COMPLEX || GEMINI_FAST_MODEL;
