import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { NotFoundPage } from "../NotFoundPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>
  );
}

describe("NotFoundPage", () => {
  it("renders the 404 eyebrow", () => {
    renderPage();
    expect(screen.getByText(/error 404/i)).toBeInTheDocument();
  });

  it("renders the not-found headline", () => {
    renderPage();
    expect(screen.getByText(/no longer in print/i)).toBeInTheDocument();
  });

  it("renders a link back to the front page", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /back to the front page/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders a link to browse the catalog", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /browse the catalog/i });
    expect(link).toHaveAttribute("href", "/courses");
  });
});
