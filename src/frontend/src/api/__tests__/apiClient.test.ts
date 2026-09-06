import { vi, describe, it, expect, afterEach } from "vitest";
import { apiClient } from "../apiClient";

// Minimal Response-like stub so we don't depend on a global Response impl.
function makeResp(status: number, body: unknown = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => (body == null ? "" : JSON.stringify(body)),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient token refresh", () => {
  it("coalesces concurrent 401s into a single refresh (rotation-safe)", async () => {
    let refreshed = false;
    let refreshCount = 0;

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.endsWith("/api/auth/refresh")) {
        refreshCount++;
        refreshed = true;
        return Promise.resolve(makeResp(200, { ok: true }));
      }

      // Protected call: 401 until a refresh has happened, then success.
      return Promise.resolve(refreshed ? makeResp(204) : makeResp(401, { message: "unauthorized" }));
    });

    vi.stubGlobal("fetch", fetchMock);

    // Two protected requests fire at once against an expired access token.
    // Without single-flight this triggers two refreshes; the rotation revokes the
    // first token, the second refresh 401s, and the user is bounced to login.
    await Promise.all([apiClient.deleteAccount(), apiClient.deleteAccount()]);

    expect(refreshCount).toBe(1);
  });
});

describe("apiClient.uploadFile direct-to-S3", () => {
  it("presigns, PUTs straight to S3, then confirms (no proxy)", async () => {
    const dto = { id: "cf-1", fileTitle: "clip.mp4", mimeType: "video/mp4", fileSize: 10, storageKey: "staged/u/g/clip.mp4" };
    const calls: string[] = [];

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(`${init?.method ?? "GET"} ${url}`);

      if (url.endsWith("/api/uploads/presign")) {
        return Promise.resolve(makeResp(200, { mode: "s3", uploadUrl: "http://s3.local/put", key: "staged/u/g/clip.mp4" }));
      }
      if (url === "http://s3.local/put") return Promise.resolve(makeResp(200));
      if (url.endsWith("/api/uploads/confirm")) return Promise.resolve(makeResp(200, dto));
      return Promise.resolve(makeResp(500));
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["0123456789"], "clip.mp4", { type: "video/mp4" });
    const result = await apiClient.uploadFile("course-1", file);

    expect(result).toEqual(dto);
    expect(calls).toContain("PUT http://s3.local/put");
    expect(calls.some((c) => c.includes("/lessons/upload"))).toBe(false);
  });

  it("falls back to the multipart proxy when the provider can't presign", async () => {
    const dto = { id: "cf-2", fileTitle: "a.png", mimeType: "image/png", fileSize: 4, storageKey: "k" };
    const calls: string[] = [];

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      if (url.endsWith("/api/uploads/presign")) {
        return Promise.resolve(makeResp(200, { mode: "proxy", uploadUrl: null, key: null }));
      }
      if (url.endsWith("/lessons/upload")) return Promise.resolve(makeResp(200, dto));
      return Promise.resolve(makeResp(500));
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["data"], "a.png", { type: "image/png" });
    const result = await apiClient.uploadFile("course-1", file);

    expect(result).toEqual(dto);
    expect(calls.some((c) => c.includes("/lessons/upload"))).toBe(true);
  });
});
