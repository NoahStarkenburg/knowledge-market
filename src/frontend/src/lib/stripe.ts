import { loadStripe } from "@stripe/stripe-js";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";

if (!publishableKey && import.meta.env.MODE !== "test") {
  // Loud but non-fatal: payment UI will error out cleanly when the user tries to check out.
  console.warn(
    "VITE_STRIPE_PUBLISHABLE_KEY is not set. Stripe Elements will not load. " +
      "Set this in your .env file or in the Vercel/Railway dashboard."
  );
}

export const stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);
