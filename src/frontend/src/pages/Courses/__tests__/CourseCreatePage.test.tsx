import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom — keep Link/MemoryRouter working, mock useNavigate
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
    createCourse: vi.fn(),
  },
}));

import { apiClient } from "../../../api/apiClient";
import { CourseCreatePage } from "../CourseCreatePage";

const mockApiClient = apiClient as unknown as { createCourse: ReturnType<typeof vi.fn> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCourse(id = "course-1") {
  return {
    id,
    title: "New Course",
    description: null,
    priceAmount: 0,
    priceCurrency: "USD",
    status: "Draft",
    createdAt: "2025-01-01T00:00:00Z",
    publishedAt: null,
    createdById: "user-1",
    tags: [],
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CourseCreatePage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("CourseCreatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the course creation form", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /create course/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/price amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^create$/i })).toBeInTheDocument();
  });

  it("calls apiClient.createCourse with form values on submit", async () => {
    mockApiClient.createCourse.mockResolvedValue(makeCourse());
    const user = userEvent.setup();
    renderPage();

    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), "My Course");
    await user.clear(screen.getByLabelText(/currency/i));
    await user.type(screen.getByLabelText(/currency/i), "USD");

    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockApiClient.createCourse).toHaveBeenCalledWith(
        expect.objectContaining({ title: "My Course" })
      );
    });
  });

  it("navigates to the course detail page after successful creation", async () => {
    mockApiClient.createCourse.mockResolvedValue(makeCourse("course-abc"));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Course");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/courses/course-abc");
    });
  });

  it("shows error detail when apiClient.createCourse rejects", async () => {
    mockApiClient.createCourse.mockRejectedValue({
      status: 422,
      title: "Validation Error",
      detail: "Title is required",
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "Bad");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
    });
  });

  it("disables the submit button while the request is in-flight", async () => {
    let resolve!: (v: ReturnType<typeof makeCourse>) => void;
    mockApiClient.createCourse.mockReturnValue(
      new Promise((r) => (resolve = r))
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Course");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating/i })).toBeDisabled();
    });

    resolve(makeCourse());
  });

  it("does not navigate when creation fails", async () => {
    mockApiClient.createCourse.mockRejectedValue({ status: 500, title: "Error" });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/title/i), "My Course");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(mockApiClient.createCourse).toHaveBeenCalledTimes(1);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
