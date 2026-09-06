# KnowledgeMarket — Google Integration Setup

Two independent Google features, both off by default and enabled purely by configuration:

1. **Sign in with Google** — OAuth/OIDC login. Backend mints its own session cookies after Google verifies identity.
2. **Import from Google Drive** — creators can pick a video or image from their Drive when uploading course media. The browser downloads the picked file and sends it to the existing upload endpoints, so no backend changes were needed.

Both use the same Google Cloud project and OAuth consent screen.

---

## 1. Google Cloud Console (one-time)

1. Create a project at <https://console.cloud.google.com>.
2. **APIs & Services → Library**: enable **Google Picker API** and **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: configure it (External, add yourself as a test user). No verification is required because Drive import uses the `drive.file` scope, which only grants access to files the user explicitly picks.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins**: `http://localhost:5173`
   - **Authorized redirect URIs**: `http://localhost:5116/signin-google`
   - Copy the **Client ID** and **Client secret**.
5. **Credentials → Create credentials → API key**: copy it, then restrict it to the **Google Picker API**.

For production, add your real origins/redirect URIs alongside the localhost ones.

---

## 2. Backend config (Sign in with Google)

Set these via environment variables or user-secrets (never commit them — this is a public repo):

```
Authentication__Google__ClientId=<client id>
Authentication__Google__ClientSecret=<client secret>
```

When both are present, `Program.cs` wires the Google handler and maps `/api/auth/google/start` and `/api/auth/google/callback`. When absent, the app runs normally without Google login.

---

## 3. Frontend config

Create `src/frontend/.env.local`:

```
# Sign in with Google button
VITE_GOOGLE_AUTH=true

# Import from Google Drive (Picker)
VITE_GOOGLE_CLIENT_ID=<oauth web client id>
VITE_GOOGLE_API_KEY=<picker api key>
```

- `VITE_GOOGLE_AUTH` toggles the "Continue with Google" button.
- `VITE_GOOGLE_CLIENT_ID` + `VITE_GOOGLE_API_KEY` toggle the "Import from Google Drive" buttons. If either is missing, the buttons render nothing.

The OAuth Client ID is the same value in both places.

---

## 4. Where it lives in code

| Concern | File |
|---|---|
| Google login endpoints | `src/Api/Program.cs` (`/api/auth/google/*`) |
| "Continue with Google" button | `src/frontend/src/components/Auth/GoogleSignInButton.tsx` |
| Drive Picker + token + download | `src/frontend/src/hooks/useGoogleDrivePicker.ts` |
| "Import from Google Drive" button | `src/frontend/src/components/Media/GoogleDriveButton.tsx` |
| Wired into uploads | `LessonContentManagePage.tsx` (file, video), `CourseDetailPage.tsx` (thumbnail, intro video) |

Drive import reuses the existing upload endpoints (`/lessons/upload`, `/thumbnail`, `/intro-video`) and their MIME/size validation — a Drive-picked file follows the exact same path as a locally chosen one.
