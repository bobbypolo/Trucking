/**
 * Tests for authService session hydration failure behavior.
 *
 * Tests R-P2-11: Session hydration failure sets user to null
 * Tests R-P2-12: Session hydration failure emits 'auth:session-failed' CustomEvent
 *
 * This file uses DEMO_MODE=false so onAuthStateChanged is registered.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted runs before vi.mock hoisting, so the variable is available
const { authStateCallback } = vi.hoisted(() => {
  const holder = { cb: null as ((user: any) => void) | null };
  return {
    authStateCallback: holder,
  };
});

vi.mock("../../../services/firebase", () => ({
  auth: {
    currentUser: null,
  },
  DEMO_MODE: false,
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn((_auth: any, cb: any) => {
    authStateCallback.cb = cb;
    return vi.fn(); // unsubscribe
  }),
  getIdToken: vi.fn().mockResolvedValue("mock-token"),
}));

vi.mock("../../../services/storageService", () => ({
  seedDemoLoads: vi.fn(),
}));

// Mock the api module
vi.mock("../../../services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  ForbiddenError: class ForbiddenError extends Error {},
}));

import { onUserChange } from "../../../services/authService";

describe("authService session hydration (DEMO_MODE=false)", () => {
  let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dispatchEventSpy = vi.spyOn(window, "dispatchEvent");
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Tests R-P2-11
  it("session hydration failure sets user to null (no silent cache lookup)", async () => {
    expect(authStateCallback.cb).toBeDefined();

    // Mock API hydration failure
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("server unreachable"),
    );

    // Track user change notifications
    const userChanges: (any | null)[] = [];
    onUserChange((user) => userChanges.push(user));

    // Simulate Firebase auth state change with a valid Firebase user
    await authStateCallback.cb!({
      email: "test@loadpilot.com",
      uid: "fb-uid-123",
    });

    // Allow microtasks to settle
    await new Promise((r) => setTimeout(r, 50));

    // User should be null — no cache fallback
    expect(userChanges[userChanges.length - 1]).toBeNull();
  });

  // Tests R-P2-12
  it("session hydration failure emits 'auth:session-failed' CustomEvent", async () => {
    expect(authStateCallback.cb).toBeDefined();

    // Mock API hydration failure
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("server unreachable"),
    );

    // Simulate Firebase auth state change
    await authStateCallback.cb!({
      email: "test@loadpilot.com",
      uid: "fb-uid-123",
    });

    // Allow microtasks to settle
    await new Promise((r) => setTimeout(r, 50));

    // Check that auth:session-failed CustomEvent was dispatched
    const sessionFailedEvents = dispatchEventSpy.mock.calls.filter(
      ([event]) =>
        event instanceof CustomEvent && event.type === "auth:session-failed",
    );
    expect(sessionFailedEvents.length).toBe(1);
    const eventDetail = (sessionFailedEvents[0][0] as CustomEvent).detail;
    expect(eventDetail.email).toBe("test@loadpilot.com");
    expect(eventDetail.error).toBeInstanceOf(Error);
  });
});
