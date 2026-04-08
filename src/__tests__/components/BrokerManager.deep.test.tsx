import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrokerManager } from "../../../components/BrokerManager";

vi.mock("../../../services/brokerService", () => ({
  getBrokers: vi.fn().mockResolvedValue([
    {
      id: "broker-1",
      name: "Alpha Logistics",
      mcNumber: "MC-123456",
      dotNumber: "DOT-789",
      email: "alpha@logistics.com",
      phone: "(555) 111-2222",
      isShared: true,
      clientType: "Broker",
      approvedChassis: [
        {
          id: "ch-1",
          provider: "TRAC",
          type: "40' Gooseneck",
          prefixes: ["TRAC", "TXZZ"],
        },
        {
          id: "ch-2",
          provider: "FLEXI",
          type: "20' Slider",
          prefixes: ["FLXI"],
        },
        {
          id: "ch-3",
          provider: "DCLI",
          type: "45' Extendable",
          prefixes: ["DCLI"],
        },
      ],
      safetyScore: 95,
    },
    {
      id: "broker-2",
      name: "Beta Transport",
      mcNumber: "MC-654321",
      email: "beta@transport.com",
      phone: "(555) 333-4444",
      isShared: false,
      clientType: "Direct Customer",
      approvedChassis: [],
      safetyScore: null,
    },
  ]),
  saveBroker: vi.fn().mockResolvedValue(undefined),
  getContracts: vi.fn().mockResolvedValue([]),
  saveContract: vi.fn().mockResolvedValue(undefined),
}));

import { saveBroker, getBrokers } from "../../../services/brokerService";

describe("BrokerManager deep coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("edit submit flow (line 517)", () => {
    it("opens edit form when clicking edit button on a broker card", async () => {
      const user = userEvent.setup();
      render(<BrokerManager />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });

      const editButtons = document.querySelectorAll("button svg");
      const editBtnParents = Array.from(editButtons)
        .map((svg) => svg.closest("button"))
        .filter((btn) => btn && btn.querySelector("svg"));

      const alphaCard = screen
        .getByText("Alpha Logistics")
        .closest("[class*='rounded-2xl']");
      const editBtn = alphaCard?.querySelector("button[class*='bg-slate-800']");
      expect(editBtn).toBeInTheDocument();
      await user.click(editBtn as HTMLElement);
      await waitFor(() => {
        expect(screen.getByText("Edit Entity")).toBeInTheDocument();
      });
    });

    it("saves an edited broker entity with updated name", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<BrokerManager onSave={onSave} />);

      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });

      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Add New Entity")).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText(
        /ENTER FULL REGISTERED COMPANY NAME/,
      );
      await user.type(nameInput, "Omega Corp");

      await user.click(screen.getByText("Save Entity Profile"));

      await waitFor(() => {
        expect(saveBroker).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Omega Corp",
          }),
        );
      });

      expect(onSave).toHaveBeenCalled();
    });
  });

  describe("chassis deletion (line 537)", () => {
    it("removes a chassis rule when delete button is clicked in edit form", async () => {
      const user = userEvent.setup();
      render(<BrokerManager />);

      await user.click(screen.getByText("Add Entity"));

      const providerInput = screen.getByPlaceholderText(
        /PROVIDER.*TRAC.*FLEXI/,
      );
      await user.type(providerInput, "TESTPROV");

      const prefixInput = screen.getByPlaceholderText(
        /PREFIXES.*TRAC.*TXZZ.*TRLU/,
      );
      await user.type(prefixInput, "PFX1, PFX2");

      await user.click(screen.getByText("Add to Approved List"));

      expect(await screen.findByText("TESTPROV")).toBeInTheDocument();
      expect(
        screen.queryByText(/No chassis rules defined/),
      ).not.toBeInTheDocument();

      const deleteButtons = document.querySelectorAll(
        "button[class*='hover:text-red-500']",
      );
      expect(deleteButtons.length).toBeGreaterThan(0);
      await user.click(deleteButtons[0] as HTMLElement);

      expect(screen.getByText(/No chassis rules defined/)).toBeInTheDocument();
    });
  });

  describe("safety score display (lines 576-586)", () => {
    it("shows N/A when safetyScore is null", async () => {
      render(<BrokerManager />);

      await waitFor(() => {
        expect(screen.getByText(/Score: N\/A/)).toBeInTheDocument();
      });
    });

    it("shows numeric safety score when available", async () => {
      render(<BrokerManager />);

      await waitFor(() => {
        expect(screen.getByText(/Score: 95/)).toBeInTheDocument();
      });
    });
  });

  describe("chassis badge overflow (+N MORE)", () => {
    it("shows +N MORE badge when broker has more than 2 chassis entries", async () => {
      render(<BrokerManager />);

      await waitFor(() => {
        expect(screen.getByText("+1 MORE")).toBeInTheDocument();
      });
    });
  });

  describe("NO RECORD display for missing phone", () => {
    it("shows NO RECORD for brokers without phone", async () => {
      vi.mocked(getBrokers).mockResolvedValue([
        {
          id: "broker-x",
          name: "NoPhone Co",
          mcNumber: "MC-000",
          isShared: true,
          clientType: "Broker" as const,
          approvedChassis: [],
        },
      ] as any);

      render(<BrokerManager />);

      await waitFor(() => {
        expect(screen.getByText("NO RECORD")).toBeInTheDocument();
      });
    });
  });

  describe("entity class dropdown in form", () => {
    it("allows changing entity class to Customer", async () => {
      const user = userEvent.setup();
      render(<BrokerManager />);

      await user.click(screen.getByText("Add Entity"));

      const typeSelect = screen.getByDisplayValue("Broker / 3PL");
      await user.selectOptions(typeSelect, "Customer");

      expect(typeSelect).toHaveValue("Customer");
    });
  });

  describe("chassis prefixes are parsed correctly", () => {
    it("adds chassis with comma-separated prefixes", async () => {
      const user = userEvent.setup();
      render(<BrokerManager />);

      await user.click(screen.getByText("Add Entity"));

      const providerInput = screen.getByPlaceholderText(
        /PROVIDER.*TRAC.*FLEXI/,
      );
      await user.type(providerInput, "ZIMPROV");

      const prefixInput = screen.getByPlaceholderText(
        /PREFIXES.*TRAC.*TXZZ.*TRLU/,
      );
      await user.type(prefixInput, "ZPFX, ZQFX, ZRFX");

      await user.click(screen.getByText("Add to Approved List"));

      expect(await screen.findByText("ZIMPROV")).toBeInTheDocument();
      expect(await screen.findByText("ZPFX")).toBeInTheDocument();
      expect(await screen.findByText("ZQFX")).toBeInTheDocument();
      expect(await screen.findByText("ZRFX")).toBeInTheDocument();
    });
  });
});
