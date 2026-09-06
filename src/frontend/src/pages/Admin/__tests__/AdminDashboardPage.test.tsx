import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AuthContext
// ---------------------------------------------------------------------------
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isAdmin: true,
    roles: ["Admin"],
    userId: "admin-1",
    email: "admin@example.com",
    isEmailVerified: true,
    login: vi.fn(),
    logout: vi.fn(),
    resendVerification: vi.fn(),
    deleteAccount: vi.fn(),
    markEmailVerified: vi.fn(),
    displayName: null,
    updateDisplayName: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    adminListUsers: vi.fn(),
    adminListOrders: vi.fn(),
    adminAssignRole: vi.fn(),
  },
}));

import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../api/apiClient";
import { AdminDashboardPage } from "../AdminDashboardPage";

const mockApiClient = apiClient as unknown as {
  adminListUsers: ReturnType<typeof vi.fn>;
  adminListOrders: ReturnType<typeof vi.fn>;
  adminAssignRole: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminDashboardPage />
    </MemoryRouter>
  );
}

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: true,
      roles: ["Admin"],
      userId: "admin-1",
      email: "admin@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });
    mockApiClient.adminListUsers.mockResolvedValue({
      total: 0,
      items: [],
    });
    mockApiClient.adminListOrders.mockResolvedValue({
      total: 0,
      items: [],
    });
  });

  it("renders the Admin Dashboard heading for admin users", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    });
  });

  it("renders the Users panel", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Users")).toBeInTheDocument();
    });
  });

  it("renders the Orders panel", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Orders")).toBeInTheDocument();
    });
  });

  it("shows Access Denied for non-admin users", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
      email: "user@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });

    renderPage();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });

  it("displays users in a table when loaded", async () => {
    mockApiClient.adminListUsers.mockResolvedValue({
      total: 1,
      items: [
        {
          id: "u1",
          email: "alice@example.com",
          registeredAt: "2025-01-01T00:00:00Z",
          isEmailVerified: true,
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });
  });

  it("displays orders in a table when loaded", async () => {
    mockApiClient.adminListOrders.mockResolvedValue({
      total: 1,
      items: [
        {
          id: "o1",
          buyerId: "u1",
          courseId: "c1",
          courseTitle: "Test Course",
          priceAmount: 49,
          priceCurrency: "USD",
          status: "Paid",
          createdAt: "2025-01-01T00:00:00Z",
          paidAt: "2025-01-01T00:00:00Z",
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Test Course")).toBeInTheDocument();
    });
  });

  it("calls adminListUsers on mount", async () => {
    renderPage();

    await waitFor(() => {
      expect(mockApiClient.adminListUsers).toHaveBeenCalledTimes(1);
    });
  });

  it("calls adminListOrders on mount", async () => {
    renderPage();

    await waitFor(() => {
      expect(mockApiClient.adminListOrders).toHaveBeenCalledTimes(1);
    });
  });
});
