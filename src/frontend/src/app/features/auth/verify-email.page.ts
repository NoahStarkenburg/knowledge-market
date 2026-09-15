import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import { setPageTitle } from '@core/page';
import type { ApiError } from '@core/api/types';
import { ButtonComponent, OrnamentComponent } from '@shared/ui';

@Component({
  selector: 'app-verify-email-page',
  imports: [RouterLink, ButtonComponent, OrnamentComponent],
  templateUrl: './verify-email.page.html',
})
export class VerifyEmailPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly auth = inject(AuthService);

  readonly success = this.route.snapshot.queryParamMap.get('success');
  readonly error = this.route.snapshot.queryParamMap.get('error');

  readonly resendLoading = signal(false);
  readonly resendDone = signal(false);
  readonly resendError = signal<ApiError | undefined>(undefined);

  constructor() {
    setPageTitle('Verify email');
    if (this.success === 'true') this.auth.markEmailVerified();
  }

  async resend(): Promise<void> {
    this.resendLoading.set(true);
    this.resendError.set(undefined);
    this.resendDone.set(false);
    try {
      await this.api.resendVerification();
      this.resendDone.set(true);
    } catch (err) {
      this.resendError.set(err as ApiError);
    } finally {
      this.resendLoading.set(false);
    }
  }
}
