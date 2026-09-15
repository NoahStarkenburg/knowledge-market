import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl, Title } from '@angular/platform-browser';
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Lock, LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import type { ApiError, CourseDto, LessonBodyDto, LessonItem, LessonListItem } from '@core/api/types';
import { AlertComponent, ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';
import { LessonProseComponent } from './lesson-prose';

@Component({
  selector: 'app-lesson-view-page',
  imports: [RouterLink, LucideAngularModule, AlertComponent, ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent, LessonProseComponent],
  templateUrl: './lesson-view.page.html',
})
export class LessonViewPage {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly titleSvc = inject(Title);

  readonly chevronLeft = ChevronLeft;
  readonly chevronRight = ChevronRight;
  readonly check = CheckCircle2;
  readonly circle = Circle;
  readonly lock = Lock;

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly courseId = computed(() => this.params().get('courseId') ?? '');
  readonly lessonId = computed(() => this.params().get('lessonId') ?? '');

  readonly bodyDto = signal<LessonBodyDto | null>(null);
  readonly items = signal<LessonItem[]>([]);
  readonly lessons = signal<LessonListItem[]>([]);
  readonly completedIds = signal<string[]>([]);
  readonly hasCourseAccess = signal(false);
  readonly completeLoading = signal(false);
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly accessError = signal<ApiError | undefined>(undefined);

  readonly sortedItems = computed(() => [...this.items()].sort((a, b) => a.sortOrder - b.sortOrder));
  readonly isCompleted = computed(() => this.completedIds().includes(this.lessonId()));
  readonly currentIndex = computed(() => this.lessons().findIndex((l) => l.id === this.lessonId()));
  readonly prevLesson = computed(() => (this.currentIndex() > 0 ? this.lessons()[this.currentIndex() - 1] : null));
  readonly nextLesson = computed(() => {
    const i = this.currentIndex();
    return i >= 0 && i < this.lessons().length - 1 ? this.lessons()[i + 1] : null;
  });

  constructor() {
    effect(() => {
      this.titleSvc.setTitle(`${this.bodyDto()?.title ?? 'Lesson'} · KnowledgeMarket`);
    });
    effect(() => {
      this.courseId();
      this.lessonId();
      this.auth.userId();
      void this.loadLesson();
    });
  }

  safe(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  download(item: LessonItem): void {
    if (!item.contentFileId) return;
    const url = this.api.getDownloadUrl(this.courseId(), this.lessonId(), item.contentFileId);
    window.open(url, '_blank');
  }

  private async loadLesson(): Promise<void> {
    const cId = this.courseId();
    const lId = this.lessonId();
    if (!cId || !lId) return;
    this.loading.set(true);
    this.error.set(undefined);
    this.accessError.set(undefined);
    this.bodyDto.set(null);
    this.items.set([]);
    try {
      const [body, contentItems, allLessons, progress, course] = await Promise.all([
        this.api.getLessonMeta(cId, lId),
        this.api.getLessonContent(cId, lId),
        this.api.listLessons(cId).catch(() => [] as LessonListItem[]),
        this.api.getCourseProgress(cId).catch(() => ({ completedLessonIds: [] })),
        this.api.getCourse(cId).catch(() => null as CourseDto | null),
      ]);
      this.bodyDto.set(body);
      this.items.set(Array.isArray(contentItems) ? contentItems : []);
      this.lessons.set([...allLessons].sort((a, b) => a.sortOrder - b.sortOrder));
      this.completedIds.set(progress.completedLessonIds);

      const uid = this.auth.userId();
      const owner = !!(uid && course && course.createdById === uid);
      if (owner) this.hasCourseAccess.set(true);
      else if (uid) {
        try {
          const { enrolled } = await this.api.checkEnrollment(cId);
          this.hasCourseAccess.set(enrolled);
        } catch {
          this.hasCourseAccess.set(false);
        }
      } else this.hasCourseAccess.set(false);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401 || apiErr.status === 403) this.accessError.set(apiErr);
      else this.error.set(apiErr);
    } finally {
      this.loading.set(false);
    }
  }

  async toggleComplete(): Promise<void> {
    const cId = this.courseId();
    const lId = this.lessonId();
    this.completeLoading.set(true);
    try {
      if (this.isCompleted()) {
        await this.api.unmarkLessonComplete(cId, lId);
        this.completedIds.update((ids) => ids.filter((id) => id !== lId));
      } else {
        await this.api.markLessonComplete(cId, lId);
        this.completedIds.update((ids) => [...ids, lId]);
      }
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.completeLoading.set(false);
    }
  }
}
