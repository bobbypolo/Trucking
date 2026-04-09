/**
 * Tests R-P1-04, R-P1-05, R-P1-08, R-P1-09: IFTA Audit Packets routes.
 *
 * Validates `server/routes/ifta-audit-packets.ts`:
 *  - POST returns 201 with packetId, status:"generated", 64-char packetHash, downloadUrl
 *  - POST with invalid quarter returns 400 with "quarter" in the error message
 *  - POST /:packetId/verify returns 200 {verified:true} when bytes match the saved hash
 *  - POST /:packetId/verify returns 409 {error:"HASH_MISMATCH"} when bytes are modified
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockResolveSqlPrincipalByFirebaseUid: vi.fn(),
}));

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    getConnection: vi.fn(),
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
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("firebase-admin", () => {
  const mockAuth = {
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: "firebase-uid-1",
      email_verified: true,
    }),
  };
  return {
    default: {
      app: vi.fn(),
      auth: () => mockAuth,
    },
  };
});

vi.mock("../../lib/token-revocation", () => ({
  isTokenRevoked: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../lib/sql-auth", () => ({
  resolveSqlPrincipalByFirebaseUid: mockResolveSqlPrincipalByFirebaseUid,
}));

import express from "express";
import request from "supertest";
import iftaAuditPacketsRouter from "../../routes/ifta-audit-packets";
import { errorHandler } from "../../middleware/errorHandler";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";
import {
  bundleAuditPacket,
  computePacketHash,
} from "../../services/ifta-audit-packet.service";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(iftaAuditPacketsRouter);
  app.use(errorHandler);
  return app;
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("POST /api/accounting/ifta-audit-packets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P1-04 — returns 201 with packetId, status, 64-char packetHash, and downloadUrl", async () => {
    // Mock company name lookup
    mockQuery.mockResolvedValueOnce([[{ name: "Acme Trucking LLC" }]]);
    // Mock jurisdiction rows
    mockQuery.mockResolvedValueOnce([
      [{ state_code: "TX", total_miles: 5000, total_gallons: 800 }],
    ]);
    // Mock fuel ledger rows
    mockQuery.mockResolvedValueOnce([
      [
        {
          vendor_name: "Loves",
          transaction_date: "2025-10-15",
          state_code: "TX",
          gallons: 100,
          price_per_gallon: 3.5,
          total_cost: 350,
        },
      ],
    ]);
    // Mock INSERT
    mockQuery.mockResolvedValueOnce([{ insertId: 1 }]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/ifta-audit-packets")
      .set(AUTH_HEADER)
      .send({ quarter: 4, taxYear: 2025, includeDocuments: true });

    expect(res.status).toBe(201);
    expect(res.body.packetId).toBeDefined();
    expect(typeof res.body.packetId).toBe("string");
    expect(res.body.packetId.length).toBeGreaterThan(0);
    expect(res.body.status).toBe("generated");
    expect(res.body.packetHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.downloadUrl).toBeDefined();
    expect(typeof res.body.downloadUrl).toBe("string");
    expect(res.body.downloadUrl.length).toBeGreaterThan(0);
  });

  it('Tests R-P1-05 — returns 400 with "quarter" in error message for invalid quarter', async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/ifta-audit-packets")
      .set(AUTH_HEADER)
      .send({ quarter: 5, taxYear: 2025 });

    expect(res.status).toBe(400);
    // Error message must contain the field name "quarter".
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).toContain("quarter");
  });

  it("Tests R-P1-05 — returns 400 with quarter field for negative quarter", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/ifta-audit-packets")
      .set(AUTH_HEADER)
      .send({ quarter: 0, taxYear: 2025 });

    expect(res.status).toBe(400);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).toContain("quarter");
  });
});

describe("POST /api/accounting/ifta-audit-packets/:packetId/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("Tests R-P1-08 — returns 200 {verified:true} when stored bytes match saved hash", async () => {
    // Build a real packet so we have real bytes + a real hash to mock.
    const packetBytes = await bundleAuditPacket({
      companyId: "company-aaa",
      companyName: "Acme Trucking LLC",
      quarter: 4,
      taxYear: 2025,
      jurisdictionRows: [
        {
          stateCode: "TX",
          totalMiles: 1,
          totalGallons: 1,
          taxRate: 1,
          taxDue: 1,
        },
      ],
      fuelLedgerRows: [],
      generatedAt: "2025-12-31T00:00:00.000Z",
    });
    const realHash = computePacketHash(packetBytes);

    // Mock SELECT row from ifta_audit_packets
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "pkt-001",
          company_id: "company-aaa",
          packet_hash: realHash,
          packet_bytes: packetBytes,
        },
      ],
    ]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/ifta-audit-packets/pkt-001/verify")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
    expect(res.body.packetHash).toBe(realHash);
  });

  it("Tests R-P1-09 — returns 409 {error:'HASH_MISMATCH'} when stored bytes are modified", async () => {
    const packetBytes = await bundleAuditPacket({
      companyId: "company-aaa",
      companyName: "Acme Trucking LLC",
      quarter: 4,
      taxYear: 2025,
      jurisdictionRows: [
        {
          stateCode: "TX",
          totalMiles: 1,
          totalGallons: 1,
          taxRate: 1,
          taxDue: 1,
        },
      ],
      fuelLedgerRows: [],
      generatedAt: "2025-12-31T00:00:00.000Z",
    });
    const realHash = computePacketHash(packetBytes);

    // Tamper with the packet bytes — corrupt one byte in the middle.
    const tampered = Buffer.from(packetBytes);
    tampered[Math.floor(tampered.length / 2)] ^= 0xff;

    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "pkt-002",
          company_id: "company-aaa",
          packet_hash: realHash,
          packet_bytes: tampered,
        },
      ],
    ]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/ifta-audit-packets/pkt-002/verify")
      .set(AUTH_HEADER);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("HASH_MISMATCH");
  });

  it("Tests R-P1-09 — returns 404 when packet does not exist", async () => {
    mockQuery.mockResolvedValueOnce([[]]);

    const app = buildApp();
    const res = await request(app)
      .post("/api/accounting/ifta-audit-packets/missing-id/verify")
      .set(AUTH_HEADER);

    expect(res.status).toBe(404);
  });
});

describe("GET /api/accounting/ifta-audit-packets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 200 with packets array", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "pkt-1",
          company_id: "company-aaa",
          quarter: 4,
          tax_year: 2025,
          status: "generated",
          packet_hash: "a".repeat(64),
          download_url: "/api/accounting/ifta-audit-packets/pkt-1/download",
          created_by: "user-1",
          created_at: "2025-12-31T00:00:00.000Z",
        },
      ],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/accounting/ifta-audit-packets")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.packets)).toBe(true);
    expect(res.body.packets.length).toBe(1);
    expect(res.body.packets[0].packetId).toBe("pkt-1");
  });
});

describe("GET /api/accounting/ifta-audit-packets/:packetId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns 200 with the packet shape", async () => {
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "pkt-9",
          company_id: "company-aaa",
          quarter: 4,
          tax_year: 2025,
          status: "generated",
          packet_hash: "b".repeat(64),
          download_url: "/api/accounting/ifta-audit-packets/pkt-9/download",
          created_by: "user-1",
          created_at: "2025-12-31T00:00:00.000Z",
        },
      ],
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/api/accounting/ifta-audit-packets/pkt-9")
      .set(AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.packetId).toBe("pkt-9");
    expect(res.body.quarter).toBe(4);
    expect(res.body.taxYear).toBe(2025);
    expect(res.body.status).toBe("generated");
    expect(res.body.packetHash).toBe("b".repeat(64));
    expect(res.body.downloadUrl).toBeDefined();
  });
});
