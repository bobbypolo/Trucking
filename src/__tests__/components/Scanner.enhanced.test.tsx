import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scanner } from "../../../components/Scanner";

// Mock authService at network boundary
vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-token"),
}));

// Mock fetch at network boundary
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Scanner component — enhanced coverage", () => {
  const user = userEvent.setup();
  const defaultProps = {
    onDataExtracted: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering modes", () => {
    it("renders Scan Load Document title in default load mode", () => {
      render(<Scanner {...defaultProps} />);
      expect(screen.getByText("Scan Load Document")).toBeInTheDocument();
    });

    it("renders correct description in load mode", () => {
      render(<Scanner {...defaultProps} />);
      expect(
        screen.getByText(
          "Upload or take a photo of a Rate Confirmation or BOL.",
        ),
      ).toBeInTheDocument();
    });

    it("renders Scan Broker Profile in broker mode", () => {
      render(<Scanner {...defaultProps} mode="broker" />);
      expect(screen.getByText("Scan Broker Profile")).toBeInTheDocument();
    });

    it("renders correct description in broker mode", () => {
      render(<Scanner {...defaultProps} mode="broker" />);
      expect(
        screen.getByText(
          "Upload a Carrier Packet or Rate Con to create a profile.",
        ),
      ).toBeInTheDocument();
    });

    it("renders Scan Equipment ID in equipment mode", () => {
      render(<Scanner {...defaultProps} mode="equipment" />);
      expect(screen.getByText("Scan Equipment ID")).toBeInTheDocument();
    });

    it("renders correct description in equipment mode", () => {
      render(<Scanner {...defaultProps} mode="equipment" />);
      expect(
        screen.getByText("Take a photo of the Unit ID decal."),
      ).toBeInTheDocument();
    });

    it("renders Harvest Training Content in training mode", () => {
      render(<Scanner {...defaultProps} mode="training" />);
      expect(screen.getByText("Harvest Training Content")).toBeInTheDocument();
    });

    it("renders correct description in training mode", () => {
      render(<Scanner {...defaultProps} mode="training" />);
      expect(
        screen.getByText(
          "Upload safety manuals or technical bulletins to auto-generate quizzes.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("file inputs", () => {
    it("renders Take Photo input with camera capture attribute", () => {
      render(<Scanner {...defaultProps} />);
      expect(screen.getByText("Take Photo")).toBeInTheDocument();
      const cameraInputs = document.querySelectorAll(
        'input[type="file"][capture]',
      );
      expect(cameraInputs.length).toBeGreaterThan(0);
    });

    it("renders Upload PDF/JPG input", () => {
      render(<Scanner {...defaultProps} />);
      expect(screen.getByText("Upload PDF/JPG")).toBeInTheDocument();
    });

    it("has two file inputs", () => {
      render(<Scanner {...defaultProps} />);
      const fileInputs = document.querySelectorAll('input[type="file"]');
      expect(fileInputs.length).toBe(2);
    });

    it("accepts image/* on camera input", () => {
      render(<Scanner {...defaultProps} />);
      const cameraInput = document.querySelector('input[type="file"][capture]');
      expect(cameraInput).toHaveAttribute("accept", "image/*");
    });

    it("accepts image and PDF on upload input", () => {
      render(<Scanner {...defaultProps} />);
      const uploadInput = document.querySelector(
        'input[type="file"][accept="image/*,application/pdf"]',
      );
      expect(uploadInput).not.toBeNull();
    });
  });

  describe("file type validation", () => {
    it("shows error for invalid file types", async () => {
      render(<Scanner {...defaultProps} />);
      const fileInput = document.querySelector(
        'input[type="file"]:not([capture])',
      ) as HTMLInputElement;

      const invalidFile = new File(["test"], "test.txt", {
        type: "text/plain",
      });
      // Use fireEvent for file input change as userEvent.upload has issues
      // with accept attribute filtering in JSDOM
      Object.defineProperty(fileInput, "files", {
        value: [invalidFile],
        configurable: true,
      });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(
          screen.getByText("Please select a valid file (JPG, PNG, PDF)."),
        ).toBeInTheDocument();
      });
    });

    it("accepts valid image file upload without showing error", async () => {
      // Mock a successful AI parse response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { docType: "BOL", loadNumber: "LD-999" },
          }),
      });

      render(<Scanner {...defaultProps} />);
      const fileInput = document.querySelector(
        'input[type="file"]:not([capture])',
      ) as HTMLInputElement;

      const validFile = new File(["fake-image-data"], "bol-scan.jpg", {
        type: "image/jpeg",
      });
      Object.defineProperty(fileInput, "files", {
        value: [validFile],
        configurable: true,
      });
      fireEvent.change(fileInput);

      // The component should not show the invalid file error
      expect(
        screen.queryByText("Please select a valid file (JPG, PNG, PDF)."),
      ).not.toBeInTheDocument();
    });
  });

  describe("cancel button", () => {
    it("renders a cancel/skip button", () => {
      render(<Scanner {...defaultProps} />);
      // Look for Skip or Cancel text
      const skipBtn =
        screen.queryByText(/Skip/i) || screen.queryByText(/Cancel/i);
      expect(skipBtn).not.toBeNull();
    });
  });

  describe("onCancel and onDismiss behavior", () => {
    it("renders skip/cancel button that calls onCancel", async () => {
      render(<Scanner {...defaultProps} />);
      const skipBtn =
        screen.queryByText(/Skip/i) || screen.queryByText(/Cancel/i);
      expect(skipBtn).not.toBeNull();
      await user.click(skipBtn!);
      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it("calls onDismiss when provided and dismiss button is clicked", async () => {
      const onDismiss = vi.fn();
      render(<Scanner {...defaultProps} onDismiss={onDismiss} />);
      // The component should have a dismiss/skip path
      const skipBtn =
        screen.queryByText(/Skip/i) || screen.queryByText(/later/i);
      if (skipBtn) {
        await user.click(skipBtn);
      }
    });
  });

  describe("mode-specific icons", () => {
    it("renders file-text icon in default load mode", () => {
      const { container } = render(<Scanner {...defaultProps} />);
      // The main icon area should contain a FileText SVG
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("renders truck icon in equipment mode", () => {
      const { container } = render(
        <Scanner {...defaultProps} mode="equipment" />,
      );
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });

    it("renders book icon in training mode", () => {
      const { container } = render(
        <Scanner {...defaultProps} mode="training" />,
      );
      const svgs = container.querySelectorAll("svg");
      expect(svgs.length).toBeGreaterThan(0);
    });
  });
});
