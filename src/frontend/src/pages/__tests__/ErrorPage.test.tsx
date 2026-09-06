import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";

const mockUseRouteError = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useRouteError: () => mockUseRouteError(),
    isRouteErrorResponse: actual.isRouteErrorResponse,
  };
});

import { ErrorPage } from "../ErrorPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ErrorPage />
    </MemoryRouter>
  );
}

describe("ErrorPage", () => {
  it("renders the something-went-wrong headline", () => {
    mockUseRouteError.mockReturnValue(new Error("Test error"));
    renderPage();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it("renders the error message from a thrown Error", () => {
    mockUseRouteError.mockReturnValue(new Error("Test error message"));
    renderPage();
    expect(screen.getByText("Test error message")).toBeInTheDocument();
  });

  it("renders fallback message for non-Error objects", () => {
    mockUseRouteError.mockReturnValue("string error");
    renderPage();
    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });

  it("renders a back-to-front-page link", () => {
    mockUseRouteError.mockReturnValue(new Error("fail"));
    renderPage();
    const link = screen.getByRole("link", { name: /back to the front page/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders a reload button", () => {
    mockUseRouteError.mockReturnValue(new Error("fail"));
    renderPage();
    expect(screen.getByRole("button", { name: /reload this page/i })).toBeInTheDocument();
  });
});
