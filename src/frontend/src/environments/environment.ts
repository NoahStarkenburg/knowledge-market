// Public, per-deployment configuration. It is compiled into JavaScript that ships to the browser,
// where anyone can read it, so only publishable identifiers belong here, never a secret.
// The values are build-time defines (see src/build-config.d.ts). Development builds swap in
// environment.development.ts through fileReplacements in angular.json.
export const environment = {
  production: true,
  stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
  googleAuth: GOOGLE_AUTH === 'true',
  googleDrive: { clientId: GOOGLE_CLIENT_ID, apiKey: GOOGLE_API_KEY },
};
