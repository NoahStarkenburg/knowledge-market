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
    useParams: () => ({ courseId: "course-1", lessonId: "lesson-1" }),
  };
});

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    getCourse: vi.fn(),
    getLessonMeta: vi.fn(),
    listLessonTexts: vi.fn(),
    listLessonAssets: vi.fn(),
    createLessonText: vi.fn(),
    uploadFile: vi.fn(),
    attachAsset: vi.fn(),
    updateLesson: vi.fn(),
    reorderLessonContent: vi.fn(),
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
  })),
}));

import { apiClient } from "../../../api/apiClient";
import { useAuth } from "../../../context/AuthContext";
import { LessonContentManagePage } from "../LessonContentManagePage";

const mockApiClient = apiClient as unknown as {
  getCourse: ReturnType<typeof vi.fn>;
  getLessonMeta: ReturnType<typeof vi.fn>;
  listLessonTexts: ReturnType<typeof vi.fn>;
  listLessonAssets: ReturnType<typeof vi.fn>;
  createLessonText: ReturnType<typeof vi.fn>;
  uploadFile: ReturnType<typeof vi.fn>;
  attachAsset: ReturnType<typeof vi.fn>;
  updateLesson: ReturnType<typeof vi.fn>;
  reorderLessonContent: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCourse(createdById = "owner-1") {
  return {
    id: "course-1",
    title: "TypeScript Basics",
    description: null,
    priceAmount: 0,
    priceCurrency: "USD",
    status: "Published",
    createdAt: "2025-01-01T00:00:00Z",
    publishedAt: null,
    createdById,
    tags: [],
  };
}

function makeLessonMeta() {
  return {
    id: "lesson-1",
    title: "Intro Lesson",
    isFreePreview: false,
    body: "This is the intro body",
  };
}

function makeLessonText(id = "text-1", title = "My Text Block") {
  return {
    id,
    lessonId: "lesson-1",
    title,
    bodyMarkdown: "# Hello",
    sortOrder: 1,
    createdAt: "2025-01-01T00:00:00Z",
  };
}

function makeLessonAsset(id = "asset-1", title = "My Asset") {
  return {
    id,
    title,
    sortOrder: 2,
    fileTitle: "file.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LessonContentManagePage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Setup default successful owner mocks
// ---------------------------------------------------------------------------
function setupOwnerMocks() {
  mockApiClient.getCourse.mockResolvedValue(makeCourse("owner-1"));
  mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
  mockApiClient.listLessonTexts.mockResolvedValue([]);
  mockApiClient.listLessonAssets.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LessonContentManagePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("renders the Manage Lesson Content heading", () => {
    mockApiClient.getCourse.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.getLessonMeta.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.listLessonTexts.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.listLessonAssets.mockReturnValue(new Promise(() => { /* never resolves */ }));

    renderPage();

    expect(screen.getByRole("heading", { name: /manage lesson content/i })).toBeInTheDocument();
  });

  it("shows loading spinner while data is being fetched", () => {
    mockApiClient.getCourse.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.getLessonMeta.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.listLessonTexts.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.listLessonAssets.mockReturnValue(new Promise(() => { /* never resolves */ }));

    renderPage();

    // LoadingSpinner renders "Loading..." text while in-flight
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows error detail when data loading fails", async () => {
    mockApiClient.getCourse.mockRejectedValue({
      status: 500,
      title: "Server Error",
      detail: "Database error",
    });
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.listLessonTexts.mockResolvedValue([]);
    mockApiClient.listLessonAssets.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Database error/i)).toBeInTheDocument();
    });
  });

  it("renders all content management sections for the owner", async () => {
    setupOwnerMocks();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/edit lesson/i)).toBeInTheDocument();
      expect(screen.getByText(/add text block/i)).toBeInTheDocument();
      expect(screen.getByText(/upload file/i)).toBeInTheDocument();
      // "Upload video" appears in both heading and button — use getAllByText
      expect(screen.getAllByText(/upload video/i).length).toBeGreaterThan(0);
    });
  });

  it("populates the lesson title from the loaded metadata", async () => {
    setupOwnerMocks();

    renderPage();

    await waitFor(() => {
      // The title input should have the loaded lesson title
      const titleInput = screen.getByDisplayValue("Intro Lesson");
      expect(titleInput).toBeInTheDocument();
    });
  });

  it("shows access denied Alert for non-owners", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "non-owner",
      email: "other@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });
    mockApiClient.getCourse.mockResolvedValue(makeCourse("owner-1")); // owner is owner-1, not non-owner
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.listLessonTexts.mockResolvedValue([]);
    mockApiClient.listLessonAssets.mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/you are not the owner of this course/i)
      ).toBeInTheDocument();
    });
  });

  it("calls apiClient.updateLesson when Save button is clicked", async () => {
    setupOwnerMocks();
    mockApiClient.updateLesson.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/edit lesson/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockApiClient.updateLesson).toHaveBeenCalledWith(
        "course-1",
        "lesson-1",
        expect.objectContaining({ title: "Intro Lesson" })
      );
    });
  });

  it("shows success message after Save", async () => {
    setupOwnerMocks();
    mockApiClient.updateLesson.mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/lesson updated/i)).toBeInTheDocument();
    });
  });

  it("calls apiClient.createLessonText when Add text form is submitted", async () => {
    setupOwnerMocks();
    mockApiClient.createLessonText.mockResolvedValue(makeLessonText());

    const user = userEvent.setup();
    renderPage();

    // Wait for the "Add text" button to become enabled (isOwner=true after load)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add text/i })).not.toBeDisabled();
    });

    // Fill the required title field — find the input inside the "Add text block" section
    // The "Add text block" heading is an h2; its parent card contains the form with the title input
    const addTextHeading = screen.getByRole("heading", { name: /add text block/i });
    const form = addTextHeading.closest("div")?.querySelector("form");
    const titleInput = form?.querySelector("input") as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    await user.type(titleInput!, "New Text Block Title");

    await user.click(screen.getByRole("button", { name: /add text/i }));

    await waitFor(() => {
      expect(mockApiClient.createLessonText).toHaveBeenCalledWith(
        "course-1",
        "lesson-1",
        expect.objectContaining({ title: "New Text Block Title" })
      );
    });
  });

  it("shows No content yet when combinedItems is empty", async () => {
    setupOwnerMocks();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no content yet/i)).toBeInTheDocument();
    });
  });

  it("renders text blocks and assets in the current content order list", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse("owner-1"));
    mockApiClient.getLessonMeta.mockResolvedValue(makeLessonMeta());
    mockApiClient.listLessonTexts.mockResolvedValue([makeLessonText("t1", "My Text Block")]);
    mockApiClient.listLessonAssets.mockResolvedValue([makeLessonAsset("a1", "My Asset File")]);

    renderPage();

    // Wait for loading to finish first
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // The content order list renders items as "1. Title" — use regex match
    await waitFor(() => {
      expect(screen.getByText(/My Text Block/)).toBeInTheDocument();
      expect(screen.getByText(/My Asset File/)).toBeInTheDocument();
    });
  });

  it("shows error when createLessonText fails", async () => {
    setupOwnerMocks();
    mockApiClient.createLessonText.mockRejectedValue({
      status: 422,
      title: "Validation Error",
      detail: "Server rejected the text block",
    });

    const user = userEvent.setup();
    renderPage();

    // Wait for the "Add text" button to become enabled (isOwner=true after load)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add text/i })).not.toBeDisabled();
    });

    // Fill the required title field to pass HTML5 validation
    const addTextHeading = screen.getByRole("heading", { name: /add text block/i });
    const form = addTextHeading.closest("div")?.querySelector("form");
    const titleInput = form?.querySelector("input") as HTMLInputElement | null;
    expect(titleInput).not.toBeNull();
    await user.type(titleInput!, "Some Title");

    await user.click(screen.getByRole("button", { name: /add text/i }));

    await waitFor(() => {
      expect(screen.getByText(/Server rejected the text block/i)).toBeInTheDocument();
    });
  });

  it("renders Back to lesson link", () => {
    mockApiClient.getCourse.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.getLessonMeta.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.listLessonTexts.mockReturnValue(new Promise(() => { /* never resolves */ }));
    mockApiClient.listLessonAssets.mockReturnValue(new Promise(() => { /* never resolves */ }));

    renderPage();

    expect(screen.getByRole("link", { name: /view lesson/i })).toBeInTheDocument();
  });
});
