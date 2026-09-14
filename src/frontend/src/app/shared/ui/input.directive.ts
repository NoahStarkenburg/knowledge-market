import { Directive } from '@angular/core';

// Applies the shared input styling to native <input>/<textarea>/<select>.
// Usage: <input appInput type="email" [(ngModel)]="email" name="email" />
@Directive({
  selector: '[appInput]',
  host: {
    class:
      'bg-chalk border-2 border-ink px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 transition-colors',
  },
})
export class InputDirective {}
