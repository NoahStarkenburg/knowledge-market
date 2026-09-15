import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Trash2, LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import type { ApiError, CourseDto } from '@core/api/types';
import { AlertComponent, ButtonComponent, FormErrorListComponent } from '@shared/ui';
import { GoogleDriveButtonComponent } from '@shared/components/google-drive-button';

// Everything only the course owner sees: the draft edit form with publish/delete
// confirmations, and the thumbnail / intro-video upload panels. Emits events instead of
// mutating the page's state: updated (fresh dto after save/publish), deleted (page
// navigates away), and mediaChanged (page reloads + cache-busts its media URLs).
@Component({
  selector: 'app-course-owner-panel',
  imports: [FormsModule, LucideAngularModule, AlertComponent, ButtonComponent, FormErrorListComponent, GoogleDriveButtonComponent],
  templateUrl: './course-owner-panel.html',
})
export class CourseOwnerPanelComponent {
  protected readonly api = inject(ApiService);

  readonly course = input.required<CourseDto>();
  readonly thumbnailVersion = input(0);
  readonly updated = output<CourseDto>();
  readonly deleted = output<void>();
  readonly mediaChanged = output<void>();

  readonly trashIcon = Trash2;

  readonly isDraft = computed(() => this.course().status === 'Draft');

  readonly editTitle = signal('');
  readonly editPrice = signal<number | undefined>(undefined);
  readonly editTagsInput = signal('');
  readonly confirmPublish = signal(false);
  readonly confirmDelete = signal(false);
  readonly deleteLoading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);

  readonly thumbnailFile = signal<File | null>(null);
  readonly thumbnailLoading = signal(false);
  readonly thumbnailError = signal<ApiError | undefined>(undefined);
  readonly introVideoFile = signal<File | null>(null);
  readonly introVideoLoading = signal(false);
  readonly introVideoError = signal<ApiError | undefined>(undefined);

  private readonly thumbInput = viewChild<ElementRef<HTMLInputElement>>('thumbInput');
  private readonly videoInput = viewChild<ElementRef<HTMLInputElement>>('videoInput');

  constructor() {
    // Re-seed the edit form whenever a different course arrives.
    effect(() => {
      const c = this.course();
      this.editTitle.set(c.title);
      this.editPrice.set(c.priceAmount);
      this.editTagsInput.set(c.tags.join(', '));
    });
  }

  fileFrom(e: Event): File | null {
    return (e.target as HTMLInputElement).files?.[0] ?? null;
  }
  setEditPrice(v: unknown): void {
    this.editPrice.set(v === '' || v == null ? undefined : Number(v));
  }

  async updateDraft(): Promise<void> {
    const c = this.course();
    this.error.set(undefined);
    this.successMessage.set(undefined);
    try {
      const tags = this.editTagsInput().split(',').map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
      const updatedDto = await this.api.updateCourse(c.id, { title: this.editTitle(), priceAmount: this.editPrice(), tags });
      this.successMessage.set('Course updated.');
      this.updated.emit(updatedDto);
    } catch (err) {
      this.error.set(err as ApiError);
    }
  }

  async publish(): Promise<void> {
    const c = this.course();
    this.confirmPublish.set(false);
    this.error.set(undefined);
    this.successMessage.set(undefined);
    try {
      const updatedDto = await this.api.publishCourse(c.id);
      this.successMessage.set('Course published successfully!');
      this.updated.emit(updatedDto);
    } catch (err) {
      this.error.set(err as ApiError);
    }
  }

  async deleteCourse(): Promise<void> {
    const c = this.course();
    this.confirmDelete.set(false);
    this.deleteLoading.set(true);
    this.error.set(undefined);
    try {
      await this.api.deleteCourse(c.id);
      this.deleted.emit();
    } catch (err) {
      this.error.set(err as ApiError);
      this.deleteLoading.set(false);
    }
  }

  async uploadThumbnail(): Promise<void> {
    const file = this.thumbnailFile();
    if (!file) return;
    this.thumbnailError.set(undefined);
    this.thumbnailLoading.set(true);
    try {
      await this.api.uploadCourseThumbnail(this.course().id, file);
      this.thumbnailFile.set(null);
      const el = this.thumbInput()?.nativeElement;
      if (el) el.value = '';
      this.mediaChanged.emit();
    } catch (err) {
      this.thumbnailError.set(err as ApiError);
    } finally {
      this.thumbnailLoading.set(false);
    }
  }

  async uploadIntroVideo(): Promise<void> {
    const file = this.introVideoFile();
    if (!file) return;
    this.introVideoError.set(undefined);
    this.introVideoLoading.set(true);
    try {
      await this.api.uploadCourseIntroVideo(this.course().id, file);
      this.introVideoFile.set(null);
      const el = this.videoInput()?.nativeElement;
      if (el) el.value = '';
      this.mediaChanged.emit();
    } catch (err) {
      this.introVideoError.set(err as ApiError);
    } finally {
      this.introVideoLoading.set(false);
    }
  }
}
