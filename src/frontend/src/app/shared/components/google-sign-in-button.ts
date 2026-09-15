import { Component, inject } from '@angular/core';
import { ApiService } from '@core/api/api.service';
import { ButtonComponent } from '@shared/ui';
import { environment } from '../../../environments/environment';

// Rendered only when Google OAuth is enabled, so nothing looks broken until the backend
// is configured with Google creds.
@Component({
  selector: 'app-google-sign-in-button',
  imports: [ButtonComponent],
  template: `
    @if (enabled) {
      <div class="flex items-center gap-3 my-5">
        <div class="h-px flex-1 bg-ink/15"></div>
        <span class="font-mono uppercase tracking-[0.14em] text-[10px] text-ink-mute">or</span>
        <div class="h-px flex-1 bg-ink/15"></div>
      </div>
      <button appButton type="button" variant="secondary" size="lg" class="w-full" (click)="go()">Continue with Google</button>
    }
  `,
})
export class GoogleSignInButtonComponent {
  private readonly api = inject(ApiService);
  readonly enabled = environment.googleAuth;

  go(): void {
    window.location.href = this.api.googleSignInUrl();
  }
}
