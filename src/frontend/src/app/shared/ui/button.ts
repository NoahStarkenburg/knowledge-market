import { Component, computed, input } from '@angular/core';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type Size = 'sm' | 'md' | 'lg';

// Attribute component on a native <button> so it keeps type/disabled/click semantics.
// Usage: <button appButton variant="primary" size="md">Label</button>
@Component({
  // An attribute on the native element, not a new element, so the app-prefixed element rule does not apply.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appButton]',
  template: '<ng-content />',
  host: { '[class]': 'cls()' },
})
export class ButtonComponent {
  variant = input<Variant>('primary');
  size = input<Size>('md');

  private static readonly base =
    'inline-flex items-center justify-center font-mono uppercase font-bold tracking-[0.08em] ' +
    'transition-[background-color,color,border-color,transform,box-shadow] duration-100 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0';

  private static readonly press = 'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none';

  private static readonly sizes: Record<Size, string> = {
    sm: 'text-[11px] px-3 py-2',
    md: 'text-[12px] px-4 py-2.5',
    lg: 'text-[13px] px-6 py-3.5',
  };

  private static readonly variants: Record<Variant, string> = {
    primary: `bg-ink text-paper border-2 border-ink shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white ${ButtonComponent.press}`,
    secondary: `bg-paper text-ink border-2 border-ink hover:bg-ink hover:text-paper ${ButtonComponent.press}`,
    danger: `bg-danger text-white border-2 border-danger shadow-hard-sm hover:bg-ink hover:border-ink ${ButtonComponent.press}`,
    ghost: 'bg-transparent text-ink-mute border-2 border-transparent hover:text-ink hover:border-ink',
    link: 'bg-transparent text-ink border-transparent font-sans normal-case tracking-normal font-semibold px-0 py-0 underline underline-offset-4 decoration-2 decoration-cobalt hover:text-cobalt',
  };

  cls = computed(() => {
    const v = this.variant();
    if (v === 'link') return `${ButtonComponent.base} text-[14px] ${ButtonComponent.variants.link}`;
    return `${ButtonComponent.base} ${ButtonComponent.sizes[this.size()]} ${ButtonComponent.variants[v]}`;
  });
}
