import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar';
import { FooterComponent } from './footer';
import { EmailVerificationBannerComponent } from './email-verification-banner';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, NavbarComponent, FooterComponent, EmailVerificationBannerComponent],
  template: `
    <div class="min-h-screen bg-paper flex flex-col">
      <app-navbar />
      <app-email-verification-banner />
      <main id="main" class="flex-1">
        <router-outlet />
      </main>
      <app-footer />
    </div>
  `,
})
export class AppLayoutComponent {}
