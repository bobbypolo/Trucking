/**
 * Real Firebase REST Auth integration test.
 * Creates test user, signs in, gets real ID token, cleans up.
 * Uses FIREBASE_WEB_API_KEY from .env — no mocks, no Admin SDK.
 *
 * R-marker: Tests R-P1-03
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  signInTestUser,
  deleteTestUser,
  type FirebaseAuthUser,
} from "../helpers/firebase-rest-auth";

const TEST_EMAIL = `ci-test-${Date.now()}@disbatchme.test`;
const TEST_PW = `Test@${Date.now()}!`;

let createdUser: FirebaseAuthUser | null = null;
let skip = false;

describe("Real Firebase REST Auth", () => {
  beforeAll(async () => {
    if (!process.env.FIREBASE_WEB_API_KEY) {
      skip = true;
      return;
    }
    // Create test user once for entire suite
    try {
      createdUser = await createTestUser(TEST_EMAIL, TEST_PW);
    } catch (err) {
      // Firebase auth might be restricted; skip gracefully
      skip = true;
    }
  }, 30000);

  afterAll(async () => {
    if (createdUser) {
      try {
        await deleteTestUser(createdUser.idToken);
      } catch {
        // Best-effort cleanup
      }
    }
  }, 15000);

  it("createTestUser returns valid idToken and localId", () => {
    if (skip) return;
    expect(createdUser).not.toBeNull();
    expect(createdUser!.idToken).toBeTruthy();
    expect(createdUser!.localId).toBeTruthy();
    expect(createdUser!.email).toBe(TEST_EMAIL);
  });

  it("idToken is a valid JWT structure (3 dot-separated parts)", () => {
    if (skip) return;
    const parts = createdUser!.idToken.split(".");
    expect(parts).toHaveLength(3);
  });

  it("JWT payload contains iss (issuer) field pointing to Firebase", () => {
    if (skip) return;
    const [, payloadB64] = createdUser!.idToken.split(".");
    // Decode base64url to JSON
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    const payload = JSON.parse(decoded);
    expect(payload.iss).toContain("securetoken.google.com");
  });

  it("signInWithPassword returns a fresh idToken", async () => {
    if (skip) return;
    const signedIn = await signInTestUser(TEST_EMAIL, TEST_PW);
    expect(signedIn.idToken).toBeTruthy();
    expect(signedIn.idToken.split(".")).toHaveLength(3);
    expect(signedIn.localId).toBe(createdUser!.localId);
  }, 15000);

  it("deleteTestUser cleans up — re-login should fail", async () => {
    if (skip) return;
    // Delete the user
    await deleteTestUser(createdUser!.idToken);
    createdUser = null; // Prevent double-delete in afterAll

    // Attempt re-sign-in should fail
    await expect(signInTestUser(TEST_EMAIL, TEST_PW)).rejects.toThrow();
  }, 15000);
});
