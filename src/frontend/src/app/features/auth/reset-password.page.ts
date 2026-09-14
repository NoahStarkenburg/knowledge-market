import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { setPageTitle } from '@core/page';
import type { ApiError } from '@core/api/types';
import { AlertComponent, ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent } from '@shared/ui';

@Component({
  selector: 'app-reset-password-page',
  imports: [FormsModule, RouterLink, AlertComponent, ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent],
  templateUrl: './reset-password.page.html',
})
export class ResetPasswordPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly loading = signal(false);
  readonly succeeded = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly validationError = signal<string | null>(null);

  constructor() {
    setPageTitle('Choose a new password');
  }

  async submit(): Promise<void> {
    this.validationError.set(null);
    this.error.set(undefined);

    if (this.newPassword().length < 8) {
      this.validationError.set('Password must be at least 8 characters.');
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.validationError.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    try {
      await this.api.resetPassword({ token: this.token, newPassword: this.newPassword() });
      this.succeeded.set(true);
      setTimeout(() => this.router.navigate(['/login']), 3000);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }
}
