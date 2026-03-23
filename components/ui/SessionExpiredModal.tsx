import React, { useRef, useEffect, useCallback } from "react";
import { Lock } from "lucide-react";
import { logout } from "../../services/authService";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface SessionExpiredModalProps {
  open: boolean;
  onNavigateToLogin: () => void;
}

/**
 * SessionExpiredModal -- renders on auth:session-expired events.
 *
 * Accessibility: role="alertdialog", aria-modal="true", focus trapped.
 * Deduplication is handled by the parent (App.tsx) via a single boolean flag.
 */
export function SessionExpiredModal({
  open,
  onNavigateToLogin,
}: SessionExpiredModalProps) {
  const signInRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleSignIn = useCallback(async () => {
    await logout();
    onNavigateToLogin();
  }, [onNavigateToLogin]);

  useFocusTrap(panelRef, open, handleSignIn);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      aria-hidden={!open}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-desc"
        className="relative w-full max-w-md rounded-xl bg-slate-800 p-8 shadow-2xl"
      >
        {/* Lock icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20">
            <Lock className="h-7 w-7 text-amber-400" />
          </div>
        </div>

        <h2
          id="session-expired-title"
          className="mb-2 text-center text-xl font-semibold text-white"
        >
          Your session has expired
        </h2>

        <p
          id="session-expired-desc"
          className="mb-6 text-center text-sm text-slate-300"
        >
          Please sign in again to continue. Any unsaved changes will be lost.
        </p>

        <button
          ref={signInRef}
          onClick={handleSignIn}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
