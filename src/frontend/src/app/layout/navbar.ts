import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth.service';
import { OrnamentComponent } from '@shared/ui/ornament';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, OrnamentComponent],
  templateUrl: './navbar.html',
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly mobileOpen = signal(false);

  private static readonly base = 'font-mono uppercase tracking-[0.12em] text-[11px] font-bold transition-colors pb-0.5 border-b-2';

  link(active: boolean): string {
    return `${NavbarComponent.base} ${active ? 'text-cobalt border-cobalt' : 'text-ink-mute border-transparent hover:text-ink'}`;
  }

  handleLogout(): void {
    this.mobileOpen.set(false);
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
