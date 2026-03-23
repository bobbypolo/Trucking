// Tests R-P1-08, R-P1-09
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll mock authService to control onUserChange and getCurrentUser
let _listeners: ((user: any) => void)[] = [];
let _currentUser: any = null;

vi.mock("../../../services/authService", () => ({
  onUserChange: vi.fn((cb: (user: any) => void) => {
    _listeners.push(cb);
    return () => {
      _listeners = _listeners.filter((l) => l !== cb);
    };
  }),
  getCurrentUser: vi.fn(() => _currentUser),
}));

import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { onUserChange, getCurrentUser } from "../../../services/authService";

function emitUserChange(user: any) {
  _currentUser = user;
  _listeners.forEach((cb) => cb(user));
}

function setCurrentUser(user: any) {
  _currentUser = user;
}

describe("useCurrentUser", () => {
  beforeEach(() => {
    _listeners = [];
    _currentUser = null;
    vi.clearAllMocks();
    // Restore implementation after clearAllMocks wipes it
    vi.mocked(onUserChange).mockImplementation((cb: (user: any) => void) => {
      _listeners.push(cb);
      return () => {
        _listeners = _listeners.filter((l) => l !== cb);
      };
    });
    vi.mocked(getCurrentUser).mockImplementation(() => _currentUser);
  });

  // R-P1-08: useCurrentUser hook subscribes to onUserChange and returns reactive user state
  describe("R-P1-08: reactive subscription", () => {
    it("returns null when no user is authenticated", () => {
      const { result } = renderHook(() => useCurrentUser());
      expect(result.current).toBeNull();
    });

    it("subscribes to onUserChange on mount", () => {
      renderHook(() => useCurrentUser());
      expect(onUserChange).toHaveBeenCalledOnce();
      expect(onUserChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it("returns initial user from getCurrentUser", () => {
      const mockUser = {
        id: "u1",
        companyId: "c1",
        email: "test@test.com",
        name: "Test User",
        role: "admin",
        onboardingStatus: "Completed",
        safetyScore: 100,
      };
      setCurrentUser(mockUser);
      const { result } = renderHook(() => useCurrentUser());
      expect(result.current).toEqual(mockUser);
    });

    it("updates when onUserChange fires with a new user", () => {
      const { result } = renderHook(() => useCurrentUser());
      expect(result.current).toBeNull();

      const newUser = {
        id: "u2",
        companyId: "c2",
        email: "new@test.com",
        name: "New User",
        role: "dispatcher",
        onboardingStatus: "Completed",
        safetyScore: 95,
      };

      act(() => {
        emitUserChange(newUser);
      });

      expect(result.current).toEqual(newUser);
    });

    it("updates to null when user signs out", () => {
      const initialUser = {
        id: "u1",
        companyId: "c1",
        email: "test@test.com",
        name: "Test User",
        role: "admin",
        onboardingStatus: "Completed",
        safetyScore: 100,
      };
      setCurrentUser(initialUser);
      const { result } = renderHook(() => useCurrentUser());
      expect(result.current).toEqual(initialUser);

      act(() => {
        emitUserChange(null);
      });

      expect(result.current).toBeNull();
    });

    it("unsubscribes from onUserChange on unmount", () => {
      const { unmount } = renderHook(() => useCurrentUser());
      expect(_listeners.length).toBe(1);

      unmount();

      expect(_listeners.length).toBe(0);
    });
  });

  // R-P1-09: Consumer components re-render on auth state change without null-user crashes
  describe("R-P1-09: no null-user crashes", () => {
    it("safely handles rapid user changes without crash", () => {
      const { result } = renderHook(() => useCurrentUser());

      const user1 = {
        id: "u1",
        companyId: "c1",
        email: "a@test.com",
        name: "A",
        role: "admin",
        onboardingStatus: "Completed" as const,
        safetyScore: 100,
      };
      const user2 = {
        id: "u2",
        companyId: "c2",
        email: "b@test.com",
        name: "B",
        role: "dispatcher",
        onboardingStatus: "Completed" as const,
        safetyScore: 90,
      };

      act(() => {
        emitUserChange(user1);
        emitUserChange(null);
        emitUserChange(user2);
      });

      expect(result.current).toEqual(user2);
    });

    it("returns null (not undefined or throw) when getCurrentUser returns null", () => {
      const { result } = renderHook(() => useCurrentUser());
      expect(result.current).toBeNull();
      // Explicitly: not undefined
      expect(result.current).not.toBeUndefined();
    });

    it("does not crash when onUserChange callback receives null after mount", () => {
      const user = {
        id: "u1",
        companyId: "c1",
        email: "test@test.com",
        name: "Test",
        role: "admin",
        onboardingStatus: "Completed" as const,
        safetyScore: 100,
      };
      setCurrentUser(user);
      const { result } = renderHook(() => useCurrentUser());
      expect(result.current).toEqual(user);

      // Simulate auth expiry / sign out
      expect(() => {
        act(() => {
          emitUserChange(null);
        });
      }).not.toThrow();

      expect(result.current).toBeNull();
    });

    it("optional chaining on returned user does not crash when null", () => {
      // Ensure no user is set
      const { result } = renderHook(() => useCurrentUser());
      // Simulating consumer pattern: currentUser?.companyId
      expect(result.current?.companyId).toBeUndefined();
      expect(result.current?.role).toBeUndefined();
    });
  });
});
