import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom — keep Link/MemoryRouter, mock useParams
// ---------------------------------------------------------------------------
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => ({ courseId: "course-1", lessonId: "lesson-1" }),
  };
});

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    getLessonMeta: vi.fn(),
    getLessonContent: vi.fn(),
    listLessons: vi.fn(),
    getCourseProgress: vi.fn(),
    getCourse: vi.fn(),
    checkEnrollment: vi.fn(),
    markLessonComplete: vi.fn(),
    unmarkLessonComplete: vi.fn(),
    getDownloadUrl: vi.fn(() => "http://localhost/download"),
    getInlineUrl: vi.fn(() => "http://localhost/inline"),
  },
}));

vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ userId: null, isAuthenticated: false }),
}));

import { apiClient } from "../../../api/apiClient";
import { LessonViewPage } from "../LessonViewPage";

const mockApiClient = apiClient as unknown as {
  getLessonMeta: ReturnType<typeof vi.fn>;
  getLessonContent: ReturnType<typeof vi.fn>;
  listLessons: ReturnType<typeof vi.fn>;
  getCourseProgress: ReturnType<typeof vi.fn>;
  getCourse: ReturnType<typeof vi.fn>;
  checkEnrollment: ReturnType<typeof vi.fn>;
  markLessonComplete: ReturnType<typeof vi.fn>;
  unmarkLessonComplete: ReturnType<typeof vi.fn>;
  getDownloadUrl: ReturnType<typeof vi.fn>;
  getInlineUrl: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeLessonMeta(overrides: Partial<{
  id: string;
  title: string;
  isFreePreview: boolean;
  body: string | null;
}> = {}) {
  return {
    id: "lesson-1",
    title: "Introduction to TypeScript",
    isFreePreview: true,
    body: "Welcome to the lesson!",
    ...overrides,
  };
}

function makeTextItem(id = "text-1", title = "Section 1", text = "Hello World") {
  return {
    id,
    kind: "text" as const,
    title,
    text,
    sortOrder: 1,
    createdAt: "2025-01-01T00:00:00Z",
  };
}

function makeFileItem(
  id = "file-1",
  title = "My File",
  mimeType = "application/pdf",
  contentFileId = "cfile-1"
) {
  return {
    id,
    kind: "file" as const,
    title,
    mimeType,
    contentFileId,
    sortOrder: 2,
    createdAt: "2025-01-01T00:00:00Z",
    fileSize: 1024,
    fileTitle: "My File.pdf",
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LessonViewPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LessonViewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no other lessons, no progress — keeps existing tests unaffected
    mockApiClient.listLessons.mockResolvedValue([]);
    mockApiClient.getCourseProgress.mockResolvedValue({ completedLessonIds: [] });
    mockApiClient.getCourse.mockResolvedValue({ id: "course-1", createdById: "other-user" });
    mockApiClient.checkEnrollment.mockResolvedValue({ enrolled: false });
    mockApiClient.markLessonComplete.mockResolvedValue(undefined);
    mockApiClient.unmarkLessonComplete.mockResolvedValue(undefined);
  });

  it("renders the Back to lessons link", () => {
    mockApiClient.getLessonMeta.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.getLessonContent.mockReturnValue(new Promise(() => { /* never resolves */ }));

    renderPage();

    expect(screen.getByRole("link", { name: /back to lessons/i })).toBeInTheDocument();
  });

  it("renders the lesson title after loading", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Introduction to TypeScript")).toBeInTheDocument();
    });
  });

  it("renders the lesson body text", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Welcome to the lesson!")).toBeInTheDocument();
    });
  });

  it("shows error when getLessonMeta rejects with a non-auth error", async () => {
    mockApiClient.getLessonMeta.mockRejectedValue({
      status: 500,
      title: "Server Error",
      detail: "Lesson not found",
    });
    mockApiClient.getLessonContent.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Lesson not found/i)).toBeInTheDocument();
    });
  });

  it("shows access denied Alert when content returns 403", async () => {
    mockApiClient.getLessonMeta.mockRejectedValue({
      status: 403,
      title: "Forbidden",
      detail: "Access denied",
    });

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/you don't have access to this lesson/i)
      ).toBeInTheDocument();
    });
  });

  it("shows login prompt Alert when content returns 401", async () => {
    mockApiClient.getLessonMeta.mockRejectedValue({
      status: 401,
      title: "Unauthorized",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/please log in to view this lesson/i)).toBeInTheDocument();
    });
  });

  it("renders text content items in the lesson", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([makeTextItem()]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Section 1")).toBeInTheDocument();
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });
  });

  it("renders Lesson content heading when items are present", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([makeTextItem()]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/lesson content/i)).toBeInTheDocument();
    });
  });

  it("does not render Lesson content section when no items", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/lesson content/i)).not.toBeInTheDocument();
    });
  });

  it("renders Download button for file items", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([makeFileItem()]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
    });
  });

  it("shows Free preview label for free preview lessons", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta({ isFreePreview: true }));
    mockApiClient.getLessonContent.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/free preview/i)).toBeInTheDocument();
    });
  });

  it("shows Members only label for non-free lessons", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(
      makeLessonMeta({ isFreePreview: false })
    );
    mockApiClient.getLessonContent.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/members only/i)).toBeInTheDocument();
    });
  });

  it("renders Back to lessons link", () => {
    mockApiClient.getLessonMeta.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.getLessonContent.mockReturnValue(new Promise(() => { /* never resolves */ }));

    renderPage();

    expect(screen.getByRole("link", { name: /back to lessons/i })).toBeInTheDocument();
  });

  it("shows Mark complete button when lesson is not completed", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([]);
    mockApiClient.getCourseProgress.mockResolvedValue({ completedLessonIds: [] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /mark complete/i })).toBeInTheDocument();
    });
  });

  it("shows Completed button when lesson is already completed", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([]);
    mockApiClient.getCourseProgress.mockResolvedValue({ completedLessonIds: ["lesson-1"] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /completed/i })).toBeInTheDocument();
    });
  });

  it("renders prev/next links when lesson list is provided", async () => {
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.getLessonContent.mockResolvedValue([]);
    mockApiClient.listLessons.mockResolvedValue([
      { id: "lesson-0", title: "Intro", isFreePreview: true, sortOrder: 0, createdAt: "2025-01-01T00:00:00Z" },
      { id: "lesson-1", title: "Introduction to TypeScript", isFreePreview: true, sortOrder: 1, createdAt: "2025-01-01T00:00:00Z" },
      { id: "lesson-2", title: "Advanced Types", isFreePreview: false, sortOrder: 2, createdAt: "2025-01-01T00:00:00Z" },
    ]);

    renderPage();

    await waitFor(() => {
      // Prev nav link contains "Previous" label + lesson title
      expect(screen.getByRole("link", { name: /previous.*intro/i })).toBeInTheDocument();
      // Next nav link contains "Next" label + lesson title
      expect(screen.getByRole("link", { name: /next.*advanced types/i })).toBeInTheDocument();
    });
  });
});
