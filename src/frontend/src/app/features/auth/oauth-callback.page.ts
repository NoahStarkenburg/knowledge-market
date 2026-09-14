import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';

// Landing route after the Google OAuth redirect. The API has already set our auth cookies;
// here we fetch the current user to populate client-side auth state.
@Component({
  selector: 'app-oauth-callback-page',
  template: `
    <div class="min-h-screen bg-paper flex items-center justify-center px-4">
      <p class="font-mono uppercase tracking-[0.14em] text-[12px] text-ink-mute">Signing you in...</p>
    </div>
  `,
})
export class OAuthCallbackPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    try {
      const me = await this.api.getMe();
      this.auth.hydrate({
        userId: me.id,
        email: me.email,
        isEmailVerified: me.isEmailVerified,
        displayName: me.displayName,
      });
      this.router.navigate(['/courses'], { replaceUrl: true });
    } catch {
      this.router.navigate(['/login'], { queryParams: { error: 'google' }, replaceUrl: true });
    }
  }
}
