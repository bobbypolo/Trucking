// Tests R-P3-01, R-P3-02
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let _currentUser: any = null;
let _listeners: ((user: any) => void)[] = [];

vi.mock("../../../services/authService", () => ({
  onUserChange: vi.fn((cb: (user: any) => void) => {
    _listeners.push(cb);
    return () => {
      _listeners = _listeners.filter((l) => l !== cb);
    };
  }),
  getCurrentUser: vi.fn(() => _currentUser),
}));

import { useHasRole } from "../../../hooks/useHasRole";
import { onUserChange, getCurrentUser } from "../../../services/authService";

function setCurrentUser(user: any) {
  _currentUser = user;
}

describe("useHasRole", () => {
  beforeEach(() => {
    _listeners = [];
    _currentUser = null;
    vi.clearAllMocks();
    vi.mocked(onUserChange).mockImplementation((cb: (user: any) => void) => {
      _listeners.push(cb);
      return () => {
        _listeners = _listeners.filter((l) => l !== cb);
      };
    });
    vi.mocked(getCurrentUser).mockImplementation(() => _currentUser);
  });

  describe("R-P3-02: role-gated UI elements", () => {
    it("returns false when no user is authenticated", () => {
      const { result } = renderHook(() =>
        useHasRole(["admin", "dispatcher"]),
      );
      expect(result.current).toBe(false);
    });

    it("returns true when user has an allowed role (admin)", () => {
      setCurrentUser({
        id: "u1",
        companyId: "c1",
        email: "admin@test.com",
        name: "Admin",
        role: "admin",
        onboardingStatus: "Completed",
        safetyScore: 100,
      });
      const { result } = renderHook(() =>
        useHasRole(["admin", "dispatcher"]),
      );
      expect(result.current).toBe(true);
    });

    it("returns true when user has an allowed role (dispatcher)", () => {
      setCurrentUser({
        id: "u2",
        companyId: "c1",
        email: "dispatch@test.com",
        name: "Dispatcher",
        role: "dispatcher",
        onboardingStatus: "Completed",
        safetyScore: 95,
      });
      const { result } = renderHook(() =>
        useHasRole(["admin", "dispatcher"]),
      );
      expect(result.current).toBe(true);
    });

    it("returns false when user has a disallowed role (driver)", () => {
      setCurrentUser({
        id: "u3",
        companyId: "c1",
        email: "driver@test.com",
        name: "Driver",
        role: "driver",
        onboardingStatus: "Completed",
        safetyScore: 90,
      });
      const { result } = renderHook(() =>
        useHasRole(["admin", "dispatcher"]),
      );
      expect(result.current).toBe(false);
    });

    it("returns false when user role is empty string", () => {
      setCurrentUser({
        id: "u4",
        companyId: "c1",
        email: "empty@test.com",
        name: "Empty Role",
        role: "",
        onboardingStatus: "Completed",
        safetyScore: 100,
      });
      const { result } = renderHook(() =>
        useHasRole(["admin", "dispatcher"]),
      );
      expect(result.current).toBe(false);
    });

    it("handles single role in allowed list", () => {
      setCurrentUser({
        id: "u5",
        companyId: "c1",
        email: "safety@test.com",
        name: "Safety Manager",
        role: "safety_manager",
        onboardingStatus: "Completed",
        safetyScore: 100,
      });
      const { result } = renderHook(() =>
        useHasRole(["safety_manager"]),
      );
      expect(result.current).toBe(true);
    });

    it("returns false for empty allowed roles list", () => {
      setCurrentUser({
        id: "u1",
        companyId: "c1",
        email: "admin@test.com",
        name: "Admin",
        role: "admin",
        onboardingStatus: "Completed",
        safetyScore: 100,
      });
      const { result } = renderHook(() => useHasRole([]));
      expect(result.current).toBe(false);
    });
  });
});
