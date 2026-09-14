import { Component, computed, input } from '@angular/core';

type AlertType = 'info' | 'success' | 'warning' | 'error';

@Component({
  selector: 'app-alert',
  template: '<ng-content />',
  host: { '[class]': 'cls()' },
})
export class AlertComponent {
  type = input<AlertType>('info');

  private static readonly base = 'block border-2 px-4 py-3 text-[14px] mb-4';
  private static readonly styles: Record<AlertType, string> = {
    info: 'border-cobalt bg-[#eef0ff] text-cobalt-deep',
    success: 'border-[#1f7a3d] bg-[#eafaf0] text-[#1b5e34]',
    warning: 'border-[#9a6a00] bg-[#fff7e0] text-[#7a5400]',
    error: 'border-danger bg-[#fdeceb] text-danger',
  };

  cls = computed(() => `${AlertComponent.base} ${AlertComponent.styles[this.type()]}`);
}
