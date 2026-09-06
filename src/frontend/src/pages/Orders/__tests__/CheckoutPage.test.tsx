import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ orderId: "order-1" }),
    useSearchParams: () => [new URLSearchParams()],
  };
});

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    getOrder: vi.fn(),
    checkoutOrder: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock Stripe
// ---------------------------------------------------------------------------
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element">Payment Element</div>,
  useStripe: () => null,
  useElements: () => null,
}));

vi.mock("../../../lib/stripe", () => ({
  stripePromise: Promise.resolve(null),
}));

import React from "react";
import { apiClient } from "../../../api/apiClient";
import { CheckoutPage } from "../CheckoutPage";

const mockApiClient = apiClient as unknown as {
  getOrder: ReturnType<typeof vi.fn>;
  checkoutOrder: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(
    <MemoryRouter>
      <CheckoutPage />
    </MemoryRouter>
  );
}

describe("CheckoutPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while fetching order", () => {
    mockApiClient.getOrder.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows success screen when order is already Paid", async () => {
    mockApiClient.getOrder.mockResolvedValue({
      id: "order-1",
      courseId: "course-1",
      courseTitle: "TypeScript Basics",
      priceAmount: 49,
      priceCurrency: "USD",
      status: "Paid",
      paidAt: "2025-01-01T00:00:00Z",
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Payment successful!")).toBeInTheDocument();
    });
    expect(screen.getByText("TypeScript Basics")).toBeInTheDocument();
    expect(screen.getByText(/start learning/i)).toBeInTheDocument();
  });

  it("shows success screen when clientSecret is null (healed order)", async () => {
    mockApiClient.getOrder.mockResolvedValue({
      id: "order-1",
      courseId: "course-1",
      courseTitle: "React Course",
      priceAmount: 29,
      priceCurrency: "USD",
      status: "Pending",
    });
    mockApiClient.checkoutOrder.mockResolvedValue({ clientSecret: null });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Payment successful!")).toBeInTheDocument();
    });
  });

  it("shows checkout form when clientSecret is available", async () => {
    mockApiClient.getOrder.mockResolvedValue({
      id: "order-1",
      courseId: "course-1",
      courseTitle: "React Course",
      priceAmount: 29,
      priceCurrency: "USD",
      status: "Pending",
    });
    mockApiClient.checkoutOrder.mockResolvedValue({
      clientSecret: "pi_secret_123",
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Complete your purchase")).toBeInTheDocument();
    });
    expect(screen.getByText("React Course")).toBeInTheDocument();
  });

  it("shows error when getOrder fails", async () => {
    mockApiClient.getOrder.mockRejectedValue({
      status: 404,
      title: "Not Found",
      detail: "Order not found",
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/order not found/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Back to orders")).toBeInTheDocument();
  });
});
