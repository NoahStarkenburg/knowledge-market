import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-card',
  template: '<ng-content />',
  host: { '[class]': 'cls()' },
})
export class CardComponent {
  padded = input(true);
  cls = computed(() => `block bg-chalk border-2 border-ink ${this.padded() ? 'p-6' : ''}`);
}
