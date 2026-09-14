import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

const PROSE = [
  'max-w-none text-ink-soft text-[15px] leading-[1.7]',
  '[&>*:first-child]:mt-0',
  '[&_p]:my-4',
  '[&_h2]:font-display [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[-0.005em] [&_h2]:text-[clamp(1.2rem,2.8vw,1.55rem)] [&_h2]:leading-[1.05] [&_h2]:text-ink [&_h2]:mt-10 [&_h2]:mb-3',
  '[&_h3]:font-mono [&_h3]:uppercase [&_h3]:tracking-[0.1em] [&_h3]:text-[12px] [&_h3]:font-bold [&_h3]:text-ink [&_h3]:mt-6 [&_h3]:mb-2',
  '[&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-4 [&_ul]:space-y-1.5 [&_ul]:marker:text-cobalt',
  '[&_li]:pl-1',
  '[&_a]:text-cobalt [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-2 [&_a:hover]:text-cobalt-deep',
  '[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-paper-dim [&_code]:text-ink [&_code]:px-1.5 [&_code]:py-0.5',
  '[&_strong]:font-bold [&_strong]:text-ink',
].join(' ');

@Component({
  selector: 'app-legal-layout',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './legal-layout.html',
})
export class LegalLayoutComponent {
  title = input('');
  lastUpdated = input('');
  readonly prose = PROSE;
  readonly linkBase = 'block px-3 py-2.5 font-mono uppercase tracking-[0.08em] text-[11px] font-bold border-2 border-ink transition-colors';
  readonly links = [
    { to: '/terms', label: 'Terms of service' },
    { to: '/privacy', label: 'Privacy policy' },
    { to: '/refunds', label: 'Refund policy' },
    { to: '/dmca', label: 'Copyright / DMCA' },
  ];
}
