import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../environments/environment';

const publishableKey = environment.stripePublishableKey;

if (!publishableKey && !environment.production) {
  // Loud but non-fatal: payment UI errors cleanly when the user tries to check out.
  console.warn('stripePublishableKey is not set. Stripe Elements will not load.');
}

export const stripePromise: Promise<Stripe | null> = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);
