import { Component, input } from '@angular/core';

// Label + projected control + optional helper text. Wraps an <input appInput> (or any
// control) so pages keep native form semantics (ngModel / reactive forms).
@Component({
  selector: 'app-field',
  template: `
    <!-- The control is projected inside the label, which associates them; lint cannot see through ng-content. -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label class="flex flex-col gap-2 mb-5">
      <span class="font-mono uppercase tracking-[0.12em] text-[11px] font-bold text-ink">{{ label() }}</span>
      <ng-content />
      @if (helperText()) {
        <span class="text-[12px] text-ink-mute">{{ helperText() }}</span>
      }
    </label>
  `,
})
export class FieldComponent {
  label = input('');
  helperText = input<string | null>(null);
}
