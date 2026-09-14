import { Component, inject, input, output, signal } from '@angular/core';
import { GoogleDrivePickerService } from '@core/google-drive-picker.service';
import { ButtonComponent } from '@shared/ui';

// Renders nothing until Google Drive is configured, so the upload forms look unchanged
// until then.
@Component({
  selector: 'app-google-drive-button',
  imports: [ButtonComponent],
  template: `
    @if (picker.enabled) {
      <div class="space-y-1">
        <button appButton type="button" variant="secondary" size="sm" [disabled]="disabled() || loading()" (click)="click()">
          {{ loading() ? 'Opening Drive…' : label() }}
        </button>
        @if (error()) { <p class="text-[12px] text-danger font-mono">{{ error() }}</p> }
      </div>
    }
  `,
})
export class GoogleDriveButtonComponent {
  protected readonly picker = inject(GoogleDrivePickerService);

  mimeTypes = input<string | undefined>(undefined);
  disabled = input(false);
  label = input('Import from Google Drive');
  readonly picked = output<File>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async click(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const file = await this.picker.pick(this.mimeTypes() ? { mimeTypes: this.mimeTypes()! } : undefined);
      if (file) this.picked.emit(file);
    } catch {
      this.error.set('Could not import from Google Drive. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
