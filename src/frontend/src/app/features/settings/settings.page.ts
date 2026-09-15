import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '@core/auth.service';
import { OverviewSection } from './overview.section';
import { DashboardSection } from './dashboard.section';
import { LearningSection } from './learning.section';
import { CreatorSection } from './creator.section';
import { OrdersSection } from './orders.section';
import { AccountSection } from './account.section';

type Section = 'overview' | 'dashboard' | 'learning' | 'creator' | 'orders' | 'account';

const NAV_ITEMS: { section: Section; label: string }[] = [
  { section: 'overview', label: 'Overview' },
  { section: 'dashboard', label: 'Dashboard' },
  { section: 'learning', label: 'Learning' },
  { section: 'creator', label: 'Creator studio' },
  { section: 'orders', label: 'Orders' },
  { section: 'account', label: 'Account' },
];
const VALID = NAV_ITEMS.map((n) => n.section);

@Component({
  selector: 'app-settings-page',
  imports: [RouterLink, RouterLinkActive, OverviewSection, DashboardSection, LearningSection, CreatorSection, OrdersSection, AccountSection],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly titleSvc = inject(Title);
  readonly navItems = NAV_ITEMS;

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly activeSection = computed<Section>(() => {
    const s = this.params().get('section');
    return s && VALID.includes(s as Section) ? (s as Section) : 'overview';
  });

  constructor() {
    effect(() => {
      const label = NAV_ITEMS.find((n) => n.section === this.activeSection())?.label ?? 'Settings';
      this.titleSvc.setTitle(`${label} · KnowledgeMarket`);
    });
  }
}
