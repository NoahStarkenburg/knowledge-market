import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock AuthContext
// ---------------------------------------------------------------------------
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isAdmin: false,
    roles: [],
    userId: "user-1",
    email: "test@example.com",
    isEmailVerified: true,
    login: vi.fn(),
    logout: vi.fn(),
    resendVerification: vi.fn(),
    deleteAccount: vi.fn(),
    markEmailVerified: vi.fn(),
    displayName: "Test User",
    updateDisplayName: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    getMyCourses: vi.fn(),
    listOrders: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock useEnrolledCourses
// ---------------------------------------------------------------------------
const mockReload = vi.fn();
vi.mock("../../../hooks/useEnrolledCourses", () => ({
  useEnrolledCourses: vi.fn(() => ({
    entries: [],
    loading: false,
    error: undefined,
    reload: mockReload,
  })),
}));

import { apiClient } from "../../../api/apiClient";
import { OverviewSection } from "../OverviewSection";

const mockApiClient = apiClient as unknown as {
  getMyCourses: ReturnType<typeof vi.fn>;
  listOrders: ReturnType<typeof vi.fn>;
};

function renderSection() {
  return render(
    <MemoryRouter>
      <OverviewSection />
    </MemoryRouter>
  );
}

describe("OverviewSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.getMyCourses.mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 2,
      items: [
        { id: "c1", title: "Course 1" },
        { id: "c2", title: "Course 2" },
      ],
    });
    mockApiClient.listOrders.mockResolvedValue({
      page: 1,
      pageSize: 3,
      total: 5,
      items: [
        { id: "o1", courseTitle: "Course 1", status: "Paid" },
        { id: "o2", courseTitle: "Course 2", status: "Pending" },
      ],
    });
  });

  it("renders the username from email", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("test")).toBeInTheDocument();
    });
  });

  it("renders the email", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("test@example.com")).toBeInTheDocument();
    });
  });

  it("renders stats cards with correct counts", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument(); // created courses
      expect(screen.getByText("5")).toBeInTheDocument(); // total orders
    });
  });

  it("renders quick actions links", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("Create a new course")).toBeInTheDocument();
      expect(screen.getByText("Browse all courses")).toBeInTheDocument();
    });
  });

  it("renders recent orders panel", async () => {
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("Recent orders")).toBeInTheDocument();
      expect(screen.getByText("Course 1")).toBeInTheDocument();
    });
  });

  it("renders error message when API fails", async () => {
    mockApiClient.getMyCourses.mockRejectedValue({
      status: 500,
      title: "Server Error",
      detail: "Internal server error",
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
    });
  });
});
