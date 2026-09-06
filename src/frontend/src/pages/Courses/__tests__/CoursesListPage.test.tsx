import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockNavigate = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockSetSearchParams = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  };
});

vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    listCourses: vi.fn(),
    searchCourses: vi.fn(),
  },
}));

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
    displayName: null,
    updateDisplayName: vi.fn(),
  })),
}));

import { apiClient } from "../../../api/apiClient";
import { CoursesListPage } from "../CoursesListPage";

const mockApiClient = apiClient as unknown as {
  listCourses: ReturnType<typeof vi.fn>;
  searchCourses: ReturnType<typeof vi.fn>;
};

function makeCourse(id: string, title: string, status = "Published", createdById = "creator-1") {
  return {
    id,
    title,
    description: null,
    priceAmount: 0,
    priceCurrency: "USD",
    status,
    createdAt: "2025-01-01T00:00:00Z",
    publishedAt: "2025-01-02T00:00:00Z",
    createdById,
    tags: [],
  };
}

function makePagedResult<T>(items: T[], total?: number) {
  return {
    page: 1,
    pageSize: 20,
    total: total ?? items.length,
    items,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CoursesListPage />
    </MemoryRouter>
  );
}

describe("CoursesListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.listCourses.mockResolvedValue(makePagedResult([]));
    mockApiClient.searchCourses.mockResolvedValue(makePagedResult([]));
  });

  it("renders the Catalog masthead and Submit a course action", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /catalog/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit a course/i })).toBeInTheDocument();
  });

  it("shows empty state when no courses are returned", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
    });
  });

  it("renders course cards when courses are returned", async () => {
    mockApiClient.listCourses.mockResolvedValue(
      makePagedResult([
        makeCourse("c1", "TypeScript Basics"),
        makeCourse("c2", "React Advanced"),
      ])
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("TypeScript Basics")).toBeInTheDocument();
      expect(screen.getByText("React Advanced")).toBeInTheDocument();
    });
  });

  it("shows error detail when listCourses fails", async () => {
    mockApiClient.listCourses.mockRejectedValue({
      status: 500,
      title: "Server Error",
      detail: "Could not load courses",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Could not load courses/i)).toBeInTheDocument();
    });
  });

  it("navigates to /courses/new when the Submit a course action is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/nothing matches/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /submit a course/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/courses/new");
  });

  it("shows the status filter when not in search mode", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /^published$/i })).toBeInTheDocument();
    });
  });

  it("switches to search mode and calls searchCourses when text is typed", async () => {
    mockApiClient.searchCourses.mockResolvedValue(
      makePagedResult([makeCourse("c1", "TypeScript Search Result")])
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/find a course/i)).toBeInTheDocument();
    });

    await act(async () => {
      await user.type(screen.getByPlaceholderText(/find a course/i), "TypeScript");
      await new Promise((r) => setTimeout(r, 400));
    });

    await waitFor(() => {
      expect(mockApiClient.searchCourses).toHaveBeenCalledWith(
        expect.objectContaining({ q: "TypeScript" })
      );
    });
  });

  it("hides the status filter tabs when in search mode", async () => {
    const user = userEvent.setup();
    renderPage();

    await act(async () => {
      await user.type(screen.getByPlaceholderText(/find a course/i), "React");
      await new Promise((r) => setTimeout(r, 400));
    });

    await waitFor(() => {
      expect(screen.queryByRole("radio", { name: /my drafts/i })).not.toBeInTheDocument();
    });
  });

  it("shows no results message when search returns empty", async () => {
    mockApiClient.searchCourses.mockResolvedValue(makePagedResult([]));

    const user = userEvent.setup();
    renderPage();

    await act(async () => {
      await user.type(screen.getByPlaceholderText(/find a course/i), "xyz");
      await new Promise((r) => setTimeout(r, 400));
    });

    await waitFor(() => {
      expect(screen.getByText(/nothing matches/i)).toBeInTheDocument();
    });
  });

  it("renders pagination controls", async () => {
    mockApiClient.listCourses.mockResolvedValue(
      makePagedResult([makeCourse("c1", "TypeScript Basics")], 1)
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });
  });

  it("disables Previous on first page", async () => {
    mockApiClient.listCourses.mockResolvedValue(
      makePagedResult([makeCourse("c1", "TypeScript Basics")], 1)
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    });
  });

  it("marks courses owned by the current user", async () => {
    mockApiClient.listCourses.mockResolvedValue(
      makePagedResult([makeCourse("c1", "My Own Course", "Published", "user-1")])
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/yours/i)).toBeInTheDocument();
    });
  });
});
