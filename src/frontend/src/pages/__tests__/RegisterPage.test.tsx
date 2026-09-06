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
// Mock apiClient before any import that uses it
// ---------------------------------------------------------------------------
vi.mock("../../api/apiClient", () => ({
  apiClient: {
    register: vi.fn(),
  },
}));

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

import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";
import { RegisterPage } from "../RegisterPage";

const mockApiClient = apiClient as unknown as { register: ReturnType<typeof vi.fn> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("RegisterPage", () => {
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

  it("renders the registration form with all required fields", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: /create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("renders a link back to the login page", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
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

  it("does not call apiClient.register when passwords do not match", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^email/i), "test@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "different");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    // The form should return early — register should never be called
    await waitFor(() => {
      expect(mockApiClient.register).not.toHaveBeenCalled();
    });
  });

  it("calls apiClient.register then login on successful submit", async () => {
    mockApiClient.register.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "mypassword");
    await user.type(screen.getByLabelText(/confirm password/i), "mypassword");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockApiClient.register).toHaveBeenCalledWith("new@example.com", "mypassword");
      expect(mockLogin).toHaveBeenCalledWith("new@example.com", "mypassword");
    });
  });

  it("navigates to /courses after successful registration and login", async () => {
    mockApiClient.register.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "mypassword");
    await user.type(screen.getByLabelText(/confirm password/i), "mypassword");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/courses");
    });
  });

  it("shows API error when registration fails", async () => {
    mockApiClient.register.mockRejectedValue({
      status: 400,
      title: "Bad Request",
      detail: "Email already taken",
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^email/i), "taken@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "mypassword");
    await user.type(screen.getByLabelText(/confirm password/i), "mypassword");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Email already taken/i)).toBeInTheDocument();
    });
  });

  it("disables the submit button while registration is in-flight", async () => {
    let resolveRegister!: () => void;
    mockApiClient.register.mockReturnValue(
      new Promise<void>((resolve) => (resolveRegister = resolve))
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "mypassword");
    await user.type(screen.getByLabelText(/confirm password/i), "mypassword");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /creating account/i })).toBeDisabled();
    });

    resolveRegister();
  });

  it("shows error when login fails after successful registration", async () => {
    mockApiClient.register.mockResolvedValue(undefined);
    mockLogin.mockResolvedValue({
      success: false,
      error: { status: 500, title: "Server Error", detail: "Login service unavailable" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/^email/i), "new@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "mypassword");
    await user.type(screen.getByLabelText(/confirm password/i), "mypassword");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Login service unavailable/i)).toBeInTheDocument();
    });
  });
});
