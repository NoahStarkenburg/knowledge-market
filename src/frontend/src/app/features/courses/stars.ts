import { Component, computed, input } from '@angular/core';
import { LucideAngularModule, Star } from 'lucide-angular';

@Component({
  selector: 'app-stars',
  imports: [LucideAngularModule],
  template: `
    <div class="flex gap-0.5" [attr.aria-label]="value() + ' out of 5'">
      @for (i of [1, 2, 3, 4, 5]; track i) {
        <lucide-icon [img]="star" [class]="cls() + ' ' + (i <= value() ? 'fill-signal text-ink' : 'fill-paper-dim text-ink-mute')" />
      }
    </div>
  `,
})
export class StarsComponent {
  value = input(0);
  size = input<'sm' | 'md'>('md');
  readonly star = Star;
  cls = computed(() => (this.size() === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'));
}
