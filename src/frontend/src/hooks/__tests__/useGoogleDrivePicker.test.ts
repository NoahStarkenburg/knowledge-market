import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const PICKED_DOC = { id: "file-1", name: "clip.mp4", mimeType: "video/mp4" };

// Re-import the module fresh each time so its top-level env reads and internal
// script-load caches reset between tests.
async function loadHook() {
  vi.resetModules();
  const mod = await import("../useGoogleDrivePicker");
  return mod.useGoogleDrivePicker;
}

// Stand-ins for the Google Identity Services + Picker CDN globals. The Picker
// builder captures the callback and fires the chosen action when made visible.
function installGoogleGlobals(action: "picked" | "cancel" = "picked"): void {
  let pickerCallback: ((data: { action: string; docs?: unknown[] }) => void) | null = null;

  const view = {
    setIncludeFolders: () => view,
    setOwnedByMe: () => view,
    setMimeTypes: () => view,
  };

  const builder = {
    addView: () => builder,
    setOAuthToken: () => builder,
    setDeveloperKey: () => builder,
    setTitle: () => builder,
    setCallback: (cb: (data: { action: string; docs?: unknown[] }) => void) => {
      pickerCallback = cb;
      return builder;
    },
    build: () => ({
      setVisible: () =>
        pickerCallback?.({ action, docs: action === "picked" ? [PICKED_DOC] : undefined }),
    }),
  };

  const google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: { callback: (resp: { access_token: string }) => void }) => ({
          requestAccessToken: () => config.callback({ access_token: "token-abc" }),
        }),
      },
    },
    picker: {
      PickerBuilder: function PickerBuilder() {
        return builder;
      },
      DocsView: function DocsView() {
        return view;
      },
      ViewId: { DOCS: "docs" },
      Action: { PICKED: "picked", CANCEL: "cancel" },
    },
  };

  window.google = google as unknown as Window["google"];
  window.gapi = { load: (_module: string, cb: () => void) => cb() };
}

describe("useGoogleDrivePicker", () => {
  beforeEach(() => {
    vi.spyOn(document.head, "appendChild").mockImplementation(((node: Node) => {
      const script = node as unknown as HTMLScriptElement;
      if (typeof script.onload === "function") {
        queueMicrotask(() => script.onload?.(new Event("load")));
      }
      return node;
    }) as typeof document.head.appendChild);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["binary"], { type: "video/mp4" }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete window.google;
    delete window.gapi;
  });

  it("reports disabled when env vars are absent", async () => {
    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());
    expect(result.current.enabled).toBe(false);
  });

  it("pick() rejects when Drive is not configured", async () => {
    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());
    await expect(result.current.pick()).rejects.toThrow(/not configured/i);
  });

  it("reports enabled and returns a File when a document is picked", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-123");
    vi.stubEnv("VITE_GOOGLE_API_KEY", "key-123");
    installGoogleGlobals("picked");

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());
    expect(result.current.enabled).toBe(true);

    const holder: { file: File | null } = { file: null };
    await act(async () => {
      holder.file = await result.current.pick({ mimeTypes: "video/mp4" });
    });

    expect(holder.file).toBeInstanceOf(File);
    expect(holder.file?.name).toBe("clip.mp4");
    expect(holder.file?.type).toBe("video/mp4");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://www.googleapis.com/drive/v3/files/file-1?alt=media",
      { headers: { Authorization: "Bearer token-abc" } },
    );
  });

  it("resolves null when the Picker is cancelled", async () => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-123");
    vi.stubEnv("VITE_GOOGLE_API_KEY", "key-123");
    installGoogleGlobals("cancel");

    const useHook = await loadHook();
    const { result } = renderHook(() => useHook());

    const holder: { file: File | null } = { file: new File(["x"], "x") };
    await act(async () => {
      holder.file = await result.current.pick();
    });

    expect(holder.file).toBeNull();
  });
});
