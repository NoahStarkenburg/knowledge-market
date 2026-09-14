import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

// Loads the Google Identity + Picker scripts on demand and opens the Drive file picker.
// Reports enabled=false until a client id + api key are configured, so callers hide their
// Drive buttons when the integration is unconfigured. The drive.file
// scope means the app can only touch files the user hands us through the Picker.
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/* eslint-disable @typescript-eslint/no-explicit-any */
const scriptPromises = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  let promise = scriptPromises.get(src);
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
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
    pickerModule = loadScript('https://apis.google.com/js/api.js').then(
      () => new Promise<void>((resolve) => (window as any).gapi.load('picker', () => resolve())),
    );
  }
  return pickerModule;
}

@Injectable({ providedIn: 'root' })
export class GoogleDrivePickerService {
  private readonly clientId = environment.googleDrive.clientId;
  private readonly apiKey = environment.googleDrive.apiKey;

  readonly enabled = Boolean(this.clientId && this.apiKey);

  async pick(opts?: { mimeTypes?: string }): Promise<File | null> {
    if (!this.clientId || !this.apiKey) throw new Error('Google Drive is not configured');
    await Promise.all([loadScript('https://accounts.google.com/gsi/client'), loadPicker()]);
    const token = await this.requestAccessToken();
    const doc = await this.showPicker(token, opts?.mimeTypes);
    if (!doc) return null;
    return this.downloadDoc(doc, token);
  }

  private requestAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        callback: (resp: any) => {
          if (resp.error || !resp.access_token) reject(new Error(resp.error ?? 'No access token'));
          else resolve(resp.access_token);
        },
      });
      client.requestAccessToken();
    });
  }

  private showPicker(token: string, mimeTypes?: string): Promise<any | null> {
    return new Promise((resolve) => {
      const picker = (window as any).google.picker;
      const view = new picker.DocsView(picker.ViewId.DOCS).setIncludeFolders(false).setOwnedByMe(true);
      if (mimeTypes) view.setMimeTypes(mimeTypes);

      new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(this.apiKey)
        .setTitle('Select from Google Drive')
        .setCallback((data: any) => {
          if (data.action === picker.Action.PICKED) resolve(data.docs?.[0] ?? null);
          else if (data.action === picker.Action.CANCEL) resolve(null);
        })
        .build()
        .setVisible(true);
    });
  }

  private async downloadDoc(doc: any, token: string): Promise<File> {
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) throw new Error(`Drive download failed (${resp.status})`);
    const blob = await resp.blob();
    return new File([blob], doc.name, { type: doc.mimeType || blob.type });
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
