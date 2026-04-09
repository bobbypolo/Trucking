import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import {
  DEMO_NAV_ALLOWLIST,
  applyDemoNavFilter,
  isDemoNavMode,
  resetDemo,
} from "../../../services/demoNavConfig";
import { api } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

describe("demoNavConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Tests R-P6-02
  it("DEMO_NAV_ALLOWLIST deep-equals the exact 6 real nav keys", () => {
    expect(DEMO_NAV_ALLOWLIST).toEqual([
      "operations-hub",
      "loads",
      "calendar",
      "network",
      "accounting",
      "exceptions",
    ]);
    expect(DEMO_NAV_ALLOWLIST).toHaveLength(6);
  });

  // Tests R-P6-01
  it("isDemoNavMode() returns true when VITE_DEMO_NAV_MODE === 'sales'", () => {
    vi.stubEnv("VITE_DEMO_NAV_MODE", "sales");
    expect(isDemoNavMode()).toBe(true);
  });

  // Tests R-P6-01
  it("isDemoNavMode() returns false when VITE_DEMO_NAV_MODE is unset", () => {
    vi.stubEnv("VITE_DEMO_NAV_MODE", "");
    expect(isDemoNavMode()).toBe(false);
  });

  // Tests R-P6-01
  it("isDemoNavMode() returns false for case-sensitive non-match 'SALES'", () => {
    vi.stubEnv("VITE_DEMO_NAV_MODE", "SALES");
    expect(isDemoNavMode()).toBe(false);
  });

  // Tests R-P6-01
  it("isDemoNavMode() returns false for 'production'", () => {
    vi.stubEnv("VITE_DEMO_NAV_MODE", "production");
    expect(isDemoNavMode()).toBe(false);
  });
});

describe("applyDemoNavFilter", () => {
  // Tests R-P6-04
  it("collapses a full nav to only the 6 allowlisted ids", () => {
    const cats = [
      {
        title: "OPERATIONS",
        items: [
          { id: "operations-hub" },
          { id: "loads" },
          { id: "calendar" },
          { id: "network" },
          { id: "telematics-setup" },
        ],
      },
      { title: "FINANCIALS", items: [{ id: "accounting" }] },
      {
        title: "ADMIN",
        items: [{ id: "exceptions" }, { id: "company" }],
      },
    ];
    applyDemoNavFilter(cats);
    const ids = cats.flatMap((c) => c.items.map((i) => i.id));
    expect(ids).toEqual([
      "operations-hub",
      "loads",
      "calendar",
      "network",
      "accounting",
      "exceptions",
    ]);
  });

  // Tests R-P6-04
  it("drops categories that become empty after filtering", () => {
    const cats = [
      {
        title: "OPERATIONS",
        items: [{ id: "operations-hub" }, { id: "telematics-setup" }],
      },
      { title: "ADMIN", items: [{ id: "company" }] }, // becomes empty
    ];
    applyDemoNavFilter(cats);
    expect(cats).toHaveLength(1);
    expect(cats[0].title).toBe("OPERATIONS");
    expect(cats[0].items.map((i) => i.id)).toEqual(["operations-hub"]);
  });

  // Tests R-P6-04
  it("is a no-op on an empty categories array", () => {
    const cats: Array<{ items: Array<{ id: string }> }> = [];
    applyDemoNavFilter(cats);
    expect(cats).toEqual([]);
  });
});

describe("resetDemo", () => {
  const mockPost = api.post as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockPost.mockReset();
  });

  // Tests R-P6-04
  it("returns success toast payload on 200 OK", async () => {
    mockPost.mockResolvedValue({ ok: true });
    const r = await resetDemo();
    expect(r).toEqual({ message: "Reset Demo OK", type: "success" });
    expect(mockPost).toHaveBeenCalledWith("/demo/reset", {});
  });

  // Tests R-P6-04
  it("returns specific 404 message when route is not mounted", async () => {
    mockPost.mockRejectedValue(new Error("API Request failed: 404"));
    const r = await resetDemo();
    expect(r).toEqual({
      message:
        "Reset Demo failed: route not available — ensure ALLOW_DEMO_RESET=1 is set in server env",
      type: "error",
    });
  });

  // Tests R-P6-04
  it("returns error toast payload on non-200 with error message", async () => {
    mockPost.mockRejectedValue(new Error("forbidden"));
    const r = await resetDemo();
    expect(r).toEqual({
      message: "Reset Demo failed: forbidden",
      type: "error",
    });
  });

  // Tests R-P6-04
  it("returns error toast when api.post throws non-Error", async () => {
    mockPost.mockRejectedValue("network down");
    const r = await resetDemo();
    expect(r).toEqual({
      message: "Reset Demo failed: network down",
      type: "error",
    });
  });
});
