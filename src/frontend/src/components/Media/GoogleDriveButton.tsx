import React, { useState } from "react";
import { Button } from "../ui/Button";
import { useGoogleDrivePicker } from "../../hooks/useGoogleDrivePicker";

interface GoogleDriveButtonProps {
  // Restrict what the Picker shows, e.g. "video/mp4,video/webm" or "image/png,image/jpeg".
  mimeTypes?: string;
  onPicked: (file: File) => void;
  disabled?: boolean;
  label?: string;
}

// Renders nothing until Google Drive is configured (VITE_GOOGLE_CLIENT_ID +
// VITE_GOOGLE_API_KEY), so the upload forms look unchanged until then.
export const GoogleDriveButton: React.FC<GoogleDriveButtonProps> = ({
  mimeTypes,
  onPicked,
  disabled,
  label = "Import from Google Drive",
}) => {
  const { enabled, pick } = useGoogleDrivePicker();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    try {
      const file = await pick(mimeTypes ? { mimeTypes } : undefined);
      if (file) onPicked(file);
    } catch {
      setError("Could not import from Google Drive. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || loading}
        onClick={handleClick}
      >
        {loading ? "Opening Drive…" : label}
      </Button>
      {error && <p className="text-[12px] text-danger font-mono">{error}</p>}
    </div>
  );
};
