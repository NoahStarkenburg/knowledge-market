import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    getFeaturedCourses: vi.fn(),
    getCatalogStats: vi.fn(),
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    isAdmin: false,
    roles: [],
    userId: null,
    email: null,
    isEmailVerified: false,
    login: vi.fn(),
    logout: vi.fn(),
    resendVerification: vi.fn(),
    deleteAccount: vi.fn(),
    markEmailVerified: vi.fn(),
    displayName: null,
    updateDisplayName: vi.fn(),
  })),
}));

import { apiClient } from "../../api/apiClient";
import { LandingPage } from "../LandingPage";

const mockedApi = vi.mocked(apiClient);

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe("LandingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getFeaturedCourses.mockResolvedValue([
      {
        id: "c1",
        title: "Building Resilient Systems with .NET 9",
        description: "Patterns that keep services up under load.",
        priceAmount: 89,
        priceCurrency: "USD",
        status: "Published",
        createdAt: "2026-06-20T00:00:00Z",
        publishedAt: "2026-06-22T00:00:00Z",
        createdById: "u1",
        tags: ["Development"],
        thumbnailFileId: null,
        introVideoFileId: null,
      },
    ]);
    mockedApi.getCatalogStats.mockResolvedValue({
      publishedCourses: 12,
      creators: 4,
    });
  });

  it("renders the editorial hero headline", () => {
    renderPage();
    expect(
      screen.getByText(/taught by people who do the work/i)
    ).toBeInTheDocument();
  });

  it("renders the brand wordmark", () => {
    renderPage();
    expect(screen.getAllByText(/Knowledge/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Market/i).length).toBeGreaterThan(0);
  });

  it("renders the Just added section", () => {
    renderPage();
    expect(screen.getByText(/Just added/i)).toBeInTheDocument();
    expect(screen.getByText(/Fresh off the press/i)).toBeInTheDocument();
  });

  it("renders the Featured section", () => {
    renderPage();
    expect(screen.getByText(/Picked by hand, not by an algorithm/i)).toBeInTheDocument();
  });

  it("renders the teach-creators section", () => {
    renderPage();
    expect(
      screen.getByText(/Get paid for what you already know/i)
    ).toBeInTheDocument();
  });

  it("fetches featured courses and stats on mount", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockedApi.getFeaturedCourses).toHaveBeenCalled();
      expect(mockedApi.getCatalogStats).toHaveBeenCalled();
    });
  });

  it("renders fetched courses after load", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getAllByText(/Building Resilient Systems with \.NET 9/i).length
      ).toBeGreaterThan(0);
    });
  });

  it("renders empty state when no courses are returned", async () => {
    mockedApi.getFeaturedCourses.mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText(/catalog is still being assembled/i)
      ).toBeInTheDocument();
    });
  });
});
