import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests R-P2-07-AC2, R-P2-07-AC3

// --- Mock setup ---
const { mockQuery, mockExecute } = vi.hoisted(() => {
  return {
    mockQuery: vi.fn(),
    mockExecute: vi.fn(),
  };
});

vi.mock("../../db", () => ({
  default: {
    query: mockQuery,
    execute: mockExecute,
  },
}));

import {
  idempotencyMiddleware,
  computeRequestHash,
  IDEMPOTENCY_TTL_MS,
  parseIdempotencyKey,
} from "../../middleware/idempotency";
import { Request, Response, NextFunction } from "express";

// --- Helpers ---
function makeMockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    headers: {},
    method: "PATCH",
    path: "/api/loads/load-001/status",
    body: { status: "planned" },
    user: { id: "user-001", tenantId: "company-aaa" },
    ...overrides,
  } as unknown as Request;
}

function makeMockRes(): Response & {
  _status: number;
  _body: unknown;
  _headers: Record<string, string>;
} {
  const res: any = {
    _status: 200,
    _body: undefined,
    _headers: {} as Record<string, string>,
    statusCode: 200,
    status(code: number) {
      res._status = code;
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value;
      return res;
    },
    getHeader(key: string) {
      return res._headers[key];
    },
  };
  return res;
}

describe("R-P2-07: Idempotency Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC2: Idempotency key parsing and validation", () => {
    it("passes through when no Idempotency-Key header is present", async () => {
      const middleware = idempotencyMiddleware();
      const req = makeMockReq();
      const res = makeMockRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(next).toHaveBeenCalledWith(); // called without error
    });

    it("parses Idempotency-Key header in {actor_id}:{endpoint}:{entity_id}:{nonce} format", () => {
      const key = "user-001:/api/loads/load-001/status:load-001:abc123";
      const parsed = parseIdempotencyKey(key);

      expect(parsed).toEqual({
        actorId: "user-001",
        endpoint: "/api/loads/load-001/status",
        entityId: "load-001",
        nonce: "abc123",
      });
    });

    it("returns null for invalid key format (fewer than 4 parts)", () => {
      expect(parseIdempotencyKey("invalid-key")).toBeNull();
      expect(parseIdempotencyKey("a:b:c")).toBeNull();
      expect(parseIdempotencyKey("")).toBeNull();
    });
  });

  describe("AC2: Same key + same hash = replay stored response", () => {
    it("replays stored response when idempotency key matches with same request hash", async () => {
      const middleware = idempotencyMiddleware();
      const body = { status: "planned" };
      const hash = computeRequestHash(body);

      const req = makeMockReq({
        headers: {
          "idempotency-key":
            "user-001:/api/loads/load-001/status:load-001:nonce-1",
        },
        body,
      });
      const res = makeMockRes();
      const next = vi.fn();

      // Mock: existing idempotency record found with matching hash
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "idem-001",
            idempotency_key:
              "user-001:/api/loads/load-001/status:load-001:nonce-1",
            request_hash: hash,
            response_status: 200,
            response_body: JSON.stringify({
              id: "load-001",
              status: "planned",
            }),
            expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
          },
        ],
        [],
      ]);

      await middleware(req, res, next);

      // Should NOT call next — replays the stored response
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ id: "load-001", status: "planned" });
    });
  });

  describe("AC2: Same key + different hash = 422 BusinessRuleError", () => {
    it("returns 422 when idempotency key matches but request hash differs", async () => {
      const middleware = idempotencyMiddleware();
      const body = { status: "planned" };

      const req = makeMockReq({
        headers: {
          "idempotency-key":
            "user-001:/api/loads/load-001/status:load-001:nonce-1",
        },
        body,
      });
      const res = makeMockRes();
      const next = vi.fn();

      // Mock: existing idempotency record with DIFFERENT hash
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "idem-001",
            idempotency_key:
              "user-001:/api/loads/load-001/status:load-001:nonce-1",
            request_hash: "different-hash-value",
            response_status: 200,
            response_body: JSON.stringify({ old: "response" }),
            expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
          },
        ],
        [],
      ]);

      await middleware(req, res, next);

      // Should return 422 and NOT call next
      expect(next).not.toHaveBeenCalled();
      expect(res._status).toBe(422);
      expect(res._body).toMatchObject({
        error_code: "IDEMPOTENCY_HASH_MISMATCH",
      });
    });
  });

  describe("AC2: New key — stores response after handler completes", () => {
    it("stores the response in idempotency_keys table after successful handler", async () => {
      const middleware = idempotencyMiddleware();
      const body = { status: "planned" };
      const hash = computeRequestHash(body);

      const req = makeMockReq({
        headers: {
          "idempotency-key":
            "user-001:/api/loads/load-001/status:load-001:nonce-2",
        },
        body,
      });
      const res = makeMockRes();

      // Mock: no existing record
      mockQuery.mockResolvedValueOnce([[], []]);
      // Mock: INSERT succeeds
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      // Simulate handler completing via next
      const next = vi.fn().mockImplementation(() => {
        res.status(200).json({ id: "load-001", status: "planned" });
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      // INSERT should have been called with the response data
      expect(mockExecute).toHaveBeenCalledOnce();
      const insertCall = mockExecute.mock.calls[0];
      const sql = insertCall[0] as string;
      expect(sql).toContain("INSERT INTO idempotency_keys");
    });
  });

  describe("AC2: TTL enforcement — expired keys are treated as new", () => {
    it("treats expired idempotency record as new request", async () => {
      const middleware = idempotencyMiddleware();
      const body = { status: "planned" };

      const req = makeMockReq({
        headers: {
          "idempotency-key":
            "user-001:/api/loads/load-001/status:load-001:nonce-3",
        },
        body,
      });
      const res = makeMockRes();

      // Mock: existing record that has expired
      mockQuery.mockResolvedValueOnce([
        [
          {
            id: "idem-old",
            idempotency_key:
              "user-001:/api/loads/load-001/status:load-001:nonce-3",
            request_hash: "some-hash",
            response_status: 200,
            response_body: "{}",
            expires_at: new Date(Date.now() - 1000), // Expired 1 second ago
          },
        ],
        [],
      ]);
      // DELETE expired record
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      // INSERT new record after handler
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

      const next = vi.fn().mockImplementation(() => {
        res.status(200).json({ result: "new" });
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledOnce();
    });
  });

  describe("AC3: Idempotency required on specific endpoints", () => {
    it("migration creates idempotency_keys table with UNIQUE key and TTL columns", async () => {
      // This is a structural test — verify the SQL file exists and has correct schema
      const fs = await import("fs");
      const path = await import("path");
      const migrationPath = path.resolve(
        __dirname,
        "../../migrations/004_idempotency_keys.sql",
      );

      const exists = fs.existsSync(migrationPath);
      expect(exists).toBe(true);

      const content = fs.readFileSync(migrationPath, "utf-8");
      // Must have UNIQUE constraint on idempotency_key
      expect(content).toMatch(/UNIQUE/i);
      expect(content).toMatch(/idempotency_key/);
      // Must have request_hash column
      expect(content).toMatch(/request_hash/);
      // Must have expires_at / TTL column
      expect(content).toMatch(/expires_at/);
      // Must have response columns for replay
      expect(content).toMatch(/response_status/);
      expect(content).toMatch(/response_body/);
    });

    it("idempotency middleware is required on status transitions (can be applied as Express middleware)", () => {
      // Verify the middleware is a function factory that returns Express middleware
      const mw = idempotencyMiddleware();
      expect(typeof mw).toBe("function");
      expect(mw.length).toBe(3); // Express middleware (req, res, next)
    });
  });

  describe("AC2: Request hash computation", () => {
    it("computes consistent SHA-256 hash for identical request bodies", () => {
      const body1 = { status: "planned", note: "hello" };
      const body2 = { status: "planned", note: "hello" };
      expect(computeRequestHash(body1)).toBe(computeRequestHash(body2));
    });

    it("computes different hashes for different request bodies", () => {
      const body1 = { status: "planned" };
      const body2 = { status: "dispatched" };
      expect(computeRequestHash(body1)).not.toBe(computeRequestHash(body2));
    });

    it("handles key ordering consistently via sort", () => {
      const body1 = { a: 1, b: 2 };
      const body2 = { b: 2, a: 1 };
      expect(computeRequestHash(body1)).toBe(computeRequestHash(body2));
    });
  });
});
