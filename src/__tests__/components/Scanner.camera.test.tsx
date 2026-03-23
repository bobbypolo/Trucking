// Tests R-W8-02a, R-W8-02b, R-W8-02c, R-W8-02d, R-W8-VPC-902
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scanner } from "../../../components/Scanner";

// Mock authService at network boundary
vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
}));

// Mock fetch at network boundary
const mockFetch = vi.fn();

/** Helper: build a mock MediaStream with one video track */
function createMockMediaStream() {
  const track = {
    stop: vi.fn(),
    kind: "video" as const,
    enabled: true,
    id: "mock-track-id",
    label: "Mock Camera",
    readyState: "live" as MediaStreamTrackState,
  };
  return {
    stream: {
      getTracks: vi.fn(() => [track]),
      getVideoTracks: vi.fn(() => [track]),
      getAudioTracks: vi.fn(() => []),
      id: "mock-stream-id",
      active: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      clone: vi.fn(),
      dispatchEvent: vi.fn(),
      onaddtrack: null,
      onremovetrack: null,
      onactive: null,
      oninactive: null,
    } as unknown as MediaStream,
    track,
  };
}

describe("Scanner — Live Camera Capture (H-902)", () => {
  const defaultProps = {
    onDataExtracted: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // R-W8-02a: Scanner has "Use Camera" button activating getUserMedia
  describe("R-W8-02a: Use Camera button", () => {
    it("renders a Use Camera button when mediaDevices is available", () => {
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(createMockMediaStream().stream),
        },
      });
      render(<Scanner {...defaultProps} />);
      expect(screen.getByText("Use Camera")).toBeInTheDocument();
    });

    it("clicking Use Camera calls getUserMedia with video constraint", async () => {
      const mockGetUserMedia = vi.fn().mockResolvedValue(createMockMediaStream().stream);
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({ facingMode: "environment" }),
        }),
      );
    });
  });

  // R-W8-02b: Camera stream displayed in video element with capture button
  describe("R-W8-02b: Camera stream in video element", () => {
    it("shows video preview and Capture button after camera is activated", async () => {
      const { stream } = createMockMediaStream();
      const mockGetUserMedia = vi.fn().mockResolvedValue(stream);
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByTestId("camera-preview")).toBeInTheDocument();
      });
      expect(screen.getByText("Capture")).toBeInTheDocument();
    });

    it("shows a Stop Camera button to exit camera mode", async () => {
      const { stream } = createMockMediaStream();
      const mockGetUserMedia = vi.fn().mockResolvedValue(stream);
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByText("Stop Camera")).toBeInTheDocument();
      });
    });
  });

  // R-W8-02c: Capture button takes snapshot and sends to AI extraction
  describe("R-W8-02c: Capture sends snapshot to AI extraction", () => {
    it("clicking Capture draws frame to canvas, stops camera, and calls AI endpoint", async () => {
      const { stream, track } = createMockMediaStream();
      const mockGetUserMedia = vi.fn().mockResolvedValue(stream);
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });

      // Mock canvas context for drawImage and toDataURL
      const mockDrawImage = vi.fn();
      const mockGetContext = vi.fn().mockReturnValue({ drawImage: mockDrawImage });
      const mockToDataURL = vi.fn().mockReturnValue("data:image/png;base64,abc123");
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(mockGetContext);
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(mockToDataURL);

      // Mock successful AI response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          loadInfo: { load: { id: "L-1" }, broker: { name: "TestBroker" } },
        }),
      });

      const onDataExtracted = vi.fn();
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} onDataExtracted={onDataExtracted} />);

      // Activate camera
      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByText("Capture")).toBeInTheDocument();
      });

      // Click Capture
      await user.click(screen.getByText("Capture"));

      // Verify drawImage was called (canvas snapshot)
      expect(mockDrawImage).toHaveBeenCalled();

      // Verify camera tracks were stopped after capture
      expect(track.stop).toHaveBeenCalled();

      // Verify AI extraction endpoint was called with base64 data
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/ai/extract-load"),
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("abc123"),
          }),
        );
      });

      // Verify onDataExtracted was called with extracted data
      await waitFor(() => {
        expect(onDataExtracted).toHaveBeenCalledWith(
          { id: "L-1" },
          { name: "TestBroker" },
        );
      });
    });

    it("shows error when AI extraction fails after capture", async () => {
      const { stream } = createMockMediaStream();
      const mockGetUserMedia = vi.fn().mockResolvedValue(stream);
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });

      const mockDrawImage = vi.fn();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: mockDrawImage } as any);
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,abc123");

      // Mock AI failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "AI service unavailable" }),
      });

      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByText("Capture")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Capture"));

      await waitFor(() => {
        expect(screen.getByText(/scanning failed/i)).toBeInTheDocument();
      });
    });
  });

  // R-W8-02d: Permission denied falls back to file picker with no error
  describe("R-W8-02d: Permission denied falls back to file picker", () => {
    it("shows file picker fallback message when getUserMedia is rejected", async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError"),
      );
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByText(/camera.*unavailable|use.*file.*picker/i)).toBeInTheDocument();
      });
    });

    it("does not show camera button when mediaDevices is not available", () => {
      // Simulate browser without mediaDevices
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: undefined,
      });
      render(<Scanner {...defaultProps} />);
      expect(screen.queryByText("Use Camera")).not.toBeInTheDocument();
    });

    it("falls back gracefully on NotFoundError (no camera hardware)", async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(
        new DOMException("No camera found", "NotFoundError"),
      );
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByText(/camera.*unavailable|use.*file.*picker/i)).toBeInTheDocument();
      });
    });

    it("does not set error state on permission denial (no red error box)", async () => {
      const mockGetUserMedia = vi.fn().mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError"),
      );
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByText(/camera.*unavailable/i)).toBeInTheDocument();
      });
      // Should NOT show error (red) — only a fallback message (amber)
      expect(screen.queryByText(/scanning failed/i)).not.toBeInTheDocument();
    });
  });

  // Supplementary: Camera stream cleanup on unmount (no leak)
  describe("Camera stream cleanup on unmount", () => {
    it("stops all tracks when component unmounts while camera is active", async () => {
      const { stream, track } = createMockMediaStream();
      const mockGetUserMedia = vi.fn().mockResolvedValue(stream);
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      const { unmount } = render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByTestId("camera-preview")).toBeInTheDocument();
      });

      unmount();

      expect(track.stop).toHaveBeenCalled();
    });

    it("stops all tracks when Stop Camera is clicked", async () => {
      const { stream, track } = createMockMediaStream();
      const mockGetUserMedia = vi.fn().mockResolvedValue(stream);
      vi.stubGlobal("navigator", {
        ...navigator,
        mediaDevices: { getUserMedia: mockGetUserMedia },
      });
      const user = userEvent.setup();
      render(<Scanner {...defaultProps} />);

      await user.click(screen.getByText("Use Camera"));

      await waitFor(() => {
        expect(screen.getByText("Stop Camera")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Stop Camera"));

      expect(track.stop).toHaveBeenCalled();
    });
  });
});
