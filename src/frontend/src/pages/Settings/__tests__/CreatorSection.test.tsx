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
    getMyCourses: vi.fn(),
  },
}));

import { apiClient } from "../../../api/apiClient";
import { CreatorSection } from "../CreatorSection";

const mockApiClient = apiClient as unknown as {
  getMyCourses: ReturnType<typeof vi.fn>;
};

function renderSection() {
  return render(
    <MemoryRouter>
      <CreatorSection />
    </MemoryRouter>
  );
}

describe("CreatorSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Creator Studio heading", async () => {
    mockApiClient.getMyCourses.mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 0,
      items: [],
    });
    renderSection();
    expect(screen.getByText("Creator Studio")).toBeInTheDocument();
  });

  it("renders New Course button", async () => {
    mockApiClient.getMyCourses.mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 0,
      items: [],
    });
    renderSection();
    expect(screen.getByText("New Course")).toBeInTheDocument();
  });

  it("shows loading spinner while fetching", () => {
    mockApiClient.getMyCourses.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no courses", async () => {
    mockApiClient.getMyCourses.mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 0,
      items: [],
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("No courses created yet")).toBeInTheDocument();
    });
    expect(screen.getByText("Create your first course")).toBeInTheDocument();
  });

  it("renders course cards when courses exist", async () => {
    mockApiClient.getMyCourses.mockResolvedValue({
      page: 1,
      pageSize: 50,
      total: 1,
      items: [
        {
          id: "c1",
          title: "React Fundamentals",
          priceAmount: 49,
          priceCurrency: "USD",
          status: "Published",
          createdAt: "2025-01-01",
          publishedAt: "2025-01-02",
          createdById: "user-1",
          tags: ["react"],
        },
      ],
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText("React Fundamentals")).toBeInTheDocument();
    });
    expect(screen.getByText("$49")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows error when API fails", async () => {
    mockApiClient.getMyCourses.mockRejectedValue({
      status: 500,
      title: "Error",
      detail: "Failed to load courses",
    });
    renderSection();
    await waitFor(() => {
      expect(screen.getByText(/failed to load courses/i)).toBeInTheDocument();
    });
  });
});
