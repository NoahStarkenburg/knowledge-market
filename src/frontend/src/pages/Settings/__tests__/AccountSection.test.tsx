import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock react-router-dom
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
const mockLogout = vi.fn();
const mockDeleteAccount = vi.fn();
const mockUpdateDisplayName = vi.fn();
vi.mock("../../../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isAdmin: false,
    roles: [],
    userId: "user-1",
    email: "test@example.com",
    isEmailVerified: true,
    login: vi.fn(),
    logout: mockLogout,
    resendVerification: vi.fn(),
    deleteAccount: mockDeleteAccount,
    markEmailVerified: vi.fn(),
    displayName: "Test User",
    updateDisplayName: mockUpdateDisplayName,
  })),
}));

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------
vi.mock("../../../api/apiClient", () => ({
  apiClient: {
    updateProfile: vi.fn(),
  },
}));

import { useAuth } from "../../../context/AuthContext";
import { apiClient } from "../../../api/apiClient";
import { AccountSection } from "../AccountSection";

const mockApiClient = apiClient as unknown as {
  updateProfile: ReturnType<typeof vi.fn>;
};

function renderSection() {
  return render(
    <MemoryRouter>
      <AccountSection />
    </MemoryRouter>
  );
}

describe("AccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isAdmin: false,
      roles: [],
      userId: "user-1",
      email: "test@example.com",
      isEmailVerified: true,
      login: vi.fn(),
      logout: mockLogout,
      resendVerification: vi.fn(),
      deleteAccount: mockDeleteAccount,
      markEmailVerified: vi.fn(),
      displayName: "Test User",
      updateDisplayName: mockUpdateDisplayName,
    });
  });

  it("renders the Account heading", () => {
    renderSection();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });

  it("renders the display name section with current name", () => {
    renderSection();
    expect(screen.getByText("Display name")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test User")).toBeInTheDocument();
  });

  it("renders the email section with current email", () => {
    renderSection();
    expect(screen.getByText("Email address")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders new email input field", () => {
    renderSection();
    expect(screen.getByPlaceholderText(/enter new email/i)).toBeInTheDocument();
  });

  it("shows re-verification warning for email change", () => {
    renderSection();
    expect(screen.getByText(/changing your email will require re-verification/i)).toBeInTheDocument();
  });

  it("renders the change password section", () => {
    renderSection();
    expect(screen.getByRole("heading", { name: /change password/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Current password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("New password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Confirm new password")).toBeInTheDocument();
  });

  it("renders the sign out button", () => {
    renderSection();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("calls logout and navigates to /login when sign out is clicked", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("renders the delete account button", () => {
    renderSection();
    expect(screen.getByRole("button", { name: /delete account/i })).toBeInTheDocument();
  });

  it("saves display name when save button is clicked", async () => {
    mockApiClient.updateProfile.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      displayName: "New Name",
      isEmailVerified: true,
    });
    const user = userEvent.setup();
    renderSection();

    const nameInput = screen.getByDisplayValue("Test User");
    await user.clear(nameInput);
    await user.type(nameInput, "New Name");
    await user.click(screen.getAllByRole("button", { name: /save/i })[0]);

    await waitFor(() => {
      expect(mockApiClient.updateProfile).toHaveBeenCalledWith({
        displayName: "New Name",
      });
    });
  });

  it("shows password validation error when password is too short", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(screen.getByPlaceholderText("Current password"), "old");
    await user.type(screen.getByPlaceholderText("New password"), "short");
    await user.type(screen.getByPlaceholderText("Confirm new password"), "short");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it("shows password mismatch error", async () => {
    const user = userEvent.setup();
    renderSection();

    await user.type(screen.getByPlaceholderText("Current password"), "oldpass123");
    await user.type(screen.getByPlaceholderText("New password"), "newpassword1");
    await user.type(screen.getByPlaceholderText("Confirm new password"), "different1");
    await user.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });
});
