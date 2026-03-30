// Tests R-P5-03
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useApiError } from "../../../hooks/useApiError";

describe("useApiError", () => {
  // Tests R-P5-03 — initial state
  it("returns {error: null, loading: false, data: null} initially", () => {
    const { result } = renderHook(() => useApiError<string>());

    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(typeof result.current.execute).toBe("function");
  });

  // Tests R-P5-03 — successful call populates data
  it("sets data on successful API call", async () => {
    const { result } = renderHook(() => useApiError<string>());

    await act(async () => {
      await result.current.execute(async () => "hello-world");
    });

    expect(result.current.data).toBe("hello-world");
    expect(result.current.error).toBe(null);
    expect(result.current.loading).toBe(false);
  });

  // Tests R-P5-03 — failed call sets error
  it("sets error when API call throws", async () => {
    const { result } = renderHook(() => useApiError<string>());

    await act(async () => {
      await result.current.execute(async () => {
        throw new Error("network failure");
      });
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("network failure");
    expect(result.current.loading).toBe(false);
  });

  // Tests R-P5-03 — auto-clears error on retry
  it("auto-clears error on retry and sets new data on success", async () => {
    const { result } = renderHook(() => useApiError<number>());

    // First call fails
    await act(async () => {
      await result.current.execute(async () => {
        throw new Error("first failure");
      });
    });
    expect(result.current.error?.message).toBe("first failure");

    // Retry succeeds — error should be auto-cleared
    await act(async () => {
      await result.current.execute(async () => 42);
    });
    expect(result.current.error).toBe(null);
    expect(result.current.data).toBe(42);
    expect(result.current.loading).toBe(false);
  });

  // Tests R-P5-03 — wraps non-Error throws
  it("wraps non-Error thrown values into Error instances", async () => {
    const { result } = renderHook(() => useApiError<string>());

    await act(async () => {
      await result.current.execute(async () => {
        throw "string-error";
      });
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("string-error");
  });

  // Tests R-P5-03 — execute returns data on success, null on failure
  it("returns data from execute on success, null on failure", async () => {
    const { result } = renderHook(() => useApiError<string>());

    let returnVal: string | null = null;
    await act(async () => {
      returnVal = await result.current.execute(async () => "success-val");
    });
    expect(returnVal).toBe("success-val");

    await act(async () => {
      returnVal = await result.current.execute(async () => {
        throw new Error("fail");
      });
    });
    expect(returnVal).toBe(null);
  });

  // Tests R-P5-03 — previous data preserved on error
  it("preserves previous data when a subsequent call fails", async () => {
    const { result } = renderHook(() => useApiError<string>());

    // Successful call
    await act(async () => {
      await result.current.execute(async () => "initial-data");
    });
    expect(result.current.data).toBe("initial-data");

    // Failed call — data should stay
    await act(async () => {
      await result.current.execute(async () => {
        throw new Error("oops");
      });
    });
    expect(result.current.data).toBe("initial-data");
    expect(result.current.error?.message).toBe("oops");
  });
});
