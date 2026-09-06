import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams("token=test-token-123");
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  };
});

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    resetPassword: vi.fn(),
  },
}));

import { apiClient } from "../../../api/apiClient";
import { ResetPasswordPage } from "../ResetPasswordPage";

const mockApiClient = apiClient as unknown as {
  resetPassword: ReturnType<typeof vi.fn>;
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("token=test-token-123");
  });

  it("renders the reset password form with two password fields", () => {
    renderPage();
    expect(screen.getByText(/choose a new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set new password/i })).toBeInTheDocument();
  });

  it("shows invalid link when no token is present", () => {
    mockSearchParams = new URLSearchParams();
    renderPage();
    expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
  });

  it("shows validation error when passwords do not match", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/new password/i), "Password123!");
    await user.type(screen.getByLabelText(/confirm password/i), "Different123!");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when password is too short", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/new password/i), "short");
    await user.type(screen.getByLabelText(/confirm password/i), "short");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it("calls resetPassword on valid form submit", async () => {
    mockApiClient.resetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => {
      expect(mockApiClient.resetPassword).toHaveBeenCalledWith({
        token: "test-token-123",
        newPassword: "NewPass123!",
      });
    });
  });

  it("shows success message after successful reset", async () => {
    mockApiClient.resetPassword.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/password updated/i)).toBeInTheDocument();
    });
  });

  it("shows error when API call fails", async () => {
    mockApiClient.resetPassword.mockRejectedValue({
      status: 400,
      title: "Bad Request",
      detail: "Token expired",
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/new password/i), "NewPass123!");
    await user.type(screen.getByLabelText(/confirm password/i), "NewPass123!");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => {
      expect(screen.getByText(/token expired/i)).toBeInTheDocument();
    });
  });
});
