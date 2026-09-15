import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth.service';
import { setPageTitle } from '@core/page';
import type { ApiError } from '@core/api/types';
import { ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent } from '@shared/ui';
import { GoogleSignInButtonComponent } from '@shared/components/google-sign-in-button';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterLink, ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent, GoogleSignInButtonComponent],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly error = signal<ApiError | undefined>(undefined);
  readonly loading = signal(false);

  constructor() {
    setPageTitle('Log in');
    effect(() => {
      if (this.auth.isAuthenticated()) this.router.navigate(['/courses']);
    });
  }

  async submit(): Promise<void> {
    this.error.set(undefined);
    this.loading.set(true);
    const result = await this.auth.login(this.email(), this.password());
    this.loading.set(false);
    if (result.success) this.router.navigate(['/courses']);
    else this.error.set(result.error);
  }
}
