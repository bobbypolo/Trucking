import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CertExpiryWarnings } from "../../../components/ui/CertExpiryWarnings";

const mockCerts = [
  {
    driverId: "driver-1",
    certType: "CDL",
    expiryDate: "2026-03-25T00:00:00.000Z",
    daysRemaining: 4,
  },
  {
    driverId: "driver-2",
    certType: "Medical Card",
    expiryDate: "2026-04-15T00:00:00.000Z",
    daysRemaining: 25,
  },
  {
    driverId: "driver-3",
    certType: "HazMat",
    expiryDate: "2026-03-15T00:00:00.000Z",
    daysRemaining: -6,
  },
];

describe("CertExpiryWarnings", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("shows loading state initially", () => {
    fetchSpy.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    render(<CertExpiryWarnings companyId="company-1" />);
    expect(screen.getByTestId("cert-expiry-loading")).toBeDefined();
  });

  it("renders expiring certs from API", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCerts),
    } as Response);

    render(<CertExpiryWarnings companyId="company-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("cert-expiry-warnings")).toBeDefined();
    });

    const items = screen.getAllByTestId("cert-expiry-item");
    expect(items.length).toBe(3);

    // Check that cert types are displayed
    expect(screen.getByText("CDL")).toBeDefined();
    expect(screen.getByText("Medical Card")).toBeDefined();
    expect(screen.getByText("HazMat")).toBeDefined();
  });

  it("shows urgency levels correctly", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCerts),
    } as Response);

    render(<CertExpiryWarnings companyId="company-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("cert-expiry-warnings")).toBeDefined();
    });

    // EXPIRED for daysRemaining <= 0
    expect(screen.getByText("EXPIRED")).toBeDefined();
    // URGENT for daysRemaining <= 7
    expect(screen.getByText("URGENT")).toBeDefined();
    // WARNING for daysRemaining > 7
    expect(screen.getByText("WARNING")).toBeDefined();
  });

  it("shows empty state when no certs expiring", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    render(<CertExpiryWarnings companyId="company-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("cert-expiry-empty")).toBeDefined();
    });

    expect(
      screen.getByText(/no certificates expiring/i),
    ).toBeDefined();
  });

  it("shows error state on fetch failure", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    render(<CertExpiryWarnings companyId="company-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("cert-expiry-error")).toBeDefined();
    });

    expect(screen.getByText(/failed to load cert expiry data/i)).toBeDefined();
  });

  it("shows alert count badge", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCerts),
    } as Response);

    render(<CertExpiryWarnings companyId="company-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("cert-expiry-warnings")).toBeDefined();
    });

    expect(screen.getByText("3 alerts")).toBeDefined();
  });

  it("calls correct API endpoint with days parameter", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);

    render(<CertExpiryWarnings companyId="company-1" daysAhead={60} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/safety/expiring-certs?days=60",
      );
    });
  });
});
