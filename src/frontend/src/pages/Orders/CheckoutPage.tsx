import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Lock } from "lucide-react";
import { apiClient } from "../../api/apiClient";
import type { ApiError, OrderDto } from "../../api/types";
import { stripePromise } from "../../lib/stripe";
import { Button } from "../../components/ui/Button";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { FormErrorList } from "../../components/ui/FormErrorList";
import { usePageTitle } from "../../hooks/usePageTitle";

const Spinner: React.FC = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
  </svg>
);

// Inner form — must be rendered inside <Elements>
interface CheckoutFormProps {
  order: OrderDto;
  onSuccess: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ order, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setStripeError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/${order.id}`,
      },
      redirect: "if_required",
    });

    if (result.error) {
      setStripeError(result.error.message ?? "Payment failed. Please try again.");
      setSubmitting(false);
    } else if (result.paymentIntent?.status === "succeeded") {
      onSuccess();
    } else {
      setStripeError("Unexpected payment status. Please contact support.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-chalk border-2 border-ink p-6">
        <PaymentElement />
      </div>

      {stripeError && (
        <div className="bg-[#fdeceb] border-2 border-danger text-danger text-[13px] px-4 py-3">
          {stripeError}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        disabled={!stripe || !elements || submitting}
        className="w-full h-11 text-[15px]"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> Processing…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" />
            Pay ${order.priceAmount} {order.priceCurrency}
          </span>
        )}
      </Button>

      <p className="text-center text-[11px] text-ink-mute">
        Secured by Stripe. Your card details are never stored on our servers.
      </p>
    </form>
  );
};

// Outer page — fetches order + client secret, wraps form in <Elements>
export const CheckoutPage: React.FC = () => {
  usePageTitle("Checkout");
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [order, setOrder] = useState<OrderDto | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(true);
  const [succeeded, setSucceeded] = useState(false);

  const handleSuccess = useCallback(() => {
    setSucceeded(true);
  }, []);

  useEffect(() => {
    if (!orderId) return;

    // Returning from a Stripe 3DS redirect
    const redirectStatus = searchParams.get("redirect_status");
    if (redirectStatus === "succeeded") {
      setSucceeded(true);
    }

    const init = async () => {
      setLoading(true);
      setLoadError(undefined);
      try {
        const o = await apiClient.getOrder(orderId);
        setOrder(o);

        // Already paid (webhook fired, or just arrived via redirect)
        if (o.status === "Paid") {
          setSucceeded(true);
          setLoading(false);
          return;
        }

        const { clientSecret: cs } = await apiClient.checkoutOrder(orderId);

        // null means the backend detected the PI was already succeeded and
        // healed the order — treat as immediate success
        if (cs === null) {
          setSucceeded(true);
          setLoading(false);
          return;
        }

        setClientSecret(cs);
      } catch (err: unknown) {
        setLoadError(err as ApiError);
      } finally {
        setLoading(false);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (succeeded && order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-4">
          Payment received
        </p>
        <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(2rem,6vw,2.75rem)] text-ink mb-3">
          Payment successful!
        </h1>
        <p className="text-[14px] leading-[1.6] text-ink-soft mb-8">
          You now have full access to{" "}
          <span className="font-semibold text-ink">{order.courseTitle}</span>.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate(`/courses/${order.courseId}/lessons`)}
          className="w-full h-11 text-[15px]"
        >
          Start learning →
        </Button>
      </div>
    );
  }

  if (loadError || !order || !clientSecret) {
    return (
      <div className="max-w-md mx-auto px-4 py-20">
        <FormErrorList error={loadError} />
        {!loadError && (
          <p className="text-[14px] text-ink-soft text-center">
            Could not load checkout. Please try again or contact support.
          </p>
        )}
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={() => navigate("/settings/orders")}>
            Back to orders
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">
          Checkout
        </p>
        <h1 className="font-display font-extrabold uppercase tracking-[-0.02em] leading-[0.95] text-[clamp(1.9rem,5vw,2.5rem)] text-ink mb-2">
          Complete your purchase
        </h1>
        <p className="text-[14px] text-ink-soft">{order.courseTitle}</p>
      </div>

      <div className="mb-6 bg-chalk border-2 border-ink p-4 flex items-center justify-between">
        <span className="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink-mute">
          Total
        </span>
        <span className="font-display font-extrabold tabular-nums tracking-[-0.01em] text-cobalt text-[22px]">
          ${order.priceAmount}{" "}
          <span className="font-mono text-[13px] text-ink-mute">{order.priceCurrency}</span>
        </span>
      </div>

      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm order={order} onSuccess={handleSuccess} />
      </Elements>
    </div>
  );
};
