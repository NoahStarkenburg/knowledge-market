import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";
import { Button } from "../../components/ui/Button";
import { FormErrorList } from "../../components/ui/FormErrorList";
import type { ApiError } from "../../api/types";

export const AccountSection: React.FC = () => {
  const { email, displayName, logout, deleteAccount, updateDisplayName } = useAuth();
  const navigate = useNavigate();
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<ApiError | undefined>();

  // Display name
  const [nameInput, setNameInput] = useState(displayName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState<ApiError | undefined>();
  const [nameSaved, setNameSaved] = useState(false);

  // Email change
  const [emailInput, setEmailInput] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<ApiError | undefined>();
  const [emailSaved, setEmailSaved] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<ApiError | undefined>();
  const [pwLocalError, setPwLocalError] = useState<string | undefined>();
  const [pwSaved, setPwSaved] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError(undefined);
    try {
      await deleteAccount();
      navigate("/");
    } catch (err: unknown) {
      setDeleteError(err as ApiError);
      setDeleteLoading(false);
    }
  };

  const handleSaveName = async () => {
    setNameSaving(true);
    setNameError(undefined);
    setNameSaved(false);
    try {
      const result = await apiClient.updateProfile({ displayName: nameInput.trim() || null });
      updateDisplayName(result.displayName);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err: unknown) {
      setNameError(err as ApiError);
    } finally {
      setNameSaving(false);
    }
  };

  const handleChangeEmail = async () => {
    setEmailSaving(true);
    setEmailError(undefined);
    setEmailSaved(false);
    try {
      await apiClient.updateProfile({ newEmail: emailInput.trim() });
      setEmailSaved(true);
      setEmailInput("");
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (err: unknown) {
      setEmailError(err as ApiError);
    } finally {
      setEmailSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwLocalError(undefined);
    setPwError(undefined);
    setPwSaved(false);

    if (newPassword.length < 8) {
      setPwLocalError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwLocalError("Passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      await apiClient.updateProfile({ currentPassword, newPassword });
      setPwSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPwSaved(false), 2000);
    } catch (err: unknown) {
      setPwError(err as ApiError);
    } finally {
      setPwSaving(false);
    }
  };

  const inputClass =
    "w-full bg-chalk border-2 border-ink px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors";
  const cardHeading =
    "font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink mb-3";
  const successNote = "text-[12px] text-[#1b5e34] font-medium";

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">
          Profile &amp; security
        </div>
        <h1 className="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4rem)]">
          Account
        </h1>
        <p className="text-[14px] text-ink-soft mt-4 max-w-[60ch]">
          Manage your account information and security.
        </p>
      </div>

      <div className="space-y-4 max-w-xl">
        {/* Display name */}
        <div className="bg-chalk border-2 border-ink p-5">
          <h3 className={cardHeading}>Display name</h3>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={100}
            placeholder="Enter a display name"
            className={inputClass}
          />
          <FormErrorList error={nameError} />
          <div className="flex items-center gap-3 mt-3">
            <Button size="sm" disabled={nameSaving} onClick={handleSaveName}>
              {nameSaving ? "Saving..." : "Save"}
            </Button>
            {nameSaved && <span className={successNote}>Saved</span>}
          </div>
        </div>

        {/* Email */}
        <div className="bg-chalk border-2 border-ink p-5">
          <h3 className={cardHeading}>Email address</h3>
          <div className="bg-paper-dim border-2 border-ink px-3 py-2.5 text-[14px] text-ink-mute mb-3">
            {email}
          </div>
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Enter new email address"
            className={inputClass}
          />
          <p className="text-[11px] text-ink-mute mt-2">
            Changing your email will require re-verification.
          </p>
          <FormErrorList error={emailError} />
          <div className="flex items-center gap-3 mt-3">
            <Button
              size="sm"
              disabled={emailSaving || !emailInput.trim()}
              onClick={handleChangeEmail}
            >
              {emailSaving ? "Saving..." : "Change email"}
            </Button>
            {emailSaved && (
              <span className={successNote}>Email updated. Check your inbox to verify.</span>
            )}
          </div>
        </div>

        {/* Change password */}
        <div className="bg-chalk border-2 border-ink p-5">
          <h3 className={cardHeading}>Change password</h3>
          <div className="space-y-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className={inputClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className={inputClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className={inputClass}
            />
          </div>
          {pwLocalError && <p className="text-[12px] text-danger mt-2">{pwLocalError}</p>}
          <FormErrorList error={pwError} />
          <div className="flex items-center gap-3 mt-3">
            <Button
              size="sm"
              disabled={pwSaving || !currentPassword || !newPassword}
              onClick={handleChangePassword}
            >
              {pwSaving ? "Changing..." : "Change password"}
            </Button>
            {pwSaved && <span className={successNote}>Password changed</span>}
          </div>
        </div>

        {/* Security */}
        <div className="bg-chalk border-2 border-ink p-5">
          <h3 className={cardHeading}>Forgot password?</h3>
          <p className="text-[13px] text-ink-soft mb-4">
            Reset your password via email if you&apos;ve forgotten it.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate("/forgot-password")}
          >
            Reset via email
          </Button>
        </div>

        {/* Sign out */}
        <div className="bg-chalk border-2 border-ink p-5">
          <h3 className={cardHeading}>Sign out</h3>
          <p className="text-[13px] text-ink-soft mb-4">
            Sign out of your KnowledgeMarket account on this device.
          </p>
          <Button variant="secondary" onClick={handleLogout}>
            Sign out
          </Button>
        </div>

        {/* Danger zone */}
        <div className="bg-chalk border-2 border-danger">
          <div className="p-5">
            <h3 className="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-danger mb-3">
              Delete account
            </h3>
            <p className="text-[13px] text-ink-soft mb-4">
              Permanently delete your account and all associated data.
            </p>
            {!deletingAccount ? (
              <Button variant="danger" size="sm" onClick={() => setDeletingAccount(true)}>
                Delete account
              </Button>
            ) : (
              <div className="bg-paper border-2 border-danger p-4">
                <p className="text-[13px] text-ink font-medium mb-1">
                  This will permanently delete your account and all your data. This cannot be undone.
                </p>
                <FormErrorList error={deleteError} />
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={deleteLoading}
                    onClick={() => {
                      setDeletingAccount(false);
                      setDeleteError(undefined);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={deleteLoading}
                    onClick={handleDeleteAccount}
                  >
                    {deleteLoading ? "Deleting..." : "Yes, delete my account"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
