import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for bidirectional exception-domain sync:
 * - Exception RESOLVED/CLOSED -> domain record status update
 * - Domain record status change -> linked exception status update
 * - Tenant isolation on all sync paths
 */

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "firebase-uid-1" }),
  };
  const mockFirestore = {
    collection: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            empty: false,
            docs: [
              {
                id: "user-1",
                data: () => ({
                  id: "user-1",
                  company_id: "company-aaa",
                  role: "dispatcher",
                  email: "test@test.com",
                }),
              },
            ],
          }),
        }),
      }),
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
      firestore: () => mockFirestore,
    },
  };
});

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import exceptionsRouter from "../../routes/exceptions";
import incidentsRouter from "../../routes/incidents";
import serviceTicketsRouter from "../../routes/service-tickets";
import safetyRouter from "../../routes/safety";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

function buildExceptionsApp() {
  const app = express();
  app.use(express.json());
  app.use(exceptionsRouter);
  app.use(errorHandler);
  return app;
}

function buildIncidentsApp() {
  const app = express();
  app.use(express.json());
  app.use(incidentsRouter);
  app.use(errorHandler);
  return app;
}

function buildServiceTicketsApp() {
  const app = express();
  app.use(express.json());
  app.use(serviceTicketsRouter);
  app.use(errorHandler);
  return app;
}

function buildSafetyApp() {
  const app = express();
  app.use(express.json());
  app.use(safetyRouter);
  app.use(errorHandler);
  return app;
}

const makeException = (overrides = {}) => ({
  id: "ex-001",
  tenant_id: "company-aaa",
  type: "INCIDENT_GENERAL",
  status: "OPEN",
  severity: 2,
  entity_type: "LOAD",
  entity_id: "load-001",
  owner_user_id: "user-1",
  team: "dispatch",
  sla_due_at: null,
  workflow_step: "triage",
  financial_impact_est: 0,
  description: "Test exception",
  links: JSON.stringify({ incidentId: "inc-001" }),
  ...overrides,
});

// ── Forward sync: Exception -> Domain ──────────────────────────────────────

describe("Exception -> Domain sync (forward)", () => {
  let app: ReturnType<typeof buildExceptionsApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildExceptionsApp();
  });

  it("resolving exception with incidentId link updates the incident status", async () => {
    const existing = makeException({
      links: JSON.stringify({ incidentId: "inc-001" }),
    });
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT existing exception
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    // syncExceptionToDomain queries:
    mockQuery.mockResolvedValueOnce([
      [{ links: JSON.stringify({ incidentId: "inc-001" }), entity_type: "LOAD", entity_id: "load-001" }],
      [],
    ]); // SELECT exception for sync
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE incidents
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT exception_events

    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "RESOLVED", actorName: "dispatch" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Exception updated");

    // Verify the UPDATE incidents query was called with correct params
    const updateIncidentCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE incidents SET status"),
    );
    expect(updateIncidentCall).toBeDefined();
    expect(updateIncidentCall![1]).toContain("Resolved");
    expect(updateIncidentCall![1]).toContain("inc-001");
    expect(updateIncidentCall![1]).toContain("company-aaa");
  });

  it("resolving exception with serviceTicketId link updates the service ticket status", async () => {
    const existing = makeException({
      links: JSON.stringify({ serviceTicketId: "st-001" }),
    });
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT existing
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    mockQuery.mockResolvedValueOnce([
      [{ links: JSON.stringify({ serviceTicketId: "st-001" }), entity_type: "TRUCK", entity_id: "truck-001" }],
      [],
    ]); // SELECT for sync
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE service_tickets
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT event

    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "RESOLVED", actorName: "dispatch" });

    expect(res.status).toBe(200);

    const updateTicketCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE service_tickets SET status"),
    );
    expect(updateTicketCall).toBeDefined();
    expect(updateTicketCall![1]).toContain("Resolved");
    expect(updateTicketCall![1]).toContain("st-001");
  });

  it("resolving exception with maintenanceRecordId link updates the maintenance record", async () => {
    const existing = makeException({
      links: JSON.stringify({ maintenanceRecordId: "mnt-001" }),
    });
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT existing
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    mockQuery.mockResolvedValueOnce([
      [{ links: JSON.stringify({ maintenanceRecordId: "mnt-001" }), entity_type: "TRUCK", entity_id: "truck-001" }],
      [],
    ]); // SELECT for sync
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE safety_maintenance
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT event

    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "CLOSED", actorName: "admin" });

    expect(res.status).toBe(200);

    const updateMaintenanceCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE safety_maintenance SET status"),
    );
    expect(updateMaintenanceCall).toBeDefined();
    expect(updateMaintenanceCall![1]).toContain("Closed");
    expect(updateMaintenanceCall![1]).toContain("mnt-001");
  });

  it("does NOT trigger domain sync for non-terminal statuses", async () => {
    const existing = makeException({
      links: JSON.stringify({ incidentId: "inc-001" }),
    });
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT existing
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT event

    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "IN_PROGRESS", actorName: "dispatch" });

    expect(res.status).toBe(200);

    // No UPDATE incidents call should exist
    const updateIncidentCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE incidents SET status"),
    );
    expect(updateIncidentCall).toBeUndefined();
  });

  it("forward sync failure does not block exception update", async () => {
    const existing = makeException({
      links: JSON.stringify({ incidentId: "inc-001" }),
    });
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT existing
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    // syncExceptionToDomain fails
    mockQuery.mockRejectedValueOnce(new Error("DB connection lost"));
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT event

    const res = await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "RESOLVED", actorName: "dispatch" });

    // The response should still be 200 because sync is best-effort
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Exception updated");
  });

  it("tenant isolation: sync uses tenant_id from auth context", async () => {
    const existing = makeException({
      links: JSON.stringify({ incidentId: "inc-001" }),
    });
    mockQuery.mockResolvedValueOnce([[existing], []]); // SELECT
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    mockQuery.mockResolvedValueOnce([
      [{ links: JSON.stringify({ incidentId: "inc-001" }), entity_type: "LOAD", entity_id: "load-001" }],
      [],
    ]); // SELECT for sync
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE incidents
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT event

    await request(app)
      .patch("/api/exceptions/ex-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "RESOLVED", actorName: "dispatch" });

    // Verify tenant_id is passed in all sync queries
    const syncSelectCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("SELECT links") &&
        call[0].includes("tenant_id"),
    );
    expect(syncSelectCall).toBeDefined();
    expect(syncSelectCall![1]).toContain("company-aaa");
  });
});

// ── Reverse sync: Domain -> Exception ──────────────────────────────────────

describe("Incident -> Exception reverse sync", () => {
  let app: ReturnType<typeof buildIncidentsApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildIncidentsApp();
  });

  it("PATCH /api/incidents/:id with status Resolved updates linked exception", async () => {
    // findById returns existing incident
    const existingIncident = {
      id: "inc-001",
      company_id: "company-aaa",
      load_id: "load-001",
      type: "Safety",
      severity: "High",
      status: "Open",
      description: "Test incident",
    };
    mockQuery.mockResolvedValueOnce([[existingIncident], []]); // findById SELECT
    // update query
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE
    mockQuery.mockResolvedValueOnce([[{ ...existingIncident, status: "Resolved" }], []]); // findById for return
    // syncDomainToException queries:
    mockQuery.mockResolvedValueOnce([
      [{ id: "ex-001", status: "OPEN" }],
      [],
    ]); // SELECT exception by JSON link
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT exception_events

    const res = await request(app)
      .patch("/api/incidents/inc-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Resolved" });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Incident updated");

    // Verify exception was updated
    const updateExceptionCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE exceptions SET status"),
    );
    expect(updateExceptionCall).toBeDefined();
    expect(updateExceptionCall![1]).toContain("RESOLVED");
  });

  it("PATCH /api/incidents/:id returns 404 for non-existent incident", async () => {
    mockQuery.mockResolvedValueOnce([[], []]); // findById returns empty

    const res = await request(app)
      .patch("/api/incidents/nonexistent")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Resolved" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Incident not found");
  });

  it("PATCH /api/incidents/:id does not trigger sync for non-status changes", async () => {
    const existingIncident = {
      id: "inc-001",
      company_id: "company-aaa",
      load_id: "load-001",
      type: "Safety",
      severity: "High",
      status: "Open",
      description: "Test incident",
    };
    mockQuery.mockResolvedValueOnce([[existingIncident], []]); // findById
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE
    mockQuery.mockResolvedValueOnce([[{ ...existingIncident, description: "Updated" }], []]); // findById return

    const res = await request(app)
      .patch("/api/incidents/inc-001")
      .set("Authorization", AUTH_HEADER)
      .send({ description: "Updated description" });

    expect(res.status).toBe(200);

    // No exception update should have been called
    const updateExceptionCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE exceptions SET status"),
    );
    expect(updateExceptionCall).toBeUndefined();
  });
});

describe("Service Ticket -> Exception reverse sync", () => {
  let app: ReturnType<typeof buildServiceTicketsApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildServiceTicketsApp();
  });

  it("PATCH /api/service-tickets/:id with status Closed updates linked exception", async () => {
    const existingTicket = {
      id: "st-001",
      company_id: "company-aaa",
      type: "Repair",
      status: "Open",
      description: "Brake repair",
      locked_at: null,
    };
    // findById for existing check
    mockQuery.mockResolvedValueOnce([[existingTicket], []]);
    // buildSafeUpdate + UPDATE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // findById for return
    mockQuery.mockResolvedValueOnce([[{ ...existingTicket, status: "Closed" }], []]);
    // syncDomainToException queries:
    mockQuery.mockResolvedValueOnce([
      [{ id: "ex-002", status: "OPEN" }],
      [],
    ]); // SELECT exception by JSON link
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT exception_events

    const res = await request(app)
      .patch("/api/service-tickets/st-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Closed" });

    expect(res.status).toBe(200);

    const updateExceptionCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE exceptions SET status"),
    );
    expect(updateExceptionCall).toBeDefined();
    expect(updateExceptionCall![1]).toContain("RESOLVED");
  });
});

describe("Maintenance -> Exception reverse sync", () => {
  let app: ReturnType<typeof buildSafetyApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
    app = buildSafetyApp();
  });

  it("PATCH /api/safety/maintenance/:id with status Completed updates linked exception", async () => {
    const existingMaint = {
      id: "mnt-001",
      company_id: "company-aaa",
      vehicle_id: "truck-001",
      type: "Oil Change",
      status: "Scheduled",
      description: "Regular service",
    };
    // SELECT existing
    mockQuery.mockResolvedValueOnce([[existingMaint], []]);
    // UPDATE safety_maintenance
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // syncDomainToException queries:
    mockQuery.mockResolvedValueOnce([
      [{ id: "ex-003", status: "OPEN" }],
      [],
    ]); // SELECT exception by JSON link
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE exception
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]); // INSERT exception_events
    // SELECT updated record
    mockQuery.mockResolvedValueOnce([[{ ...existingMaint, status: "Completed" }], []]);

    const res = await request(app)
      .patch("/api/safety/maintenance/mnt-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Completed" });

    expect(res.status).toBe(200);

    const updateExceptionCall = mockQuery.mock.calls.find(
      (call) =>
        typeof call[0] === "string" &&
        call[0].includes("UPDATE exceptions SET status"),
    );
    expect(updateExceptionCall).toBeDefined();
    expect(updateExceptionCall![1]).toContain("RESOLVED");
  });

  it("PATCH /api/safety/maintenance/:id returns 404 for non-existent record", async () => {
    mockQuery.mockResolvedValueOnce([[], []]); // SELECT returns empty

    const res = await request(app)
      .patch("/api/safety/maintenance/nonexistent")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Completed" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Maintenance record not found");
  });

  it("PATCH /api/safety/maintenance/:id returns 400 for empty body", async () => {
    const existingMaint = {
      id: "mnt-001",
      company_id: "company-aaa",
      vehicle_id: "truck-001",
      type: "Oil Change",
      status: "Scheduled",
    };
    mockQuery.mockResolvedValueOnce([[existingMaint], []]);

    const res = await request(app)
      .patch("/api/safety/maintenance/mnt-001")
      .set("Authorization", AUTH_HEADER)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("No valid fields to update");
  });

  it("PATCH /api/safety/maintenance/:id enforces tenant isolation", async () => {
    // Record belongs to different tenant
    mockQuery.mockResolvedValueOnce([[], []]); // SELECT with company_id filter returns empty

    const res = await request(app)
      .patch("/api/safety/maintenance/mnt-001")
      .set("Authorization", AUTH_HEADER)
      .send({ status: "Completed" });

    expect(res.status).toBe(404);
  });
});
