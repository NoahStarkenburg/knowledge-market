// src/pages/Profile/EnrolledCourseCard.test.tsx

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { EnrolledCourseCard } from "./EnrolledCourseCard";
import type { EnrolledCourseProgress, CourseDto } from "../../api/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCourse(id: string, title: string): CourseDto {
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

function makeEntry(
  courseId: string,
  courseTitle: string,
  totalLessons: number,
  completedCount: number,
  progressPct: number
): EnrolledCourseProgress {
  return {
    course: makeCourse(courseId, courseTitle),
    totalLessons,
    completedCount,
    progressPct,
  };
}

function renderCard(entry: EnrolledCourseProgress) {
  return render(
    <MemoryRouter>
      <EnrolledCourseCard entry={entry} />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EnrolledCourseCard", () => {
  it("renders the course title", () => {
    renderCard(makeEntry("course-1", "TypeScript Fundamentals", 5, 3, 60));
    expect(screen.getByText("TypeScript Fundamentals")).toBeInTheDocument();
  });

  it("renders 'X / Y lessons' text", () => {
    renderCard(makeEntry("course-2", "React Deep Dive", 8, 4, 50));
    expect(screen.getByText("4 / 8 lessons")).toBeInTheDocument();
  });

  it("renders the progress percentage text", () => {
    renderCard(makeEntry("course-3", "Node Mastery", 10, 7, 70));
    expect(screen.getByText("70%")).toBeInTheDocument();
  });

  it("renders the progress bar with correct width style", () => {
    renderCard(makeEntry("course-4", "Go for Beginners", 4, 1, 25));

    // The progress bar is a div with style width: 25%
    const progressBar = document.querySelector("[style*='width']");
    expect(progressBar).not.toBeNull();
    expect((progressBar as HTMLElement).style.width).toBe("25%");
  });

  it("renders the course title as a link to /courses/{id}/lessons", () => {
    renderCard(makeEntry("abc-123", "Advanced CSS", 3, 0, 0));
    const link = screen.getByRole("link", { name: "Advanced CSS" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/courses/abc-123/lessons");
  });

  it("renders progress bar with 0% width when no lessons completed", () => {
    renderCard(makeEntry("course-5", "Empty Course", 0, 0, 0));
    const progressBar = document.querySelector("[style*='width']");
    expect((progressBar as HTMLElement).style.width).toBe("0%");
  });

  it("renders progress bar with 100% width when all lessons completed", () => {
    renderCard(makeEntry("course-6", "Completed Course", 5, 5, 100));
    const progressBar = document.querySelector("[style*='width']");
    expect((progressBar as HTMLElement).style.width).toBe("100%");
  });

  it("renders '0 / 0 lessons' when course has no lessons", () => {
    renderCard(makeEntry("course-7", "No Lessons Course", 0, 0, 0));
    expect(screen.getByText("0 / 0 lessons")).toBeInTheDocument();
  });
});
