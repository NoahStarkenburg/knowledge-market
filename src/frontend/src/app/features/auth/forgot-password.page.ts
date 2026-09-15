import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { setPageTitle } from '@core/page';
import type { ApiError } from '@core/api/types';
import { ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent } from '@shared/ui';

@Component({
  selector: 'app-forgot-password-page',
  imports: [FormsModule, RouterLink, ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent],
  templateUrl: './forgot-password.page.html',
})
export class ForgotPasswordPage {
  private readonly api = inject(ApiService);

  readonly email = signal('');
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);

  constructor() {
    setPageTitle('Reset password');
  }

  async submit(): Promise<void> {
    this.error.set(undefined);
    this.loading.set(true);
    try {
      await this.api.forgotPassword({ email: this.email() });
      this.submitted.set(true);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }
}
