import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom — keep Link/MemoryRouter, mock useParams
// ---------------------------------------------------------------------------
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ courseId: "course-1" }),
  };
});

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    getCourse: vi.fn(),
    listLessons: vi.fn(),
    createLesson: vi.fn(),
    createLessonText: vi.fn(),
    deleteLesson: vi.fn(),
    getLessonContent: vi.fn(),
    reorderLessons: vi.fn(),
    getInlineUrl: vi.fn(() => "http://localhost/inline"),
    getDownloadUrl: vi.fn(() => "http://localhost/download"),
  },
}));

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
    displayName: null,
    updateDisplayName: vi.fn(),
  })),
}));

import { apiClient } from "../../../api/apiClient";
import { useAuth } from "../../../context/AuthContext";
import { LessonListPage } from "../LessonListPage";

const mockApiClient = apiClient as unknown as {
  getCourse: ReturnType<typeof vi.fn>;
  listLessons: ReturnType<typeof vi.fn>;
  createLesson: ReturnType<typeof vi.fn>;
  createLessonText: ReturnType<typeof vi.fn>;
  deleteLesson: ReturnType<typeof vi.fn>;
  getLessonContent: ReturnType<typeof vi.fn>;
  reorderLessons: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCourse(createdById = "creator-1") {
  return {
    id: "course-1",
    title: "TypeScript Basics",
    description: null,
    priceAmount: 49,
    priceCurrency: "USD",
    status: "Published",
    createdAt: "2025-01-01T00:00:00Z",
    publishedAt: "2025-01-02T00:00:00Z",
    createdById,
    tags: [],
  };
}

function makeLesson(id: string, title: string, isFreePreview = false, sortOrder = 1) {
  return {
    id,
    title,
    isFreePreview,
    sortOrder,
    createdAt: "2025-01-01T00:00:00Z",
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LessonListPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LessonListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: non-owner
    vi.mocked(useAuth).mockReturnValue({
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
    });
  });

  it("renders the Lessons heading", () => {
    mockApiClient.getCourse.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.listLessons.mockReturnValue(new Promise(() => { /* never resolves */ }));

    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: /^lessons$/i })).toBeInTheDocument();
  });

  it("shows empty state when no lessons are returned", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());
    mockApiClient.listLessons.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no lessons yet/i)).toBeInTheDocument();
    });
  });

  it("shows error detail when getCourse rejects", async () => {
    mockApiClient.getCourse.mockRejectedValue({
      status: 500,
      title: "Server Error",
      detail: "Could not load course",
    });
    mockApiClient.listLessons.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Could not load course/i)).toBeInTheDocument();
    });
  });

  it("renders lesson titles after loading", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());
    mockApiClient.listLessons.mockResolvedValue([
      makeLesson("l1", "Introduction", false, 1),
      makeLesson("l2", "Advanced Topics", false, 2),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Introduction")).toBeInTheDocument();
      expect(screen.getByText("Advanced Topics")).toBeInTheDocument();
    });
  });

  it("shows New Lesson form for course owner", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "owner-1",
      email: "owner@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });
    mockApiClient.getCourse.mockResolvedValue(makeCourse("owner-1"));
    mockApiClient.listLessons.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/new lesson/i)).toBeInTheDocument();
    });
  });

  it("does not show New Lesson form for non-owners", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse("other-user"));
    mockApiClient.listLessons.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no lessons yet/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/new lesson/i)).not.toBeInTheDocument();
  });

  it("calls apiClient.createLesson when owner submits the New Lesson form", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "owner-1",
      email: "owner@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });
    mockApiClient.getCourse.mockResolvedValue(makeCourse("owner-1"));
    mockApiClient.listLessons.mockResolvedValue([]);
    mockApiClient.createLesson.mockResolvedValue({ id: "new-lesson-1" });
    mockApiClient.createLessonText.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/new lesson/i)).toBeInTheDocument();
    });

    // Fill the title field (first input labeled "Title" in the form)
    const titleInputs = screen.getAllByRole("textbox");
    await user.type(titleInputs[0], "My New Lesson");

    await user.click(screen.getByRole("button", { name: /create lesson/i }));

    await waitFor(() => {
      expect(mockApiClient.createLesson).toHaveBeenCalledWith(
        "course-1",
        expect.objectContaining({ title: "My New Lesson" })
      );
    });
  });

  it("shows Delete button for owner lessons", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "owner-1",
      email: "owner@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });
    mockApiClient.getCourse.mockResolvedValue(makeCourse("owner-1"));
    mockApiClient.listLessons.mockResolvedValue([makeLesson("l1", "Intro")]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });

  it("shows Manage button for owner lessons", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "owner-1",
      email: "owner@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });
    mockApiClient.getCourse.mockResolvedValue(makeCourse("owner-1"));
    mockApiClient.listLessons.mockResolvedValue([makeLesson("l1", "Intro")]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /manage/i })).toBeInTheDocument();
    });
  });

  it("shows expand/collapse button for each lesson", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());
    mockApiClient.listLessons.mockResolvedValue([makeLesson("l1", "Intro")]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
    });
  });

  it("shows locked message when lesson content returns 403", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());
    mockApiClient.listLessons.mockResolvedValue([makeLesson("l1", "Locked Lesson")]);
    mockApiClient.getLessonContent.mockRejectedValue({ status: 403, title: "Forbidden" });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Locked Lesson")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /expand/i }));

    await waitFor(() => {
      expect(screen.getByText(/this lesson is locked/i)).toBeInTheDocument();
    });
  });

  it("shows Free preview label for free preview lessons", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());
    mockApiClient.listLessons.mockResolvedValue([makeLesson("l1", "Free Lesson", true)]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/free preview/i)).toBeInTheDocument();
    });
  });

  it("renders Back to course link", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());
    mockApiClient.listLessons.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /back to course/i })).toBeInTheDocument();
    });
  });
});
