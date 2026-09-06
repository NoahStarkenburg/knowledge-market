import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockHydrate = vi.fn();
vi.mock("../../../context/AuthContext", () => ({
  useAuth: () => ({ hydrate: mockHydrate }),
}));

vi.mock("../../../api/apiClient", () => ({
  apiClient: { getMe: vi.fn() },
}));

import { apiClient } from "../../../api/apiClient";
import { OAuthCallbackPage } from "../OAuthCallbackPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <OAuthCallbackPage />
    </MemoryRouter>
  );
}

describe("OAuthCallbackPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hydrates auth and redirects to /courses on success", async () => {
    vi.mocked(apiClient.getMe).mockResolvedValue({
      id: "u1",
      email: "g@example.com",
      registeredAt: "2025-01-01T00:00:00Z",
      isEmailVerified: true,
      displayName: "G User",
    });

    renderPage();

    await waitFor(() => {
      expect(mockHydrate).toHaveBeenCalledWith({
        userId: "u1",
        email: "g@example.com",
        isEmailVerified: true,
        displayName: "G User",
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/courses", { replace: true });
  });

  it("redirects to login on failure", async () => {
    vi.mocked(apiClient.getMe).mockRejectedValue(new Error("401"));

    renderPage();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login?error=google", { replace: true });
    });
    expect(mockHydrate).not.toHaveBeenCalled();
  });
});
