import { useCallback } from "react";

// Config comes from Vite env. When either value is missing the hook reports
// `enabled: false` and callers hide their Drive buttons (same pattern as the
// Sign-in-with-Google button). Getting these requires an OAuth Web client ID
// and a Picker API key from Google Cloud Console.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined;

// drive.file is the per-file scope: our app can only touch files the user hands
// us through the Picker, so it avoids Google's restricted-scope security review.
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Minimal typings for the two Google CDN globals we use. They have no npm
// package, so we declare only the surface this hook actually calls.
interface TokenResponse {
  access_token: string;
  error?: string;
}
interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}
interface PickedDoc {
  id: string;
  name: string;
  mimeType: string;
}
interface PickerCallbackData {
  action: string;
  docs?: PickedDoc[];
}
interface DocsView {
  setIncludeFolders(include: boolean): DocsView;
  setOwnedByMe(owned: boolean): DocsView;
  setMimeTypes(mimeTypes: string): DocsView;
}
interface PickerInstance {
  setVisible(visible: boolean): void;
}
interface PickerBuilder {
  addView(view: DocsView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(cb: (data: PickerCallbackData) => void): PickerBuilder;
  build(): PickerInstance;
}
interface GooglePicker {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new (viewId?: unknown) => DocsView;
  ViewId: { DOCS: unknown };
  Action: { PICKED: string; CANCEL: string };
}
interface GoogleNamespace {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
      }) => TokenClient;
    };
  };
  picker: GooglePicker;
}

declare global {
  interface Window {
    google?: GoogleNamespace;
    gapi?: { load: (module: string, callback: () => void) => void };
  }
}

// Deduped script loading: each src is fetched at most once, subsequent callers
// await the same promise.
const scriptPromises = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let promise = scriptPromises.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });
    scriptPromises.set(src, promise);
  }
  return promise;
}

let pickerModule: Promise<void> | null = null;
function loadPicker(): Promise<void> {
  if (!pickerModule) {
    pickerModule = loadScript("https://apis.google.com/js/api.js").then(
      () => new Promise<void>((resolve) => window.gapi!.load("picker", () => resolve())),
    );
  }
  return pickerModule;
}

function requestAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) reject(new Error(resp.error ?? "No access token"));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

function showPicker(token: string, apiKey: string, mimeTypes?: string): Promise<PickedDoc | null> {
  return new Promise((resolve) => {
    const picker = window.google!.picker;
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(false)
      .setOwnedByMe(true);
    if (mimeTypes) view.setMimeTypes(mimeTypes);

    new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setTitle("Select from Google Drive")
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs?.[0] ?? null);
        else if (data.action === picker.Action.CANCEL) resolve(null);
      })
      .build()
      .setVisible(true);
  });
}

// Downloads the picked file's bytes. This talks to the Google Drive API (not the
// KnowledgeMarket API), so it does not go through apiClient. The resulting File
// is handed to the existing upload endpoints, which validate MIME type and size.
async function downloadDoc(doc: PickedDoc, token: string): Promise<File> {
  const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Drive download failed (${resp.status})`);
  const blob = await resp.blob();
  return new File([blob], doc.name, { type: doc.mimeType || blob.type });
}

export function useGoogleDrivePicker() {
  const enabled = Boolean(CLIENT_ID && API_KEY);

  const pick = useCallback(async (opts?: { mimeTypes?: string }): Promise<File | null> => {
    if (!CLIENT_ID || !API_KEY) throw new Error("Google Drive is not configured");
    await Promise.all([loadScript("https://accounts.google.com/gsi/client"), loadPicker()]);
    const token = await requestAccessToken(CLIENT_ID);
    const doc = await showPicker(token, API_KEY, opts?.mimeTypes);
    if (!doc) return null;
    return downloadDoc(doc, token);
  }, []);

  return { enabled, pick };
}
