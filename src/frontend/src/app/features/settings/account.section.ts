import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import type { ApiError } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, InputDirective } from '@shared/ui';

@Component({
  selector: 'app-account-section',
  imports: [FormsModule, ButtonComponent, FormErrorListComponent, InputDirective],
  templateUrl: './account.section.html',
})
export class AccountSection {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);

  readonly deletingAccount = signal(false);
  readonly deleteLoading = signal(false);
  readonly deleteError = signal<ApiError | undefined>(undefined);

  readonly nameInput = signal(this.auth.displayName() ?? '');
  readonly nameSaving = signal(false);
  readonly nameError = signal<ApiError | undefined>(undefined);
  readonly nameSaved = signal(false);

  readonly emailInput = signal('');
  readonly emailSaving = signal(false);
  readonly emailError = signal<ApiError | undefined>(undefined);
  readonly emailSaved = signal(false);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly pwSaving = signal(false);
  readonly pwError = signal<ApiError | undefined>(undefined);
  readonly pwLocalError = signal<string | undefined>(undefined);
  readonly pwSaved = signal(false);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  async deleteAccount(): Promise<void> {
    this.deleteLoading.set(true);
    this.deleteError.set(undefined);
    try {
      await this.auth.deleteAccount();
      this.router.navigate(['/']);
    } catch (err) {
      this.deleteError.set(err as ApiError);
      this.deleteLoading.set(false);
    }
  }

  async saveName(): Promise<void> {
    this.nameSaving.set(true);
    this.nameError.set(undefined);
    this.nameSaved.set(false);
    try {
      const result = await this.api.updateProfile({ displayName: this.nameInput().trim() || null });
      this.auth.updateDisplayName(result.displayName);
      this.nameSaved.set(true);
      setTimeout(() => this.nameSaved.set(false), 2000);
    } catch (err) {
      this.nameError.set(err as ApiError);
    } finally {
      this.nameSaving.set(false);
    }
  }

  async changeEmail(): Promise<void> {
    this.emailSaving.set(true);
    this.emailError.set(undefined);
    this.emailSaved.set(false);
    try {
      await this.api.updateProfile({ newEmail: this.emailInput().trim() });
      this.emailSaved.set(true);
      this.emailInput.set('');
      setTimeout(() => this.emailSaved.set(false), 3000);
    } catch (err) {
      this.emailError.set(err as ApiError);
    } finally {
      this.emailSaving.set(false);
    }
  }

  async changePassword(): Promise<void> {
    this.pwLocalError.set(undefined);
    this.pwError.set(undefined);
    this.pwSaved.set(false);
    if (this.newPassword().length < 8) {
      this.pwLocalError.set('Password must be at least 8 characters.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.pwLocalError.set('Passwords do not match.');
      return;
    }
    this.pwSaving.set(true);
    try {
      await this.api.updateProfile({ currentPassword: this.currentPassword(), newPassword: this.newPassword() });
      this.pwSaved.set(true);
      this.currentPassword.set('');
      this.newPassword.set('');
      this.confirmPassword.set('');
      setTimeout(() => this.pwSaved.set(false), 2000);
    } catch (err) {
      this.pwError.set(err as ApiError);
    } finally {
      this.pwSaving.set(false);
    }
  }
}
