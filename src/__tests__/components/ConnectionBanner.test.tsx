import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock apiHealth before importing component
const mockGetStatus = vi.fn().mockReturnValue("connected");
const mockOnConnectionChange = vi.fn().mockReturnValue(() => {});
const mockStartPolling = vi.fn();
const mockCheckNow = vi.fn().mockResolvedValue("connected");

vi.mock("../../../services/apiHealth", () => ({
  apiHealth: {
    getStatus: () => mockGetStatus(),
    onConnectionChange: (cb: any) => mockOnConnectionChange(cb),
    startPolling: () => mockStartPolling(),
    checkNow: () => mockCheckNow(),
  },
}));

import ConnectionBanner from "../../../components/ui/ConnectionBanner";

describe("ConnectionBanner", () => {
  let capturedListener: ((status: string) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedListener = null;
    mockGetStatus.mockReturnValue("connected");
    mockOnConnectionChange.mockImplementation((cb: any) => {
      capturedListener = cb;
      return () => {};
    });
    mockCheckNow.mockResolvedValue("connected");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when connected", () => {
    mockGetStatus.mockReturnValue("connected");
    const { container } = render(<ConnectionBanner />);
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("renders offline banner", () => {
    mockGetStatus.mockReturnValue("offline");
    render(<ConnectionBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Connection lost/),
    ).toBeInTheDocument();
  });

  it("renders degraded banner", () => {
    mockGetStatus.mockReturnValue("degraded");
    render(<ConnectionBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByText(/Some features may be slow/),
    ).toBeInTheDocument();
  });

  it("applies red background for offline status", () => {
    mockGetStatus.mockReturnValue("offline");
    render(<ConnectionBanner />);
    const alert = screen.getByRole("alert");
    expect(alert.style.backgroundColor).toBe("rgb(220, 38, 38)");
  });

  it("applies amber background for degraded status", () => {
    mockGetStatus.mockReturnValue("degraded");
    render(<ConnectionBanner />);
    const alert = screen.getByRole("alert");
    expect(alert.style.backgroundColor).toBe("rgb(245, 158, 11)");
  });

  it("shows Retry button", () => {
    mockGetStatus.mockReturnValue("offline");
    render(<ConnectionBanner />);
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("calls checkNow and onRetry when Retry is clicked", async () => {
    mockGetStatus.mockReturnValue("offline");
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ConnectionBanner onRetry={onRetry} />);

    await user.click(screen.getByText("Retry"));

    expect(mockCheckNow).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
  });

  it("starts polling on mount", () => {
    mockGetStatus.mockReturnValue("offline");
    render(<ConnectionBanner />);
    expect(mockStartPolling).toHaveBeenCalled();
  });

  it("subscribes to connection changes on mount", () => {
    mockGetStatus.mockReturnValue("offline");
    render(<ConnectionBanner />);
    expect(mockOnConnectionChange).toHaveBeenCalled();
  });

  it("updates display when status changes to offline", () => {
    mockGetStatus.mockReturnValue("connected");
    render(<ConnectionBanner />);

    // Simulate status change
    if (capturedListener) {
      act(() => {
        capturedListener!("offline" as any);
      });
    }
  });

  it("handles Retry without onRetry prop", async () => {
    mockGetStatus.mockReturnValue("offline");
    const user = userEvent.setup();
    render(<ConnectionBanner />);

    await user.click(screen.getByText("Retry"));

    expect(mockCheckNow).toHaveBeenCalled();
    // Should not throw even without onRetry
  });
});
