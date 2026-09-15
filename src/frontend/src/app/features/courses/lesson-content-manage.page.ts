import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import { setPageTitle } from '@core/page';
import type { ApiError, LessonAssetDto, LessonTextDto } from '@core/api/types';
import { AlertComponent, ButtonComponent, CardComponent, FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';
import { GoogleDriveButtonComponent } from '@shared/components/google-drive-button';

interface CombinedItem {
  kind: 'text' | 'file';
  id: string;
  title: string;
  sortOrder: number;
}

@Component({
  selector: 'app-lesson-content-manage-page',
  imports: [FormsModule, RouterLink, AlertComponent, ButtonComponent, CardComponent, FormErrorListComponent, LoadingSpinnerComponent, GoogleDriveButtonComponent],
  templateUrl: './lesson-content-manage.page.html',
})
export class LessonContentManagePage {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly fileInputClass = 'text-sm text-ink-mute file:mr-3 file:py-1.5 file:px-3 file:border-2 file:border-ink file:text-sm file:font-bold file:bg-paper file:text-ink hover:file:bg-ink hover:file:text-paper file:transition-colors file:font-mono file:uppercase file:tracking-[0.08em] file:text-[11px]';

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly courseId = computed(() => this.params().get('courseId') ?? '');
  readonly lessonId = computed(() => this.params().get('lessonId') ?? '');

  readonly texts = signal<LessonTextDto[]>([]);
  readonly assets = signal<LessonAssetDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly textTitle = signal('');
  readonly textBody = signal('');
  readonly textError = signal<ApiError | undefined>(undefined);
  readonly textLoading = signal(false);
  readonly file = signal<File | null>(null);
  readonly fileTitle = signal('');
  readonly fileError = signal<ApiError | undefined>(undefined);
  readonly fileLoading = signal(false);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly isOwner = signal<boolean | null>(null);
  readonly lessonBody = signal('');
  readonly lessonTitle = signal('');
  readonly bodyLoading = signal(false);
  readonly bodyError = signal<ApiError | undefined>(undefined);
  readonly videoFile = signal<File | null>(null);
  readonly videoTitle = signal('');
  readonly videoError = signal<ApiError | undefined>(undefined);
  readonly videoLoading = signal(false);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly videoInput = viewChild<ElementRef<HTMLInputElement>>('videoInput');

  readonly combinedItems = computed<CombinedItem[]>(() => {
    const t: CombinedItem[] = this.texts().map((x) => ({ kind: 'text', id: x.id, title: x.title, sortOrder: x.sortOrder }));
    const a: CombinedItem[] = this.assets().map((x) => ({ kind: 'file', id: x.id, title: x.title, sortOrder: x.sortOrder }));
    return [...t, ...a].sort((x, y) => x.sortOrder - y.sortOrder);
  });

  constructor() {
    setPageTitle('Manage lesson');
    effect(() => {
      this.courseId();
      this.lessonId();
      this.auth.userId();
      void this.loadData();
    });
  }

  fileFrom(e: Event): File | null {
    return (e.target as HTMLInputElement).files?.[0] ?? null;
  }

  private async loadData(): Promise<void> {
    const cId = this.courseId();
    const lId = this.lessonId();
    if (!cId || !lId) return;
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const [course, meta, txts, assts] = await Promise.all([
        this.api.getCourse(cId),
        this.api.getLessonMeta(cId, lId),
        this.api.listLessonTexts(cId, lId),
        this.api.listLessonAssets(cId, lId),
      ]);
      const owner = !!(this.auth.userId() && course.createdById === this.auth.userId());
      this.isOwner.set(owner);
      this.lessonTitle.set(meta.title ?? '');
      this.lessonBody.set(meta.body ?? '');
      if (owner) {
        this.texts.set(txts);
        this.assets.set(assts);
      } else {
        this.texts.set([]);
        this.assets.set([]);
      }
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }

  private nextSort(): number {
    const items = this.combinedItems();
    return items.length === 0 ? 1 : Math.max(...items.map((i) => i.sortOrder)) + 1;
  }

  async addText(): Promise<void> {
    const cId = this.courseId();
    const lId = this.lessonId();
    if (!cId || !lId || !this.isOwner()) return;
    this.textError.set(undefined);
    this.successMessage.set(undefined);
    this.textLoading.set(true);
    try {
      await this.api.createLessonText(cId, lId, { title: this.textTitle(), bodyMarkdown: this.textBody() });
      this.textTitle.set('');
      this.textBody.set('');
      await this.loadData();
      this.successMessage.set('Text block added.');
    } catch (err) {
      this.textError.set(err as ApiError);
    } finally {
      this.textLoading.set(false);
    }
  }

  async uploadFile(): Promise<void> {
    const cId = this.courseId();
    const lId = this.lessonId();
    const f = this.file();
    if (!cId || !lId || !f || !this.isOwner()) return;
    this.fileError.set(undefined);
    this.successMessage.set(undefined);
    this.fileLoading.set(true);
    try {
      const contentFile = await this.api.uploadFile(cId, f);
      await this.api.attachAsset(cId, lId, { contentFileId: contentFile.id, title: this.fileTitle() || contentFile.fileTitle, sortOrder: this.nextSort() });
      this.file.set(null);
      this.fileTitle.set('');
      const el = this.fileInput()?.nativeElement;
      if (el) el.value = '';
      await this.loadData();
      this.successMessage.set('File uploaded and attached.');
    } catch (err) {
      this.fileError.set(err as ApiError);
    } finally {
      this.fileLoading.set(false);
    }
  }

  async updateBody(): Promise<void> {
    const cId = this.courseId();
    const lId = this.lessonId();
    if (!cId || !lId || !this.isOwner()) return;
    this.bodyError.set(undefined);
    this.successMessage.set(undefined);
    this.bodyLoading.set(true);
    try {
      await this.api.updateLesson(cId, lId, { title: this.lessonTitle(), body: this.lessonBody() });
      this.successMessage.set('Lesson updated.');
    } catch (err) {
      this.bodyError.set(err as ApiError);
    } finally {
      this.bodyLoading.set(false);
    }
  }

  async uploadVideo(): Promise<void> {
    const cId = this.courseId();
    const lId = this.lessonId();
    const f = this.videoFile();
    if (!cId || !lId || !f || !this.isOwner()) return;
    this.videoError.set(undefined);
    this.successMessage.set(undefined);
    this.videoLoading.set(true);
    try {
      const contentFile = await this.api.uploadFile(cId, f);
      await this.api.attachAsset(cId, lId, { contentFileId: contentFile.id, title: this.videoTitle() || contentFile.fileTitle, sortOrder: this.nextSort() });
      this.videoFile.set(null);
      this.videoTitle.set('');
      const el = this.videoInput()?.nativeElement;
      if (el) el.value = '';
      await this.loadData();
      this.successMessage.set('Video uploaded and attached.');
    } catch (err) {
      this.videoError.set(err as ApiError);
    } finally {
      this.videoLoading.set(false);
    }
  }

  moveItem(id: string, kind: 'text' | 'file', direction: 'up' | 'down'): void {
    const cId = this.courseId();
    const lId = this.lessonId();
    if (!cId || !lId || !this.isOwner()) return;
    const items = this.combinedItems().map((i) => ({ ...i }));
    const index = items.findIndex((i) => i.id === id && i.kind === kind);
    if (index === -1) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;
    const tmp = items[index].sortOrder;
    items[index].sortOrder = items[swapIndex].sortOrder;
    items[swapIndex].sortOrder = tmp;
    this.api
      .reorderLessonContent(cId, lId, { items: items.map((i) => ({ kind: i.kind, id: i.id, newSort: i.sortOrder })) })
      .then(() => {
        this.successMessage.set('Content reordered.');
        return this.loadData();
      })
      .catch((err) => this.error.set(err as ApiError));
  }
}
