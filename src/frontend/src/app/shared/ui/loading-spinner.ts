import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  template: `
    <div class="py-8 text-center font-mono uppercase tracking-[0.16em] text-[12px] font-bold text-ink-mute animate-pulse">
      Loading...
    </div>
  `,
})
export class LoadingSpinnerComponent {}
