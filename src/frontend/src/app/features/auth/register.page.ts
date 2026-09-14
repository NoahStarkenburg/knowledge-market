import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/auth.service';
import { ApiService } from '@core/api/api.service';
import { setPageTitle } from '@core/page';
import type { ApiError } from '@core/api/types';
import { ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent } from '@shared/ui';
import { GoogleSignInButtonComponent } from '@shared/components/google-sign-in-button';

@Component({
  selector: 'app-register-page',
  imports: [FormsModule, RouterLink, ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective, OrnamentComponent, GoogleSignInButtonComponent],
  templateUrl: './register.page.html',
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly error = signal<ApiError | undefined>(undefined);
  readonly loading = signal(false);

  constructor() {
    setPageTitle('Create an account');
    effect(() => {
      if (this.auth.isAuthenticated()) this.router.navigate(['/courses']);
    });
  }

  async submit(): Promise<void> {
    this.error.set(undefined);

    if (this.password() !== this.confirmPassword()) {
      this.error.set({ status: 400, title: 'Passwords do not match' });
      return;
    }

    this.loading.set(true);
    try {
      await this.api.register(this.email(), this.password());
      const result = await this.auth.login(this.email(), this.password());
      if (result.success) this.router.navigate(['/courses']);
      else this.error.set(result.error);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }
}
