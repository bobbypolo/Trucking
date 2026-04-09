/**
 * Tests R-P1-11: financialService — IFTA Audit Packet client methods.
 *
 * Validates `services/financialService.ts`:
 *  - Exports the 4 packet methods: generateIftaAuditPacket, listIftaAuditPackets,
 *    getIftaAuditPacket, verifyIftaAuditPacket
 *  - Each hits the documented backend route via api.* helpers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../../services/authService", () => ({
  getIdTokenAsync: vi.fn().mockResolvedValue("mock-jwt-token"),
  forceRefreshToken: vi.fn().mockResolvedValue("refreshed-jwt-token"),
}));

import {
  generateIftaAuditPacket,
  listIftaAuditPackets,
  getIftaAuditPacket,
  verifyIftaAuditPacket,
} from "../../../services/financialService";

const okJson = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

const created = (data: unknown) =>
  ({
    ok: true,
    status: 201,
    json: () => Promise.resolve(data),
  }) as unknown as Response;

describe("financialService — IFTA Audit Packet client methods", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── R-P1-11: function existence ────────────────────────────────────

  it("Tests R-P1-11 — exports generateIftaAuditPacket as a function", () => {
    expect(typeof generateIftaAuditPacket).toBe("function");
  });

  it("Tests R-P1-11 — exports listIftaAuditPackets as a function", () => {
    expect(typeof listIftaAuditPackets).toBe("function");
  });

  it("Tests R-P1-11 — exports getIftaAuditPacket as a function", () => {
    expect(typeof getIftaAuditPacket).toBe("function");
  });

  it("Tests R-P1-11 — exports verifyIftaAuditPacket as a function", () => {
    expect(typeof verifyIftaAuditPacket).toBe("function");
  });

  // ─── Routes hit by each method ──────────────────────────────────────

  it("generateIftaAuditPacket POSTs to /accounting/ifta-audit-packets and returns the packet", async () => {
    const fakeResponse = {
      packetId: "pkt-1",
      status: "generated",
      packetHash: "a".repeat(64),
      downloadUrl: "/api/accounting/ifta-audit-packets/pkt-1/download",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(created(fakeResponse));

    const result = await generateIftaAuditPacket({
      quarter: 4,
      taxYear: 2025,
      includeDocuments: true,
    });

    expect(result.packetId).toBe("pkt-1");
    expect(result.status).toBe("generated");
    expect(result.packetHash).toBe("a".repeat(64));

    const fetchCall = (globalThis.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain("/accounting/ifta-audit-packets");
    expect(fetchCall[1].method).toBe("POST");
    const sentBody = JSON.parse(fetchCall[1].body as string);
    expect(sentBody.quarter).toBe(4);
    expect(sentBody.taxYear).toBe(2025);
    expect(sentBody.includeDocuments).toBe(true);
  });

  it("listIftaAuditPackets GETs /accounting/ifta-audit-packets and returns the array", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okJson({ packets: [{ packetId: "pkt-1" }, { packetId: "pkt-2" }] }),
    );

    const packets = await listIftaAuditPackets();
    expect(packets.length).toBe(2);
    expect(packets[0].packetId).toBe("pkt-1");
    expect(packets[1].packetId).toBe("pkt-2");

    const fetchCall = (globalThis.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain("/accounting/ifta-audit-packets");
    expect(fetchCall[1].method).toBe("GET");
  });

  it("getIftaAuditPacket GETs /accounting/ifta-audit-packets/:id and returns the packet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okJson({
        packetId: "pkt-9",
        quarter: 4,
        taxYear: 2025,
        status: "generated",
        packetHash: "b".repeat(64),
        downloadUrl: "/api/accounting/ifta-audit-packets/pkt-9/download",
      }),
    );

    const packet = await getIftaAuditPacket("pkt-9");
    expect(packet.packetId).toBe("pkt-9");
    expect(packet.quarter).toBe(4);

    const fetchCall = (globalThis.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain("/accounting/ifta-audit-packets/pkt-9");
    expect(fetchCall[1].method).toBe("GET");
  });

  it("verifyIftaAuditPacket POSTs to /accounting/ifta-audit-packets/:id/verify and returns verification result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      okJson({
        verified: true,
        packetId: "pkt-9",
        packetHash: "b".repeat(64),
      }),
    );

    const result = await verifyIftaAuditPacket("pkt-9");
    expect(result.verified).toBe(true);
    expect(result.packetHash).toBe("b".repeat(64));

    const fetchCall = (globalThis.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain(
      "/accounting/ifta-audit-packets/pkt-9/verify",
    );
    expect(fetchCall[1].method).toBe("POST");
  });
});
