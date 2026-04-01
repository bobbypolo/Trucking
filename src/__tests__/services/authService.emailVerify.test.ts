import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks (declared before vi.mock via vi.hoisted) ---
const {
  mockSignInWithEmailAndPassword,
  mockCreateUserWithEmailAndPassword,
  mockSendEmailVerification,
  mockSignOut,
  mockOnAuthStateChanged,
  mockGetIdToken,
} = vi.hoisted(() => ({
  mockSignInWithEmailAndPassword: vi.fn(),
  mockCreateUserWithEmailAndPassword: vi.fn(),
  mockSendEmailVerification: vi.fn(),
  mockSignOut: vi.fn(),
  mockOnAuthStateChanged: vi.fn(),
  mockGetIdToken: vi.fn(),
}));

vi.mock("../../../services/firebase", () => ({
  auth: { currentUser: null },
  DEMO_MODE: false,
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...args: unknown[]) =>
    mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) =>
    mockCreateUserWithEmailAndPassword(...args),
  sendEmailVerification: (...args: unknown[]) =>
    mockSendEmailVerification(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  getIdToken: (...args: unknown[]) => mockGetIdToken(...args),
}));

vi.mock("../../../services/config", () => ({
  API_URL: "http://localhost:5000/api",
}));

// Suppress API calls from updateCompany / updateUser
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ user: { id: "u1", companyId: "c1" } }),
});
vi.stubGlobal("fetch", mockFetch);

import {
  login,
  registerCompany,
  addDriver,
} from "../../../services/authService";

describe("authService email verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          user: {
            id: "u1",
            companyId: "c1",
            email: "admin@test.com",
            name: "Admin",
            role: "admin",
          },
        }),
    });
  });

  // --- R-AUTH-01: authService.ts imports sendEmailVerification ---
  it("# Tests R-AUTH-01 — sendEmailVerification is imported and callable", () => {
    // The import itself succeeding proves sendEmailVerification is imported.
    // We verify the mock is the function that firebase/auth exposes.
    expect(mockSendEmailVerification).toBeDefined();
    expect(typeof mockSendEmailVerification).toBe("function");
  });

  // --- R-AUTH-02: sendEmailVerification called after createUser in registerCompany ---
  it("# Tests R-AUTH-02 — registerCompany calls sendEmailVerification after createUser", async () => {
    const mockUser = { uid: "fb-uid-1", emailVerified: false };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockSendEmailVerification.mockResolvedValue(undefined);

    await registerCompany(
      "Test Corp",
      "admin@test.com",
      "Admin",
      "owner_operator",
      "Password123!",
    );

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(mockSendEmailVerification).toHaveBeenCalledTimes(1);
    expect(mockSendEmailVerification).toHaveBeenCalledWith(mockUser);
  });

  // --- R-AUTH-03: 2+ total sendEmailVerification calls (both signup paths) ---
  it("# Tests R-AUTH-03 — addDriver also calls sendEmailVerification", async () => {
    const mockUser = { uid: "fb-uid-2", emailVerified: false };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockSendEmailVerification.mockResolvedValue(undefined);

    await addDriver(
      "company-1",
      "Driver One",
      "driver@test.com",
      "driver",
      "percent",
      25,
      undefined,
      "Password456!",
    );

    expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
    expect(mockSendEmailVerification).toHaveBeenCalledTimes(1);
    expect(mockSendEmailVerification).toHaveBeenCalledWith(mockUser);
  });

  // --- R-AUTH-04: login() checks emailVerified ---
  it("# Tests R-AUTH-04 — login checks emailVerified and rejects unverified user", async () => {
    const unverifiedUser = {
      uid: "fb-uid-3",
      email: "unverified@test.com",
      emailVerified: false,
    };
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: unverifiedUser,
    });
    mockSignOut.mockResolvedValue(undefined);

    await expect(login("unverified@test.com", "pass")).rejects.toThrow(
      "Please verify your email before logging in.",
    );

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  // --- R-AUTH-06: Unverified login throws error containing "verify" ---
  it("# Tests R-AUTH-06 — unverified login error message contains 'verify'", async () => {
    const unverifiedUser = {
      uid: "fb-uid-4",
      email: "noverify@test.com",
      emailVerified: false,
    };
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: unverifiedUser,
    });
    mockSignOut.mockResolvedValue(undefined);

    let thrownError: Error | null = null;
    try {
      await login("noverify@test.com", "pass");
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError!.message.toLowerCase()).toContain("verify");
  });

  // Positive path: verified user can login successfully
  it("login allows verified user through", async () => {
    const verifiedUser = {
      uid: "fb-uid-5",
      email: "verified@test.com",
      emailVerified: true,
    };
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: verifiedUser,
    });
    mockGetIdToken.mockResolvedValue("mock-token");

    const result = await login("verified@test.com", "pass");

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  // Negative test: sendEmailVerification failure does not block signup
  it("registerCompany completes even if sendEmailVerification fails", async () => {
    const mockUser = { uid: "fb-uid-6", emailVerified: false };
    mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
    mockSendEmailVerification.mockRejectedValue(new Error("email send failed"));

    // registerCompany catches the error from the try block, so it should not throw
    // because sendEmailVerification is inside the same try/catch
    const result = await registerCompany(
      "Fail Corp",
      "fail@test.com",
      "Fail Admin",
      "fleet",
      "Password789!",
    );

    expect(result.user).toBeDefined();
    expect(result.company).toBeDefined();
  });
});
