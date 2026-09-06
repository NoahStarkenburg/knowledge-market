import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom
// ---------------------------------------------------------------------------
const mockUseParams = vi.fn<() => Record<string, string | undefined>>(() => ({ section: "overview" }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useParams: () => mockUseParams(),
    useNavigate: () => vi.fn(),
  };
});

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
    displayName: "Test User",
    updateDisplayName: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock all section components to isolate SettingsPage logic
// ---------------------------------------------------------------------------
vi.mock("../OverviewSection", () => ({
  OverviewSection: () => <div data-testid="overview-section" />,
}));
vi.mock("../DashboardSection", () => ({
  DashboardSection: () => <div data-testid="dashboard-section" />,
}));
vi.mock("../LearningSection", () => ({
  LearningSection: () => <div data-testid="learning-section" />,
}));
vi.mock("../CreatorSection", () => ({
  CreatorSection: () => <div data-testid="creator-section" />,
}));
vi.mock("../OrdersSection", () => ({
  OrdersSection: () => <div data-testid="orders-section" />,
}));
vi.mock("../AccountSection", () => ({
  AccountSection: () => <div data-testid="account-section" />,
}));

import { SettingsPage } from "../SettingsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({ section: "overview" });
  });

  it("renders the sidebar with all nav items", () => {
    renderPage();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Learning")).toBeInTheDocument();
    expect(screen.getByText("Creator studio")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders the user email in sidebar", () => {
    renderPage();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders OverviewSection by default", () => {
    renderPage();
    expect(screen.getByTestId("overview-section")).toBeInTheDocument();
  });

  it("renders DashboardSection when section is dashboard", () => {
    mockUseParams.mockReturnValue({ section: "dashboard" });
    renderPage();
    expect(screen.getByTestId("dashboard-section")).toBeInTheDocument();
  });

  it("renders OrdersSection when section is orders", () => {
    mockUseParams.mockReturnValue({ section: "orders" });
    renderPage();
    expect(screen.getByTestId("orders-section")).toBeInTheDocument();
  });

  it("renders AccountSection when section is account", () => {
    mockUseParams.mockReturnValue({ section: "account" });
    renderPage();
    expect(screen.getByTestId("account-section")).toBeInTheDocument();
  });

  it("falls back to overview for invalid section param", () => {
    mockUseParams.mockReturnValue({ section: "invalid" });
    renderPage();
    expect(screen.getByTestId("overview-section")).toBeInTheDocument();
  });
});
