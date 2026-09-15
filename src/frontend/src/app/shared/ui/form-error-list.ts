import { Component, computed, input } from '@angular/core';
import type { ApiError } from '@core/api/types';

@Component({
  selector: 'app-form-error-list',
  template: `
    @if (messages().length) {
      <ul class="mb-4 text-[14px] text-danger bg-[#fdeceb] border-2 border-danger px-4 py-3 space-y-1">
        @for (m of messages(); track $index) {
          <li>{{ m }}</li>
        }
      </ul>
    }
  `,
})
export class FormErrorListComponent {
  error = input<ApiError | null | undefined>(undefined);

  messages = computed<string[]>(() => {
    const e = this.error();
    if (!e) return [];
    const out: string[] = [];
    if (e.detail) out.push(e.detail);
    if (e.message && e.message !== e.detail) out.push(e.message);
    if (e.errors) {
      for (const [field, arr] of Object.entries(e.errors)) {
        for (const msg of arr) out.push(`${field}: ${msg}`);
      }
    }
    return out;
  });
}
