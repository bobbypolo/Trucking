import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendPush } from "../../lib/expo-push";

/**
 * Tests for sendPush — the Expo Push sender utility.
 *
 * Mocking strategy: replace global `fetch` (the network boundary) with a
 * `vi.fn()`. We are testing `sendPush` itself — never self-mocked.
 */

const originalFetch = globalThis.fetch;

function makeOkResponse(): Response {
  return new Response("{}", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function make500Response(): Response {
  return new Response("upstream error", {
    status: 500,
    headers: { "Content-Type": "text/plain" },
  });
}

describe("sendPush", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Tests R-P4-06
  it("issues exactly one fetch with the correct payload for 2 tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendPush(["t1", "t2"], "Title", "Body", {
      foo: "bar",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://exp.host/--/api/v2/push/send",
    );

    const opts = fetchMock.mock.calls[0][1];
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);

    expect(body[0]).toEqual({
      to: "t1",
      title: "Title",
      body: "Body",
      data: { foo: "bar" },
    });
    expect(body[1]).toEqual({
      to: "t2",
      title: "Title",
      body: "Body",
      data: { foo: "bar" },
    });

    expect(result.sent).toBe(2);
    expect(result.errors).toEqual([]);
  });

  // Tests R-P4-07
  it("batches 150 tokens into exactly 2 fetch calls (100 + 50)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const tokens = Array.from({ length: 150 }, (_, i) => `tok-${i}`);
    const result = await sendPush(tokens, "T", "B");

    expect(fetchMock.mock.calls.length).toBe(2);

    const firstBatch = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const secondBatch = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(firstBatch.length).toBe(100);
    expect(secondBatch.length).toBe(50);

    expect(result.sent).toBe(150);
    expect(result.errors).toEqual([]);
  });

  // Tests R-P4-08
  it("returns errors array equal to token count when fetch returns 500, never throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue(make500Response());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const tokens = ["a", "b", "c"];
    await expect(sendPush(tokens, "T", "B")).resolves.toMatchObject({
      sent: 0,
      errors: expect.any(Array),
    });

    // Re-run to capture and inspect
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(make500Response());
    const result = await sendPush(tokens, "T", "B");
    expect(result.errors.length).toBe(tokens.length);
    for (const err of result.errors) {
      expect(typeof err.token).toBe("string");
      expect(typeof err.reason).toBe("string");
    }
  });

  it("returns sent=0 errors=[] for empty token list (edge case)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendPush([], "T", "B");
    expect(result.sent).toBe(0);
    expect(result.errors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults data to {} when not provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse());
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendPush(["t1"], "T", "B");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body[0].data).toEqual({});
  });

  it("converts thrown fetch errors into error entries (no throw propagation)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendPush(["t1", "t2"], "T", "B");

    expect(result.sent).toBe(0);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].reason).toBe("network down");
  });
});
