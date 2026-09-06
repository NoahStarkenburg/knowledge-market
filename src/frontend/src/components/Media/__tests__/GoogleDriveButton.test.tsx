import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../../../hooks/useGoogleDrivePicker", () => ({
  useGoogleDrivePicker: vi.fn(),
}));

import { GoogleDriveButton } from "../GoogleDriveButton";
import { useGoogleDrivePicker } from "../../../hooks/useGoogleDrivePicker";

describe("GoogleDriveButton", () => {
  const onPicked = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when Drive is not enabled", () => {
    vi.mocked(useGoogleDrivePicker).mockReturnValue({ enabled: false, pick: vi.fn() });
    const { container } = render(<GoogleDriveButton onPicked={onPicked} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("passes mimeTypes through and calls onPicked with the returned file", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const pick = vi.fn().mockResolvedValue(file);
    vi.mocked(useGoogleDrivePicker).mockReturnValue({ enabled: true, pick });

    render(<GoogleDriveButton onPicked={onPicked} mimeTypes="image/png" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(onPicked).toHaveBeenCalledWith(file));
    expect(pick).toHaveBeenCalledWith({ mimeTypes: "image/png" });
  });

  it("does not call onPicked when the picker is cancelled", async () => {
    const pick = vi.fn().mockResolvedValue(null);
    vi.mocked(useGoogleDrivePicker).mockReturnValue({ enabled: true, pick });

    render(<GoogleDriveButton onPicked={onPicked} />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(pick).toHaveBeenCalled());
    expect(onPicked).not.toHaveBeenCalled();
  });

  it("shows an error message when the picker throws", async () => {
    const pick = vi.fn().mockRejectedValue(new Error("boom"));
    vi.mocked(useGoogleDrivePicker).mockReturnValue({ enabled: true, pick });

    render(<GoogleDriveButton onPicked={onPicked} />);
    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText(/could not import/i)).toBeInTheDocument();
    expect(onPicked).not.toHaveBeenCalled();
  });
});
