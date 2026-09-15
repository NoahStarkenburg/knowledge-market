export const environment = {
  production: false,
  stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
  googleAuth: GOOGLE_AUTH === 'true',
  googleDrive: { clientId: GOOGLE_CLIENT_ID, apiKey: GOOGLE_API_KEY },
};
