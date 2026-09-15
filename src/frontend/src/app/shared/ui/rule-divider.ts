import { Component, input } from '@angular/core';

@Component({
  selector: 'app-rule-divider',
  templateUrl: './rule-divider.html',
})
export class RuleDividerComponent {
  label = input<string | null>(null);
  align = input<'left' | 'center'>('left');
}
