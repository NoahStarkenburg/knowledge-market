import { Component, input } from '@angular/core';

// Brand mark: a 2x2 block grid with a cross-shaped gap. Inherits currentColor.
@Component({
  selector: 'app-ornament',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="0" y="0" width="7" height="7" />
      <rect x="9" y="0" width="7" height="7" />
      <rect x="0" y="9" width="7" height="7" />
      <rect x="9" y="9" width="7" height="7" />
    </svg>
  `,
  host: { class: 'inline-flex' },
})
export class OrnamentComponent {
  size = input(16);
}

// Wide centered mark between a pair of heavy rules. Section divider.
@Component({
  selector: 'app-rule-ornament',
  imports: [OrnamentComponent],
  template: `
    <span class="flex-1 border-t-2 border-ink"></span>
    <app-ornament [size]="14" />
    <span class="flex-1 border-t-2 border-ink"></span>
  `,
  host: { class: 'flex items-center gap-4 text-cobalt' },
})
export class RuleOrnamentComponent {}
