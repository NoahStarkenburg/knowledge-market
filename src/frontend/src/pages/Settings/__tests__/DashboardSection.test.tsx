import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    getCreatorDashboard: vi.fn(),
    getCreatorOrders: vi.fn(),
    getCourseThumbnailUrl: vi.fn(() => "http://localhost/thumb"),
  },
}));

import { apiClient } from "../../../api/apiClient";
import { DashboardSection } from "../DashboardSection";

const mockApiClient = apiClient as unknown as {
  getCreatorDashboard: ReturnType<typeof vi.fn>;
  getCreatorOrders: ReturnType<typeof vi.fn>;
};

function renderSection() {
  return render(
    <MemoryRouter>
      <DashboardSection />
    </MemoryRouter>
  );
}

describe("DashboardSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.getCreatorOrders.mockResolvedValue({
      page: 1,
      pageSize: 10,
      total: 0,
      items: [],
    });
  });

  it("shows loading spinner while fetching", () => {
    mockApiClient.getCreatorDashboard.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders the dashboard masthead", async () => {
    mockApiClient.getCreatorDashboard.mockResolvedValue({
      totalCourses: 3,
      publishedCourses: 2,
      draftCourses: 1,
      totalEnrollments: 100,
      totalRevenue: 500,
      totalReviews: 10,
      averageRating: 4.5,
      courses: [],
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText(/creator dashboard/i)).toBeInTheDocument();
      expect(screen.getByText(/the ledger/i)).toBeInTheDocument();
    });
  });

  it("renders stat cards with dashboard data", async () => {
    mockApiClient.getCreatorDashboard.mockResolvedValue({
      totalCourses: 3,
      publishedCourses: 2,
      draftCourses: 1,
      totalEnrollments: 100,
      totalRevenue: 500,
      totalReviews: 10,
      averageRating: 4.5,
      courses: [],
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("$500")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("4.5")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("shows error when API fails", async () => {
    mockApiClient.getCreatorDashboard.mockRejectedValue({
      status: 500,
      title: "Error",
      detail: "Dashboard load failed",
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText(/dashboard load failed/i)).toBeInTheDocument();
    });
  });

  it("shows no courses message when courses array is empty", async () => {
    mockApiClient.getCreatorDashboard.mockResolvedValue({
      totalCourses: 0,
      publishedCourses: 0,
      draftCourses: 0,
      totalEnrollments: 0,
      totalRevenue: 0,
      totalReviews: 0,
      averageRating: null,
      courses: [],
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("No courses yet.")).toBeInTheDocument();
    });
  });

  it("renders course performance rows when courses exist", async () => {
    mockApiClient.getCreatorDashboard.mockResolvedValue({
      totalCourses: 1,
      publishedCourses: 1,
      draftCourses: 0,
      totalEnrollments: 50,
      totalRevenue: 250,
      totalReviews: 5,
      averageRating: 4.0,
      courses: [
        {
          id: "c1",
          title: "TypeScript Basics",
          status: "Published",
          thumbnailFileId: null,
          publishedAt: "2025-06-01T00:00:00Z",
          enrollments: 50,
          revenue: 250,
          currency: "USD",
          reviewCount: 5,
          averageRating: 4.0,
        },
      ],
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("TypeScript Basics")).toBeInTheDocument();
      expect(screen.getByText(/performance by course/i)).toBeInTheDocument();
    });
  });
});
