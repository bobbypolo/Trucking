/**
 * useLoadStatus hook — manages load status transitions with optimistic updates.
 *
 * Tests R-P3-02: Exports transitionTo(status) that calls updateLoadStatus.
 * Tests R-P3-03: Sets status optimistically before API call, reverts on error.
 * Tests R-P3-07: Rejects invalid transition by rolling back and displaying 422 error.
 */

import { useState, useCallback } from "react";
import { updateLoadStatus } from "../services/loads";
import type { LoadStatus } from "../types/load";

interface UseLoadStatusResult {
  status: LoadStatus;
  updating: boolean;
  error: string | null;
  transitionTo: (newStatus: LoadStatus) => Promise<void>;
}

export function useLoadStatus(
  loadId: string,
  initialStatus: LoadStatus,
): UseLoadStatusResult {
  const [status, setStatus] = useState<LoadStatus>(initialStatus);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transitionTo = useCallback(
    async (newStatus: LoadStatus) => {
      const previousStatus = status;
      setError(null);
      setUpdating(true);

      // Optimistic update: set status before the API call
      setStatus(newStatus);

      try {
        await updateLoadStatus(loadId, newStatus);
      } catch (err: unknown) {
        // Rollback to previousStatus on error
        setStatus(previousStatus);

        if (err instanceof Error) {
          // Extract message from 422 response body
          const errorWithResponse = err as Error & {
            response?: { status?: number; data?: { message?: string } };
            status?: number;
            message: string;
          };

          if (
            errorWithResponse.response?.status === 422 ||
            errorWithResponse.status === 422
          ) {
            const serverMessage =
              errorWithResponse.response?.data?.message ||
              errorWithResponse.message ||
              "Invalid load transition";
            setError(serverMessage);
          } else {
            setError(err.message || "Failed to update status");
          }
        } else {
          setError("Failed to update status");
        }
      } finally {
        setUpdating(false);
      }
    },
    [loadId, status],
  );

  return { status, updating, error, transitionTo };
}
