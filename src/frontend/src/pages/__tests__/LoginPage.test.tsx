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
// Mock AuthContext
// ---------------------------------------------------------------------------
const mockLogin = vi.fn();
vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    isAdmin: false,
    roles: [],
    userId: null,
    email: null,
    isEmailVerified: false,
    login: mockLogin,
    logout: vi.fn(),
    resendVerification: vi.fn(),
    deleteAccount: vi.fn(),
    markEmailVerified: vi.fn(),
    displayName: null,
    updateDisplayName: vi.fn(),
  })),
}));

import { useAuth } from "../../context/AuthContext";
import { LoginPage } from "../LoginPage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset useAuth to the non-authenticated default before each test
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isAdmin: false,
      roles: [],
      userId: null,
      email: null,
      isEmailVerified: false,
      login: mockLogin,
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });
  });

  it("renders the login form with email, password fields and submit button", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a link to the register page", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /create account/i })).toBeInTheDocument();
  });

  it("navigates to /courses when already authenticated", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
      email: "user@example.com",
      isEmailVerified: true,
      login: mockLogin,
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: vi.fn(),
      displayName: null,
      updateDisplayName: vi.fn(),
    });

    renderPage();

    expect(mockNavigate).toHaveBeenCalledWith("/courses");
  });

  it("calls login with email and password on form submit", async () => {
    mockLogin.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "secret123");
    });
  });

  it("navigates to /courses on successful login", async () => {
    mockLogin.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/courses");
    });
  });

  it("shows error message when login fails", async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: { status: 401, title: "Unauthorized", detail: "Invalid credentials" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "bad@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });
  });

  it("disables submit button while login is in-flight", async () => {
    let resolveLogin!: (v: { success: boolean }) => void;
    mockLogin.mockReturnValue(new Promise((resolve) => (resolveLogin = resolve)));
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    });

    resolveLogin({ success: true });
  });

  it("does not navigate on failed login", async () => {
    mockLogin.mockResolvedValue({
      success: false,
      error: { status: 401, title: "Unauthorized" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), "bad@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    // navigate should never be called when login fails and user is not authenticated
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
