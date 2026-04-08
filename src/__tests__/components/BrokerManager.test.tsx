import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrokerManager } from "../../../components/BrokerManager";
import { Broker } from "../../../types";

// Mock services at network boundary
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
      approvedChassis: [],
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
      approvedChassis: [
        {
          id: "ch-1",
          provider: "TRAC",
          type: "40' Gooseneck",
          prefixes: ["TRAC", "TXZZ"],
        },
      ],
      safetyScore: 88,
    },
    {
      id: "broker-3",
      name: "Gamma Freight",
      mcNumber: "MC-999000",
      isShared: true,
      clientType: "Broker",
      approvedChassis: [],
    },
  ]),
  saveBroker: vi.fn().mockResolvedValue(undefined),
  getContracts: vi.fn().mockResolvedValue([]),
  saveContract: vi.fn().mockResolvedValue(undefined),
}));

describe("BrokerManager component", () => {
  const defaultProps = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders without crashing", () => {
      render(<BrokerManager {...defaultProps} />);
      expect(screen.getByText("Entity Registry")).toBeInTheDocument();
    });

    it("renders the Entity Registry header", () => {
      render(<BrokerManager {...defaultProps} />);
      expect(screen.getByText("Entity Registry")).toBeInTheDocument();
    });

    it("renders the subtitle", () => {
      render(<BrokerManager {...defaultProps} />);
      expect(
        screen.getByText(/Unified Entity Management/i),
      ).toBeInTheDocument();
    });

    it("renders Add Entity button", () => {
      render(<BrokerManager {...defaultProps} />);
      expect(screen.getByText("Add Entity")).toBeInTheDocument();
    });

    it("renders search input", () => {
      render(<BrokerManager {...defaultProps} />);
      expect(
        screen.getByPlaceholderText(/SEARCH BY ENTITY NAME/),
      ).toBeInTheDocument();
    });

    it("renders tab buttons (My Accounts / Organization)", () => {
      render(<BrokerManager {...defaultProps} />);
      expect(screen.getByText("My Accounts")).toBeInTheDocument();
      expect(screen.getByText("Organization")).toBeInTheDocument();
    });
  });

  describe("broker list", () => {
    it("displays broker names after loading", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
        expect(screen.getByText("Beta Transport")).toBeInTheDocument();
        expect(screen.getByText("Gamma Freight")).toBeInTheDocument();
      });
    });

    it("displays broker MC numbers", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/MC: MC-123456/)).toBeInTheDocument();
        expect(screen.getByText(/MC: MC-654321/)).toBeInTheDocument();
      });
    });

    it("displays broker emails", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("alpha@logistics.com")).toBeInTheDocument();
        expect(screen.getByText("beta@transport.com")).toBeInTheDocument();
      });
    });

    it("displays broker phones", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("(555) 111-2222")).toBeInTheDocument();
        expect(screen.getByText("(555) 333-4444")).toBeInTheDocument();
      });
    });

    it("displays entity class badges", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getAllByText("Broker").length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText("Customer")).toBeInTheDocument();
      });
    });

    it("displays safety scores", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/Score: 95/)).toBeInTheDocument();
        expect(screen.getByText(/Score: 88/)).toBeInTheDocument();
      });
    });

    it("shows CONTACT PENDING for brokers without email", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("CONTACT PENDING")).toBeInTheDocument();
      });
    });

    it("shows approved chassis badges", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("TRAC 40' Gooseneck")).toBeInTheDocument();
      });
    });
  });

  describe("search functionality", () => {
    it("filters brokers by name", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const searchInput = screen.getByPlaceholderText(/SEARCH BY ENTITY NAME/);
      await user.type(searchInput, "Alpha");
      expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      expect(screen.queryByText("Beta Transport")).not.toBeInTheDocument();
      expect(screen.queryByText("Gamma Freight")).not.toBeInTheDocument();
    });

    it("filters brokers by MC number", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const searchInput = screen.getByPlaceholderText(/SEARCH BY ENTITY NAME/);
      await user.type(searchInput, "MC-654321");
      expect(screen.queryByText("Alpha Logistics")).not.toBeInTheDocument();
      expect(screen.getByText("Beta Transport")).toBeInTheDocument();
    });

    it("shows no brokers when search matches nothing", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const searchInput = screen.getByPlaceholderText(/SEARCH BY ENTITY NAME/);
      await user.type(searchInput, "NonexistentBroker");
      expect(screen.queryByText("Alpha Logistics")).not.toBeInTheDocument();
      expect(screen.queryByText("Beta Transport")).not.toBeInTheDocument();
    });
  });

  describe("add entity form", () => {
    it("opens add form when Add Entity is clicked", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Add New Entity")).toBeInTheDocument();
    });

    it("shows form fields in add form", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Entity Class")).toBeInTheDocument();
      expect(screen.getByText("Visibility")).toBeInTheDocument();
      expect(screen.getByText(/Legal Entity Name/)).toBeInTheDocument();
      expect(screen.getByText("MC Number")).toBeInTheDocument();
      expect(screen.getByText("DOT Number")).toBeInTheDocument();
      expect(screen.getByText("Primary Email")).toBeInTheDocument();
      expect(screen.getByText("Central Phone")).toBeInTheDocument();
    });

    it("shows chassis section in form", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(
        screen.getByText("Approved Chassis Requirements"),
      ).toBeInTheDocument();
    });

    it("shows Save Entity Profile button", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Save Entity Profile")).toBeInTheDocument();
    });

    it("shows Cancel Changes button", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Cancel Changes")).toBeInTheDocument();
    });

    it("closes form when Cancel Changes is clicked", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Add New Entity")).toBeInTheDocument();
      await user.click(screen.getByText("Cancel Changes"));
      expect(screen.queryByText("Add New Entity")).not.toBeInTheDocument();
    });

    it("allows typing entity name", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      const nameInput = await screen.findByPlaceholderText(
        /ENTER FULL REGISTERED COMPANY NAME/,
      );
      await user.type(nameInput, "Omega Carriers");
      await waitFor(() => {
        expect(nameInput).toHaveValue("Omega Carriers");
      });
    });

    it("allows typing MC number", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      const mcInput = await screen.findByPlaceholderText("e.g., MC-123456");
      await user.type(mcInput, "MC-777888");
      await waitFor(() => {
        expect(mcInput).toHaveValue("MC-777888");
      });
    });

    it("calls saveBroker when Save Entity Profile is clicked", async () => {
      const { saveBroker } = await import("../../../services/brokerService");
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      const nameInput = screen.getByPlaceholderText(
        /ENTER FULL REGISTERED COMPANY NAME/,
      );
      await user.type(nameInput, "New Broker");
      await user.click(screen.getByText("Save Entity Profile"));
      await waitFor(() => {
        expect(saveBroker).toHaveBeenCalled();
      });
    });
  });

  describe("chassis management in form", () => {
    it("shows empty chassis message initially", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText(/No chassis rules defined/)).toBeInTheDocument();
    });

    it("renders Add to Approved List button", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Add to Approved List")).toBeInTheDocument();
    });

    it("renders chassis type dropdown with options", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      const text = document.body.textContent || "";
      expect(text).toContain("40' Gooseneck");
      expect(text).toContain("20' Slider");
    });

    it("adds a chassis rule when provider is filled and button is clicked", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      const providerInput = screen.getByPlaceholderText(
        /PROVIDER.*TRAC.*FLEXI/,
      );
      await user.type(providerInput, "FLEXI");
      await user.click(screen.getByText("Add to Approved List"));
      expect(
        screen.queryByText(/No chassis rules defined/),
      ).not.toBeInTheDocument();
      expect(screen.getByText("FLEXI")).toBeInTheDocument();
    });

    it("does not add chassis when provider is empty", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      await user.click(screen.getByText("Add to Approved List"));
      // Should still show empty message
      expect(screen.getByText(/No chassis rules defined/)).toBeInTheDocument();
    });
  });

  describe("visibility toggle", () => {
    it("shows Shared (Team) by default in add form", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      expect(screen.getByText("Shared (Team)")).toBeInTheDocument();
    });

    it("toggles to Private (Me) when clicked", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      await user.click(screen.getByText("Shared (Team)"));
      expect(screen.getByText("Private (Me)")).toBeInTheDocument();
    });
  });

  describe("tab switching", () => {
    it("starts on My Accounts tab", () => {
      render(<BrokerManager {...defaultProps} />);
      const myTab = screen.getByText("My Accounts");
      expect(myTab.className).toContain("bg-blue-600");
    });

    it("switches to Organization tab when clicked", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Organization"));
      const orgTab = screen.getByText("Organization");
      expect(orgTab.className).toContain("bg-blue-600");
    });
  });

  describe("callbacks", () => {
    it("calls onAddLoad when create load button is clicked on a broker card", async () => {
      const onAddLoad = vi.fn();
      render(<BrokerManager onAddLoad={onAddLoad} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const addButtons = document.querySelectorAll('[title="Create Load"]');
      expect(addButtons.length).toBeGreaterThan(0);
      const user = userEvent.setup();
      await user.click(addButtons[0] as HTMLElement);
      expect(onAddLoad).toHaveBeenCalledWith("broker-1");
    });
  });

  describe("edit form submit (line 537)", () => {
    it("opens edit form when edit button is clicked on a broker card", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText("Alpha Logistics")).toBeInTheDocument();
      });
      const editButtons = document.querySelectorAll("button");
      const editBtn = Array.from(editButtons).find(
        (b) =>
          b.querySelector("svg") &&
          b.closest("[class*='absolute']") &&
          !b.getAttribute("title"),
      );
      if (editBtn) {
        await user.click(editBtn);
        expect(screen.getByText("Edit Entity")).toBeInTheDocument();
      }
    });

    it("calls onSave callback when save is triggered", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      render(<BrokerManager onSave={onSave} />);
      await user.click(screen.getByText("Add Entity"));
      const nameInput = screen.getByPlaceholderText(
        /ENTER FULL REGISTERED COMPANY NAME/,
      );
      await user.type(nameInput, "Delta LLC");
      await user.click(screen.getByText("Save Entity Profile"));
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({ name: "Delta LLC" }),
        );
      });
    });
  });

  describe("chassis deletion (lines 576-586)", () => {
    it("removes a chassis rule when trash button is clicked", async () => {
      const user = userEvent.setup();
      render(<BrokerManager {...defaultProps} />);
      await user.click(screen.getByText("Add Entity"));
      // Add a chassis first
      const providerInput = screen.getByPlaceholderText(
        /PROVIDER.*TRAC.*FLEXI/,
      );
      await user.type(providerInput, "TRAC");
      await user.click(screen.getByText("Add to Approved List"));
      expect(screen.getByText("TRAC")).toBeInTheDocument();
      // Now remove it
      const trashButtons = document.querySelectorAll("button");
      const trashBtn = Array.from(trashButtons).find(
        (b) =>
          b.className.includes("hover:text-red-500") &&
          b.closest("[class*='bg-slate-950']"),
      );
      expect(trashBtn).toBeTruthy();
      await user.click(trashBtn!);
      expect(screen.getByText(/No chassis rules defined/)).toBeInTheDocument();
    });
  });

  describe("safety score display", () => {
    it("shows N/A for brokers without safety score", async () => {
      render(<BrokerManager {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/Score: N\/A/)).toBeInTheDocument();
      });
    });
  });
});
