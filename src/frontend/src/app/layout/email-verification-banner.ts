import { Component, inject, signal } from '@angular/core';
import { AuthService } from '@core/auth.service';
import type { ApiError } from '@core/api/types';

@Component({
  selector: 'app-email-verification-banner',
  templateUrl: './email-verification-banner.html',
})
export class EmailVerificationBannerComponent {
  protected readonly auth = inject(AuthService);
  readonly sending = signal(false);
  readonly sent = signal(false);
  readonly sendError = signal<ApiError | undefined>(undefined);

  async resend(): Promise<void> {
    this.sending.set(true);
    this.sendError.set(undefined);
    try {
      await this.auth.resendVerification();
      this.sent.set(true);
    } catch (err) {
      this.sendError.set(err as ApiError);
    } finally {
      this.sending.set(false);
    }
  }
}
