import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

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

// ---------------------------------------------------------------------------
// Mock EnrolledCourseCard
// ---------------------------------------------------------------------------
vi.mock("../../Profile/EnrolledCourseCard", () => ({
  EnrolledCourseCard: ({ entry }: { entry: { course: { id: string; title: string } } }) => (
    <div data-testid={`enrolled-card-${entry.course.id}`}>{entry.course.title}</div>
  ),
}));

import { useEnrolledCourses } from "../../../hooks/useEnrolledCourses";
import { LearningSection } from "../LearningSection";

function renderSection() {
  return render(
    <MemoryRouter>
      <LearningSection />
    </MemoryRouter>
  );
}

describe("LearningSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEnrolledCourses).mockReturnValue({
      entries: [],
      loading: false,
      error: undefined,
      reload: mockReload,
    });
  });

  it("renders the My Learning heading", () => {
    renderSection();
    expect(screen.getByText("My Learning")).toBeInTheDocument();
  });

  it("calls reload on mount", () => {
    renderSection();
    expect(mockReload).toHaveBeenCalled();
  });

  it("shows loading spinner while loading", () => {
    vi.mocked(useEnrolledCourses).mockReturnValue({
      entries: [],
      loading: true,
      error: undefined,
      reload: mockReload,
    });
    renderSection();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty state when no enrolled courses", () => {
    renderSection();
    expect(screen.getByText("No enrolled courses yet")).toBeInTheDocument();
    expect(screen.getByText("Browse courses")).toBeInTheDocument();
  });

  it("renders enrolled course cards when entries exist", () => {
    vi.mocked(useEnrolledCourses).mockReturnValue({
      entries: [
        {
          course: {
            id: "c1",
            title: "TypeScript Basics",
            priceAmount: 0,
            priceCurrency: "USD",
            status: "Published",
            createdAt: "2025-01-01",
            publishedAt: "2025-01-02",
            createdById: "u1",
            tags: [],
          },
          totalLessons: 5,
          completedCount: 2,
          progressPct: 40,
        },
      ],
      loading: false,
      error: undefined,
      reload: mockReload,
    });
    renderSection();
    expect(screen.getByTestId("enrolled-card-c1")).toBeInTheDocument();
    expect(screen.getByText("TypeScript Basics")).toBeInTheDocument();
  });

  it("shows error when hook returns error", () => {
    vi.mocked(useEnrolledCourses).mockReturnValue({
      entries: [],
      loading: false,
      error: { status: 500, detail: "Failed to load courses" },
      reload: mockReload,
    });
    renderSection();
    expect(screen.getByText(/failed to load courses/i)).toBeInTheDocument();
  });
});
