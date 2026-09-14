// Public values compiled into the bundle at build time. Defaults live under "define" in
// angular.json and the Dockerfile overrides them with `ng build --define`. The compiler replaces
// each identifier with its literal value, so they never exist as runtime globals.
declare const STRIPE_PUBLISHABLE_KEY: string;
declare const GOOGLE_AUTH: string;
declare const GOOGLE_CLIENT_ID: string;
declare const GOOGLE_API_KEY: string;
