import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button';

@Component({
  imports: [ButtonComponent],
  template: `<button appButton [variant]="variant">Go</button>`,
})
class HostComponent {
  variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link' = 'primary';
}

describe('ButtonComponent', () => {
  it('applies primary variant classes by default', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.className).toContain('bg-ink');
    expect(btn.textContent).toContain('Go');
  });

  it('switches classes when variant changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.variant = 'danger';
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.className).toContain('bg-danger');
  });
});
