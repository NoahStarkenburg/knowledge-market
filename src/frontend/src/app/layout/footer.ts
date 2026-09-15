import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrnamentComponent } from '@shared/ui/ornament';

interface FooterLink {
  to: string;
  text: string;
  params?: Record<string, string>;
}

@Component({
  selector: 'app-footer',
  imports: [RouterLink, OrnamentComponent],
  templateUrl: './footer.html',
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
  readonly volume = String(Math.max(1, this.year - 2025)).padStart(2, '0');

  readonly columns: { label: string; links: FooterLink[] }[] = [
    {
      label: 'Catalog',
      links: [
        { to: '/courses', text: 'Browse all' },
        { to: '/courses', text: 'Recently added', params: { sort: 'newest' } },
        { to: '/courses', text: 'Most popular', params: { sort: 'popular' } },
      ],
    },
    {
      label: 'Teach',
      links: [
        { to: '/register', text: 'Become a creator' },
        { to: '/courses/new', text: 'Submit a course' },
      ],
    },
    {
      label: 'Account',
      links: [
        { to: '/settings/learning', text: 'My learning' },
        { to: '/settings/orders', text: 'Orders' },
        { to: '/settings/account', text: 'Settings' },
      ],
    },
    {
      label: 'Legal',
      links: [
        { to: '/terms', text: 'Terms' },
        { to: '/privacy', text: 'Privacy' },
        { to: '/refunds', text: 'Refunds' },
        { to: '/dmca', text: 'DMCA' },
      ],
    },
  ];
}
