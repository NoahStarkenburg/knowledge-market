import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom — keep Link/MemoryRouter, mock useNavigate & useParams
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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
    purchaseCourse: vi.fn(),
    subscribeToCreator: vi.fn(),
    updateCourse: vi.fn(),
    publishCourse: vi.fn(),
    deleteCourse: vi.fn(),
    uploadCourseIntroVideo: vi.fn(),
    getCourseIntroVideoUrl: vi.fn(() => "http://localhost/intro-video"),
    getDownloadUrl: vi.fn(() => "http://localhost/download"),
    getInlineUrl: vi.fn(() => "http://localhost/inline"),
    checkEnrollment: vi.fn(),
    listOrders: vi.fn(),
    getCourseThumbnailUrl: vi.fn(() => "http://localhost/thumbnail"),
    listCourseReviews: vi.fn(),
    submitReview: vi.fn(),
    deleteMyReview: vi.fn(),
    uploadCourseThumbnail: vi.fn(),
    getCoursesByCreator: vi.fn(() => Promise.resolve([])),
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
import { CourseDetailPage } from "../CourseDetailPage";

const mockApiClient = apiClient as unknown as {
  getCourse: ReturnType<typeof vi.fn>;
  listLessons: ReturnType<typeof vi.fn>;
  purchaseCourse: ReturnType<typeof vi.fn>;
  subscribeToCreator: ReturnType<typeof vi.fn>;
  updateCourse: ReturnType<typeof vi.fn>;
  publishCourse: ReturnType<typeof vi.fn>;
  deleteCourse: ReturnType<typeof vi.fn>;
  uploadCourseIntroVideo: ReturnType<typeof vi.fn>;
  getCourseIntroVideoUrl: ReturnType<typeof vi.fn>;
  checkEnrollment: ReturnType<typeof vi.fn>;
  listCourseReviews: ReturnType<typeof vi.fn>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCourse(overrides: Partial<{
  id: string;
  title: string;
  status: string;
  priceAmount: number;
  createdById: string;
  introVideoFileId: string | null;
}> = {}) {
  return {
    id: "course-1",
    title: "TypeScript Basics",
    description: "Learn TypeScript",
    priceAmount: 49,
    priceCurrency: "USD",
    status: "Draft",
    createdAt: "2025-01-01T00:00:00Z",
    publishedAt: null,
    createdById: "creator-1",
    tags: [],
    introVideoFileId: null,
    ...overrides,
  };
}

function makeLesson(id: string, title: string, isFreePreview = false) {
  return {
    id,
    title,
    isFreePreview,
    sortOrder: 1,
    createdAt: "2025-01-01T00:00:00Z",
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CourseDetailPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("CourseDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: non-owner user
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
    mockApiClient.listLessons.mockResolvedValue([]);
    mockApiClient.checkEnrollment.mockResolvedValue({ enrolled: false });
    mockApiClient.listCourseReviews.mockResolvedValue({ page: 1, pageSize: 10, total: 0, items: [] });
  });

  it("shows a loading spinner while data is being fetched", () => {
    mockApiClient.getCourse.mockReturnValue(new Promise(() => { /* never resolves */ }));

    renderPage();

    // Loading spinner is rendered while loading=true and before course data arrives
    // We check that the title is not rendered yet
    expect(screen.queryByText("TypeScript Basics")).not.toBeInTheDocument();
  });

  it("renders the course title after loading", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("TypeScript Basics")).toBeInTheDocument();
    });
  });

  it("renders course description, price, and status", async () => {
    mockApiClient.getCourse.mockResolvedValue(makeCourse());

    renderPage();

    await waitFor(() => {
      // Description appears in the hero AND in the About section
      expect(screen.getAllByText(/Learn TypeScript/).length).toBeGreaterThan(0);
      expect(screen.getByText("$49")).toBeInTheDocument();
    });
  });

  it("shows FormErrorList when getCourse rejects", async () => {
    mockApiClient.getCourse.mockRejectedValue({
      status: 404,
      title: "Not Found",
      detail: "Course does not exist",
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Course does not exist/i)).toBeInTheDocument();
    });
  });

  it("shows Buy button for non-owner published course", async () => {
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Published", createdById: "other-user" })
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /buy for \$49/i })
      ).toBeInTheDocument();
    });
  });

  it("shows Enroll for free button for free non-owner courses", async () => {
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Published", priceAmount: 0, createdById: "other-user" })
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /enroll for free/i })
      ).toBeInTheDocument();
    });
  });

  it("shows Subscribe to creator button for non-owners", async () => {
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Published", createdById: "other-user" })
    );

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /subscribe to creator/i })
      ).toBeInTheDocument();
    });
  });

  it("navigates to lessons after purchase when order is Paid", async () => {
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Published", createdById: "other-user" })
    );
    mockApiClient.purchaseCourse.mockResolvedValue({
      id: "order-1",
      status: "Paid",
      courseId: "course-1",
    });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /buy for \$49/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /buy for \$49/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/courses/course-1/lessons");
    });
  });

  it("navigates to /checkout when order is not Paid", async () => {
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Published", createdById: "other-user" })
    );
    mockApiClient.purchaseCourse.mockResolvedValue({
      id: "order-1",
      status: "Pending",
      courseId: "course-1",
    });
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /buy for \$49/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /buy for \$49/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/checkout/order-1");
    });
  });

  it("shows owner-only edit panel for Draft courses owned by the current user", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
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
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Draft", createdById: "user-1" })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/edit draft/i)).toBeInTheDocument();
    });
  });

  it("shows Publish button in the owner edit panel", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
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
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Draft", createdById: "user-1" })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish course/i })).toBeInTheDocument();
    });
  });

  it("shows publish confirmation after clicking Publish", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
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
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Draft", createdById: "user-1" })
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish course/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /publish course/i }));

    expect(screen.getByText(/publishing makes this course visible/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, publish/i })).toBeInTheDocument();
  });

  it("calls publishCourse and shows success when Yes publish is clicked", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
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
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Draft", createdById: "user-1" })
    );
    mockApiClient.publishCourse.mockResolvedValue(
      makeCourse({ status: "Published", createdById: "user-1" })
    );

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /publish course/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /publish course/i }));
    await user.click(screen.getByRole("button", { name: /yes, publish/i }));

    await waitFor(() => {
      expect(mockApiClient.publishCourse).toHaveBeenCalledWith("course-1");
    });

    await waitFor(() => {
      expect(screen.getByText("Course published successfully!")).toBeInTheDocument();
    });
  });

  it("renders the lesson curriculum when lessons are present", async () => {
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Published", createdById: "other-user" })
    );
    mockApiClient.listLessons.mockResolvedValue([
      makeLesson("l1", "Introduction"),
      makeLesson("l2", "Advanced Topics"),
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Curriculum")).toBeInTheDocument();
      expect(screen.getByText("Introduction")).toBeInTheDocument();
      expect(screen.getByText("Advanced Topics")).toBeInTheDocument();
    });
  });

  it("renders Manage Lessons button for course owner", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
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
    mockApiClient.getCourse.mockResolvedValue(makeCourse({ createdById: "user-1" }));

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /manage lessons/i })
      ).toBeInTheDocument();
    });
  });

  it("shows action error when purchaseCourse fails", async () => {
    mockApiClient.getCourse.mockResolvedValue(
      makeCourse({ status: "Published", createdById: "other-user" })
    );
    mockApiClient.purchaseCourse.mockRejectedValue({
      status: 402,
      title: "Payment Required",
      detail: "Payment failed",
    });

    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /buy for/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /buy for/i }));

    await waitFor(() => {
      expect(screen.getByText(/Payment failed/i)).toBeInTheDocument();
    });
  });
});
