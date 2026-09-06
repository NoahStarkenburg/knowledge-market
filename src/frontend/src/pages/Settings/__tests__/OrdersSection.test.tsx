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
  };
});

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    listOrders: vi.fn(),
    refundOrder: vi.fn(),
  },
}));

import { apiClient } from "../../../api/apiClient";
import { OrdersSection } from "../OrdersSection";

const mockApiClient = apiClient as unknown as {
  listOrders: ReturnType<typeof vi.fn>;
  refundOrder: ReturnType<typeof vi.fn>;
};

function renderSection() {
  return render(
    <MemoryRouter>
      <OrdersSection />
    </MemoryRouter>
  );
}

describe("OrdersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.listOrders.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 0,
      items: [],
    });
  });

  it("renders the Orders heading", async () => {
    renderSection();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  it("shows skeleton loading state initially", () => {
    mockApiClient.listOrders.mockReturnValue(new Promise(() => {}));
    renderSection();
    // Loading state renders skeleton divs (animate-pulse)
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no orders are returned", async () => {
    renderSection();

    await waitFor(() => {
      expect(screen.getByText(/no orders found/i)).toBeInTheDocument();
    });
  });

  it("renders status filter tabs", () => {
    renderSection();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pending" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paid" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refunded" })).toBeInTheDocument();
  });

  it("renders order items when orders are returned", async () => {
    mockApiClient.listOrders.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          id: "o1",
          courseId: "c1",
          courseTitle: "Test Course",
          priceAmount: 49,
          priceCurrency: "USD",
          status: "Paid",
          createdAt: "2025-01-01T00:00:00Z",
          paidAt: new Date().toISOString(),
        },
      ],
    });

    renderSection();

    await waitFor(() => {
      expect(screen.getByText("Test Course")).toBeInTheDocument();
      expect(screen.getByText("$49")).toBeInTheDocument();
    });
  });

  it("shows Pay now button for Pending orders", async () => {
    mockApiClient.listOrders.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          id: "o1",
          courseId: "c1",
          courseTitle: "Pending Course",
          priceAmount: 29,
          priceCurrency: "USD",
          status: "Pending",
          createdAt: "2025-01-01T00:00:00Z",
          paidAt: null,
        },
      ],
    });

    renderSection();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pay now/i })).toBeInTheDocument();
    });
  });

  it("shows Refund button for recently paid orders", async () => {
    mockApiClient.listOrders.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          id: "o1",
          courseId: "c1",
          courseTitle: "Recent Course",
          priceAmount: 49,
          priceCurrency: "USD",
          status: "Paid",
          createdAt: "2025-01-01T00:00:00Z",
          paidAt: new Date().toISOString(),
        },
      ],
    });

    renderSection();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refund/i })).toBeInTheDocument();
    });
  });

  it("shows Refund window expired for old paid orders", async () => {
    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    mockApiClient.listOrders.mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          id: "o1",
          courseId: "c1",
          courseTitle: "Old Course",
          priceAmount: 49,
          priceCurrency: "USD",
          status: "Paid",
          createdAt: "2025-01-01T00:00:00Z",
          paidAt: oldDate,
        },
      ],
    });

    renderSection();

    await waitFor(() => {
      expect(screen.getByText(/refund window expired/i)).toBeInTheDocument();
    });
  });

  it("renders search input", () => {
    renderSection();
    expect(screen.getByPlaceholderText(/search by course title/i)).toBeInTheDocument();
  });

  it("calls listOrders on mount", async () => {
    renderSection();
    await waitFor(() => {
      expect(mockApiClient.listOrders).toHaveBeenCalled();
    });
  });
});
