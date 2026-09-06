import { renderHook, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useEnrolledCourses } from "../useEnrolledCourses";

// ---------------------------------------------------------------------------
// Mock the entire apiClient module
// ---------------------------------------------------------------------------
vi.mock("../../api/apiClient", () => ({
  apiClient: {
    getPurchasedCourses: vi.fn(),
    listLessons: vi.fn(),
    getCourseProgress: vi.fn(),
  },
}));

// Import the mock so we can configure return values in each test
import { apiClient } from "../../api/apiClient";
import type { CourseDto, LessonListItem, CourseProgressResponse, PagedResult } from "../../api/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCourse(id: string, title = `Course ${id}`): CourseDto {
  return {
    id,
    title,
    description: null,
    priceAmount: 0,
    priceCurrency: "USD",
    status: "Published",
    createdAt: "2025-01-01T00:00:00Z",
    publishedAt: "2025-01-02T00:00:00Z",
    createdById: "creator-1",
    tags: [],
  };
}

function makeLesson(id: string): LessonListItem {
  return {
    id,
    title: `Lesson ${id}`,
    isFreePreview: false,
    sortOrder: 1,
    createdAt: "2025-01-01T00:00:00Z",
  };
}

function makeProgress(completedLessonIds: string[]): CourseProgressResponse {
  return { completedLessonIds };
}

function makePagedResult<T>(items: T[]): PagedResult<T> {
  return { page: 1, pageSize: 100, total: items.length, items };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useEnrolledCourses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with loading=false and empty entries before reload is called", () => {
    const { result } = renderHook(() => useEnrolledCourses());
    expect(result.current.loading).toBe(false);
    expect(result.current.entries).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it("sets loading=true during fetch and loading=false after", async () => {
    let resolvePurchased!: (v: PagedResult<CourseDto>) => void;
    const pendingPurchased = new Promise<PagedResult<CourseDto>>(
      (resolve) => (resolvePurchased = resolve)
    );

    vi.mocked(apiClient.getPurchasedCourses).mockReturnValue(pendingPurchased);

    const { result } = renderHook(() => useEnrolledCourses());

    // Trigger the load
    result.current.reload();

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Resolve the promise
    resolvePurchased(makePagedResult([]));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("populates entries correctly on success with 2 courses", async () => {
    const course1 = makeCourse("c1", "TypeScript Basics");
    const course2 = makeCourse("c2", "React Advanced");

    vi.mocked(apiClient.getPurchasedCourses).mockResolvedValue(
      makePagedResult([course1, course2])
    );

    // course1: 3 lessons, 2 completed → 67%
    vi.mocked(apiClient.listLessons).mockImplementation((courseId: string) => {
      if (courseId === "c1") return Promise.resolve([makeLesson("l1"), makeLesson("l2"), makeLesson("l3")]);
      return Promise.resolve([makeLesson("l4"), makeLesson("l5")]);
    });

    vi.mocked(apiClient.getCourseProgress).mockImplementation((courseId: string) => {
      if (courseId === "c1") return Promise.resolve(makeProgress(["l1", "l2"]));
      return Promise.resolve(makeProgress(["l4"]));
    });

    const { result } = renderHook(() => useEnrolledCourses());
    result.current.reload();

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(2);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();

    const entry1 = result.current.entries[0];
    expect(entry1.course.id).toBe("c1");
    expect(entry1.totalLessons).toBe(3);
    expect(entry1.completedCount).toBe(2);
    expect(entry1.progressPct).toBe(67); // Math.round(2/3*100) = 67

    const entry2 = result.current.entries[1];
    expect(entry2.course.id).toBe("c2");
    expect(entry2.totalLessons).toBe(2);
    expect(entry2.completedCount).toBe(1);
    expect(entry2.progressPct).toBe(50); // Math.round(1/2*100) = 50
  });

  it("sets error and clears entries when getPurchasedCourses rejects", async () => {
    const apiError = { status: 401, title: "Unauthorized", detail: "You must be logged in" };
    vi.mocked(apiClient.getPurchasedCourses).mockRejectedValue(apiError);

    const { result } = renderHook(() => useEnrolledCourses());
    result.current.reload();

    await waitFor(() => {
      expect(result.current.error).toEqual(apiError);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.entries).toHaveLength(0);
  });

  it("calculates progressPct as 0 when totalLessons is 0", async () => {
    const course = makeCourse("c1", "Empty Course");
    vi.mocked(apiClient.getPurchasedCourses).mockResolvedValue(makePagedResult([course]));
    vi.mocked(apiClient.listLessons).mockResolvedValue([]); // no lessons
    vi.mocked(apiClient.getCourseProgress).mockResolvedValue(makeProgress([]));

    const { result } = renderHook(() => useEnrolledCourses());
    result.current.reload();

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.entries[0].totalLessons).toBe(0);
    expect(result.current.entries[0].completedCount).toBe(0);
    expect(result.current.entries[0].progressPct).toBe(0);
  });

  it("calculates progressPct correctly when all lessons are completed (100%)", async () => {
    const course = makeCourse("c1", "Full Course");
    vi.mocked(apiClient.getPurchasedCourses).mockResolvedValue(makePagedResult([course]));
    vi.mocked(apiClient.listLessons).mockResolvedValue([makeLesson("l1"), makeLesson("l2")]);
    vi.mocked(apiClient.getCourseProgress).mockResolvedValue(makeProgress(["l1", "l2"]));

    const { result } = renderHook(() => useEnrolledCourses());
    result.current.reload();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.entries[0].progressPct).toBe(100);
    });
  });

  it("clears previous error when reload is called again successfully", async () => {
    const apiError = { status: 500, title: "Server Error" };
    vi.mocked(apiClient.getPurchasedCourses).mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useEnrolledCourses());
    result.current.reload();

    await waitFor(() => {
      expect(result.current.error).toEqual(apiError);
    });

    // Now fix the mock and reload
    vi.mocked(apiClient.getPurchasedCourses).mockResolvedValue(makePagedResult([]));
    result.current.reload();

    // Wait for both loading=false AND error cleared (prevents resolving on stale loading=false)
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });
  });
});
