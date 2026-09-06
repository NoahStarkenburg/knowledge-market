import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom
// ---------------------------------------------------------------------------
let mockSearchParams = new URLSearchParams();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
  };
});

// ---------------------------------------------------------------------------
// Mock AuthContext
// ---------------------------------------------------------------------------
const mockMarkEmailVerified = vi.fn();
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isAdmin: false,
    roles: [],
    userId: "user-1",
    email: "test@example.com",
    isEmailVerified: false,
    login: vi.fn(),
    logout: vi.fn(),
    resendVerification: vi.fn(),
    deleteAccount: vi.fn(),
    markEmailVerified: mockMarkEmailVerified,
    displayName: null,
    updateDisplayName: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    resendVerification: vi.fn(),
  },
}));

import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../api/apiClient";
import { VerifyEmailPage } from "../VerifyEmailPage";

const mockApiClient = apiClient as unknown as {
  resendVerification: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(
    <MemoryRouter>
      <VerifyEmailPage />
    </MemoryRouter>
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
      email: "test@example.com",
      isEmailVerified: false,
      login: vi.fn(),
      logout: vi.fn(),
      resendVerification: vi.fn(),
      deleteAccount: vi.fn(),
      markEmailVerified: mockMarkEmailVerified,
      displayName: null,
      updateDisplayName: vi.fn(),
    });
  });

  it("renders check your email page by default", () => {
    renderPage();
    expect(screen.getByText("Check your email")).toBeInTheDocument();
  });

  it("shows Email verified when ?success=true is in URL", () => {
    mockSearchParams = new URLSearchParams("success=true");
    renderPage();
    expect(screen.getByText("Email verified!")).toBeInTheDocument();
  });

  it("calls markEmailVerified when success=true", () => {
    mockSearchParams = new URLSearchParams("success=true");
    renderPage();
    expect(mockMarkEmailVerified).toHaveBeenCalled();
  });

  it("shows Link expired when ?error=expired is in URL", () => {
    mockSearchParams = new URLSearchParams("error=expired");
    renderPage();
    expect(screen.getByText("Link expired")).toBeInTheDocument();
  });

  it("shows Invalid link when ?error=invalid is in URL", () => {
    mockSearchParams = new URLSearchParams("error=invalid");
    renderPage();
    expect(screen.getByText("Invalid link")).toBeInTheDocument();
  });

  it("shows resend button for authenticated users on default page", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /resend email/i })).toBeInTheDocument();
  });

  it("shows resend button on expired page for authenticated users", () => {
    mockSearchParams = new URLSearchParams("error=expired");
    renderPage();
    expect(screen.getByRole("button", { name: /resend verification email/i })).toBeInTheDocument();
  });

  it("calls resendVerification when resend button is clicked", async () => {
    mockApiClient.resendVerification.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /resend email/i }));

    await waitFor(() => {
      expect(mockApiClient.resendVerification).toHaveBeenCalled();
    });
  });

  it("shows Sent message after successful resend", async () => {
    mockApiClient.resendVerification.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /resend email/i }));

    await waitFor(() => {
      expect(screen.getByText(/sent! check your inbox/i)).toBeInTheDocument();
    });
  });
});
