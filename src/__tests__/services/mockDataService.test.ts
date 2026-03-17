import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock all storage dependencies before importing
vi.mock("../../../services/storageService", () => ({
  saveLoad: vi.fn().mockResolvedValue(undefined),
  saveIncident: vi.fn().mockResolvedValue(undefined),
  saveRequest: vi.fn().mockResolvedValue(undefined),
  saveCallSession: vi.fn().mockResolvedValue(undefined),
  saveTask: vi.fn().mockResolvedValue(undefined),
  saveProvider: vi.fn().mockResolvedValue(undefined),
  saveContact: vi.fn().mockResolvedValue(undefined),
  saveServiceTicket: vi.fn().mockResolvedValue(undefined),
  saveWorkItem: vi.fn().mockResolvedValue(undefined),
}));

import { seedMockData } from "../../../services/mockDataService";
import {
  saveLoad,
  saveIncident,
  saveRequest,
  saveCallSession,
  saveTask,
  saveProvider,
  saveContact,
  saveServiceTicket,
  saveWorkItem,
} from "../../../services/storageService";

const mockSaveLoad = saveLoad as ReturnType<typeof vi.fn>;
const mockSaveIncident = saveIncident as ReturnType<typeof vi.fn>;
const mockSaveRequest = saveRequest as ReturnType<typeof vi.fn>;
const mockSaveCallSession = saveCallSession as ReturnType<typeof vi.fn>;
const mockSaveTask = saveTask as ReturnType<typeof vi.fn>;
const mockSaveProvider = saveProvider as ReturnType<typeof vi.fn>;
const mockSaveContact = saveContact as ReturnType<typeof vi.fn>;
const mockSaveServiceTicket = saveServiceTicket as ReturnType<typeof vi.fn>;
const mockSaveWorkItem = saveWorkItem as ReturnType<typeof vi.fn>;

describe("mockDataService", () => {
  const mockUser = {
    id: "test-user-1",
    companyId: "test-company",
    email: "test@loadpilot.com",
    name: "Test User",
    role: "admin" as const,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("seedMockData", () => {
    it("is defined and callable", () => {
      expect(typeof seedMockData).toBe("function");
    });

    // In production builds, seedMockData is a no-op
    // In dev builds (vitest = dev), it seeds mock data
    it("calls save functions to seed data in dev mode", async () => {
      await seedMockData(mockUser);

      // Providers: 3 mock providers
      expect(mockSaveProvider).toHaveBeenCalledTimes(3);
      expect(mockSaveProvider).toHaveBeenCalledWith(
        expect.objectContaining({ id: "P-9901", name: "Titan Logistics Group" }),
      );
      expect(mockSaveProvider).toHaveBeenCalledWith(
        expect.objectContaining({ id: "P-9902", type: "Carrier" }),
      );
      expect(mockSaveProvider).toHaveBeenCalledWith(
        expect.objectContaining({ id: "P-9904", type: "Roadside" }),
      );

      // Contacts: 1 mock contact
      expect(mockSaveContact).toHaveBeenCalledTimes(1);
      expect(mockSaveContact).toHaveBeenCalledWith(
        expect.objectContaining({ id: "C-801", name: "Sarah Miller" }),
      );

      // Loads: 1 mock load
      expect(mockSaveLoad).toHaveBeenCalledTimes(1);
      expect(mockSaveLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "LD-8801",
          loadNumber: "KCI-8801",
          status: "in_transit",
        }),
        mockUser,
      );

      // Incidents: 1 mock incident
      expect(mockSaveIncident).toHaveBeenCalledTimes(1);
      expect(mockSaveIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "INC-7701",
          loadId: "LD-8801",
          type: "Breakdown",
          severity: "Critical",
        }),
      );

      // Requests: 1 mock request
      expect(mockSaveRequest).toHaveBeenCalledTimes(1);
      expect(mockSaveRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "REQ-5501",
          type: "TOW",
          status: "PENDING_APPROVAL",
        }),
      );

      // Service tickets: 1 mock ticket
      expect(mockSaveServiceTicket).toHaveBeenCalledTimes(1);
      expect(mockSaveServiceTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "TKT-9901",
          unitId: "TRL-405",
          type: "DOT_Corrective",
        }),
      );

      // Tasks: 1 mock task
      expect(mockSaveTask).toHaveBeenCalledTimes(1);
      expect(mockSaveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "TSK-2201",
          title: "Verify HOS Compliance: Elena",
          priority: "CRITICAL",
        }),
      );

      // Work items: 1 mock work item
      expect(mockSaveWorkItem).toHaveBeenCalledTimes(1);
      expect(mockSaveWorkItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "WI-7001",
          type: "Detention_Review",
        }),
      );

      // Call sessions: 1 mock session
      expect(mockSaveCallSession).toHaveBeenCalledTimes(1);
      expect(mockSaveCallSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "CS-4401",
          status: "ACTIVE",
          team: "SAFETY",
        }),
      );
    });

    it("uses the provided user ID for task assignment", async () => {
      await seedMockData(mockUser);

      expect(mockSaveTask).toHaveBeenCalledWith(
        expect.objectContaining({
          assignedToUserIds: [mockUser.id],
        }),
      );
    });

    it("creates incident with timeline entries", async () => {
      await seedMockData(mockUser);

      const incidentArg = mockSaveIncident.mock.calls[0][0];
      expect(incidentArg.timeline).toHaveLength(2);
      expect(incidentArg.timeline[0].action).toBe("ALERT_TRIGGERED");
      expect(incidentArg.timeline[1].action).toBe("STATUS_UPDATE");
    });

    it("creates load with telemetry data", async () => {
      await seedMockData(mockUser);

      const loadArg = mockSaveLoad.mock.calls[0][0];
      expect(loadArg.telemetry).toHaveLength(3);
      expect(loadArg.telemetry[0].event).toBe("ENGINE_FAULT");
    });

    it("creates request with links to load", async () => {
      await seedMockData(mockUser);

      const requestArg = mockSaveRequest.mock.calls[0][0];
      expect(requestArg.links).toHaveLength(1);
      expect(requestArg.links[0].entityType).toBe("LOAD");
      expect(requestArg.links[0].entityId).toBe("LD-8801");
      expect(requestArg.links[0].isPrimary).toBe(true);
    });

    it("does not throw when called", async () => {
      await expect(seedMockData(mockUser)).resolves.not.toThrow();
    });
  });
});
