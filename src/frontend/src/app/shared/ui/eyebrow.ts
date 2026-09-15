import { Component } from '@angular/core';

@Component({
  selector: 'app-eyebrow',
  template: '<ng-content />',
  host: { class: 'inline-block font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-ink' },
})
export class EyebrowComponent {}
