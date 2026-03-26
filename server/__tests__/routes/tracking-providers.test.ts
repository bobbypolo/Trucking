import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Tests R-P3-WP1-01 through R-P3-WP1-08

const { mockQuery, mockResolveSqlPrincipalByFirebaseUid } = vi.hoisted(() => {
  const mockQuery = vi.fn();
  return { mockQuery, mockResolveSqlPrincipalByFirebaseUid: vi.fn() };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
  },
}));

// Mock firebase-admin for requireAuth
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
                  role: "admin",
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

// Mock requireTier to pass-through
vi.mock("../../middleware/requireTier", () => ({
  requireTier: () => (_req: any, _res: any, next: any) => next(),
}));

// Mock GPS provider factory — provider tests do not exercise GPS polling
vi.mock("../../services/gps", () => ({
  getGpsProvider: () => ({
    getVehicleLocations: vi.fn().mockResolvedValue([]),
  }),
  getGpsProviderForTenant: vi.fn().mockResolvedValue({
    provider: null,
    state: "not-configured",
  }),
}));

import trackingRouter from "../../routes/tracking";
import { DEFAULT_SQL_PRINCIPAL } from "../helpers/mock-sql-auth";

mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(DEFAULT_SQL_PRINCIPAL);

const AUTH_HEADER = "Bearer valid-firebase-token";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(trackingRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Helper fixtures
// ---------------------------------------------------------------------------

const PROVIDER_CONFIG_ROW = {
  id: "cfg-001",
  provider_name: "samsara",
  is_active: 1,
  created_at: "2026-03-24T00:00:00.000Z",
  has_api_token: 1,
  has_webhook_url: 0,
};

const MAPPING_ROW = {
  id: "map-001",
  vehicle_id: "truck-1",
  provider_config_id: "cfg-001",
  provider_vehicle_id: "sv-truck-1",
  provider_name: "samsara",
};

// ---------------------------------------------------------------------------
// R-P3-WP1-01: Creating a provider config
// ---------------------------------------------------------------------------
describe("R-P3-WP1-01: POST /api/tracking/providers — create provider config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("creates a provider config and returns safe fields (no secret)", async () => {
    // INSERT (upsert)
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // SELECT after upsert
    mockQuery.mockResolvedValueOnce([[PROVIDER_CONFIG_ROW], []]);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER)
      .send({
        providerName: "samsara",
        apiToken: "secret-token",
        isActive: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("cfg-001");
    expect(res.body.providerName).toBe("samsara");
    expect(res.body.isActive).toBe(true);
    // API token must NOT appear in response
    expect(res.body.apiToken).toBeUndefined();
    expect(res.body.api_token).toBeUndefined();
  });

  it("returns 400 when providerName is missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER)
      .send({ isActive: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/providerName/);
  });

  it("returns 401 without auth", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers")
      .send({ providerName: "samsara", isActive: true });

    expect(res.status).toBe(401);
  });

  it("returns 403 for driver role", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER)
      .send({ providerName: "samsara", isActive: true });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// R-P3-WP1-02: Listing provider configs — no secrets returned
// ---------------------------------------------------------------------------
describe("R-P3-WP1-02: GET /api/tracking/providers — list configs, no secrets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns list of provider configs with hasApiToken boolean (not the token itself)", async () => {
    mockQuery.mockResolvedValueOnce([[PROVIDER_CONFIG_ROW], []]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const cfg = res.body[0];
    expect(cfg.id).toBe("cfg-001");
    expect(cfg.providerName).toBe("samsara");
    expect(cfg.isActive).toBe(true);
    expect(cfg.hasApiToken).toBe(true);
    expect(cfg.hasWebhookUrl).toBe(false);

    // Secrets must never appear
    expect(cfg.apiToken).toBeUndefined();
    expect(cfg.api_token).toBeUndefined();
    expect(cfg.webhookSecret).toBeUndefined();
  });

  it("returns empty array when tenant has no configs", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const app = createApp();
    const res = await request(app).get("/api/tracking/providers");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// R-P3-WP1-03: Deleting a provider config
// ---------------------------------------------------------------------------
describe("R-P3-WP1-03: DELETE /api/tracking/providers/:id — delete config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("deletes a config that belongs to the tenant", async () => {
    // SELECT ownership check
    mockQuery.mockResolvedValueOnce([[{ id: "cfg-001" }], []]);
    // DELETE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/providers/cfg-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Provider config deleted");
  });

  it("returns 404 for config that does not belong to tenant", async () => {
    // Ownership check returns empty
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/providers/cfg-other")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("returns 403 for dispatcher role", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "dispatcher",
    });

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/providers/cfg-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// R-P3-WP1-04: Testing provider connection
// ---------------------------------------------------------------------------
describe("R-P3-WP1-04: POST /api/tracking/providers/:id/test — connection test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns no_credentials when provider has no API token", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "cfg-001", provider_name: "samsara", api_token: null }],
      [],
    ]);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers/cfg-001/test")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("no_credentials");
  });

  it("returns 404 for config not belonging to tenant", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers/cfg-other/test")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("returns 403 for driver role", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers/cfg-001/test")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(403);
  });

  it("returns success when provider API responds 200", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "cfg-001", provider_name: "samsara", api_token: "valid-tok" }],
      [],
    ]);

    // Mock global fetch to return 200
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers/cfg-001/test")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.message).toBe("Connection successful");
    expect(typeof res.body.latencyMs).toBe("number");

    vi.unstubAllGlobals();
  });

  it("returns failed when provider API responds 401", async () => {
    mockQuery.mockResolvedValueOnce([
      [{ id: "cfg-001", provider_name: "samsara", api_token: "bad-tok" }],
      [],
    ]);

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);
    vi.stubGlobal("fetch", mockFetch);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/providers/cfg-001/test")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.message).toMatch(/401/);

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// R-P3-WP1-05: Creating vehicle mapping
// ---------------------------------------------------------------------------
describe("R-P3-WP1-05: POST /api/tracking/vehicles/mapping — create mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("creates a vehicle mapping and returns it", async () => {
    // Verify provider config ownership
    mockQuery.mockResolvedValueOnce([[{ id: "cfg-001" }], []]);
    // INSERT
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // SELECT canonical row
    mockQuery.mockResolvedValueOnce([
      [
        {
          id: "map-001",
          vehicle_id: "truck-1",
          provider_config_id: "cfg-001",
          provider_vehicle_id: "sv-truck-1",
        },
      ],
      [],
    ]);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/vehicles/mapping")
      .set("Authorization", AUTH_HEADER)
      .send({
        vehicleId: "truck-1",
        providerConfigId: "cfg-001",
        providerVehicleId: "sv-truck-1",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe("map-001");
    expect(res.body.vehicleId).toBe("truck-1");
    expect(res.body.providerConfigId).toBe("cfg-001");
    expect(res.body.providerVehicleId).toBe("sv-truck-1");
  });

  it("returns 400 when required fields are missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/vehicles/mapping")
      .set("Authorization", AUTH_HEADER)
      .send({ vehicleId: "truck-1" }); // missing providerConfigId + providerVehicleId

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/providerConfigId/);
  });

  it("returns 404 when provider config does not belong to tenant", async () => {
    // Ownership check returns empty
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/vehicles/mapping")
      .set("Authorization", AUTH_HEADER)
      .send({
        vehicleId: "truck-1",
        providerConfigId: "cfg-other",
        providerVehicleId: "sv-truck-1",
      });

    expect(res.status).toBe(404);
  });

  it("returns 403 for driver role", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "driver",
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/tracking/vehicles/mapping")
      .set("Authorization", AUTH_HEADER)
      .send({
        vehicleId: "truck-1",
        providerConfigId: "cfg-001",
        providerVehicleId: "sv-truck-1",
      });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// R-P3-WP1-06: Listing vehicle mappings
// ---------------------------------------------------------------------------
describe("R-P3-WP1-06: GET /api/tracking/vehicles/mapping — list mappings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("returns list of vehicle mappings with providerName", async () => {
    mockQuery.mockResolvedValueOnce([[MAPPING_ROW], []]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/vehicles/mapping")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    const mapping = res.body[0];
    expect(mapping.id).toBe("map-001");
    expect(mapping.vehicleId).toBe("truck-1");
    expect(mapping.providerConfigId).toBe("cfg-001");
    expect(mapping.providerVehicleId).toBe("sv-truck-1");
    expect(mapping.providerName).toBe("samsara");
  });

  it("returns empty array when tenant has no mappings", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/vehicles/mapping")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const app = createApp();
    const res = await request(app).get("/api/tracking/vehicles/mapping");
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// R-P3-WP1-07: Deleting a vehicle mapping
// ---------------------------------------------------------------------------
describe("R-P3-WP1-07: DELETE /api/tracking/vehicles/mapping/:id — delete mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("deletes a mapping that belongs to the tenant", async () => {
    // Ownership check
    mockQuery.mockResolvedValueOnce([[{ id: "map-001" }], []]);
    // DELETE
    mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/vehicles/mapping/map-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Vehicle mapping deleted");
  });

  it("returns 404 for mapping not belonging to tenant", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/vehicles/mapping/map-other")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);
  });

  it("returns 403 for dispatcher role", async () => {
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue({
      ...DEFAULT_SQL_PRINCIPAL,
      role: "dispatcher",
    });

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/vehicles/mapping/map-001")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// R-P3-WP1-08: Tenant isolation — cannot see other tenant's configs
// ---------------------------------------------------------------------------
describe("R-P3-WP1-08: Tenant isolation — configs scoped to company", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveSqlPrincipalByFirebaseUid.mockResolvedValue(
      DEFAULT_SQL_PRINCIPAL,
    );
  });

  it("GET /api/tracking/providers only returns configs for the authenticated tenant", async () => {
    // Only company-aaa rows returned by DB (WHERE company_id = ?)
    mockQuery.mockResolvedValueOnce([[PROVIDER_CONFIG_ROW], []]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/providers")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);

    // Verify the SQL query used the tenant's company_id
    const sqlCall = mockQuery.mock.calls[0];
    expect(sqlCall[0]).toMatch(/WHERE company_id = \?/);
    expect(sqlCall[1]).toContain("company-aaa");
  });

  it("DELETE /api/tracking/providers/:id returns 404 for another tenant's config", async () => {
    // Ownership check: no row found for company-aaa + cfg-other
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/providers/cfg-other-tenant")
      .set("Authorization", AUTH_HEADER);

    // Must 404, not expose other tenant's data
    expect(res.status).toBe(404);

    // Verify ownership query used both id AND company_id
    const sqlCall = mockQuery.mock.calls[0];
    expect(sqlCall[0]).toMatch(/company_id = \?/);
    expect(sqlCall[1]).toContain("company-aaa");
    expect(sqlCall[1]).toContain("cfg-other-tenant");
  });

  it("DELETE /api/tracking/vehicles/mapping/:id returns 404 for another tenant's mapping", async () => {
    mockQuery.mockResolvedValueOnce([[], []]);

    const app = createApp();
    const res = await request(app)
      .delete("/api/tracking/vehicles/mapping/map-other-tenant")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(404);

    const sqlCall = mockQuery.mock.calls[0];
    expect(sqlCall[1]).toContain("company-aaa");
    expect(sqlCall[1]).toContain("map-other-tenant");
  });

  it("GET /api/tracking/vehicles/mapping only queries the authenticated tenant's data", async () => {
    mockQuery.mockResolvedValueOnce([[MAPPING_ROW], []]);

    const app = createApp();
    const res = await request(app)
      .get("/api/tracking/vehicles/mapping")
      .set("Authorization", AUTH_HEADER);

    expect(res.status).toBe(200);

    const sqlCall = mockQuery.mock.calls[0];
    expect(sqlCall[0]).toMatch(/WHERE m\.company_id = \?/);
    expect(sqlCall[1]).toContain("company-aaa");
  });
});
