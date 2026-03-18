import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Scanner } from "../../../components/Scanner";

describe("Scanner component", () => {
  const defaultProps = {
    onDataExtracted: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<Scanner {...defaultProps} />);
    expect(screen.getByText(/Scan/i)).toBeInTheDocument();
  });

  it("renders a file upload input", () => {
    render(<Scanner {...defaultProps} />);
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThan(0);
  });

  it("renders in broker mode", () => {
    render(<Scanner {...defaultProps} mode="broker" />);
    expect(screen.getByText(/Scan Broker Profile/i)).toBeInTheDocument();
  });

  it("renders in equipment mode", () => {
    render(<Scanner {...defaultProps} mode="equipment" />);
    expect(screen.getByText(/Scan Equipment/i)).toBeInTheDocument();
  });

  it("renders in load mode by default", () => {
    render(<Scanner {...defaultProps} />);
    expect(screen.getByText(/Scan/i)).toBeInTheDocument();
  });
});
