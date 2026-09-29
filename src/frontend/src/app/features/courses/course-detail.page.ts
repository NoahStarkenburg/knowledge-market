import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title, Meta } from '@angular/platform-browser';
import { Lock, LucideAngularModule, PlayCircle } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import type { ApiError, CourseDto, LessonListItem } from '@core/api/types';
import { FormErrorListComponent, SkeletonComponent } from '@shared/ui';
import { CourseOwnerPanelComponent } from './course-owner-panel';
import { CoursePurchaseCardComponent } from './course-purchase-card';
import { CourseReviewsComponent, type ReviewSummary } from './course-reviews';

// Orchestrates the course page: loads the course + lessons, renders the hero, intro video,
// and curriculum, and composes the feature components - reviews, the owner panel, and the
// purchase card - which each own their slice of state.
@Component({
  selector: 'app-course-detail-page',
  imports: [RouterLink, LucideAngularModule, FormErrorListComponent, SkeletonComponent, CourseOwnerPanelComponent, CoursePurchaseCardComponent, CourseReviewsComponent],
  templateUrl: './course-detail.page.html',
})
export class CourseDetailPage {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleSvc = inject(Title);
  private readonly meta = inject(Meta);

  readonly playIcon = PlayCircle;
  readonly lockIcon = Lock;

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly courseId = computed(() => this.params().get('courseId') ?? '');

  readonly course = signal<CourseDto | null>(null);
  readonly lessons = signal<LessonListItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly isEnrolled = signal(false);
  readonly moreFromCreator = signal<CourseDto[]>([]);
  readonly reviewSummary = signal<ReviewSummary>({ avgRating: null, total: 0 });
  // Bumped after a media upload so the <video>/<img> URLs cache-bust.
  readonly videoVersion = signal(0);
  readonly thumbnailVersion = signal(0);

  readonly isOwner = computed(() => {
    const c = this.course();
    const uid = this.auth.userId();
    return !!(c && uid && c.createdById === uid);
  });
  readonly canReview = computed(() => !this.isOwner() && !!this.auth.userId());
  readonly freePreviewCount = computed(() => this.lessons().filter((l) => l.isFreePreview).length);

  constructor() {
    effect(() => {
      this.courseId();
      void this.loadCourse();
    });
    effect(() => {
      const c = this.course();
      if (!c) {
        this.moreFromCreator.set([]);
        return;
      }
      this.api.getCoursesByCreator(c.createdById, { exclude: c.id, count: 4 }).then((items) => this.moreFromCreator.set(items)).catch(() => this.moreFromCreator.set([]));
    });
    effect(() => {
      const c = this.course();
      this.titleSvc.setTitle(c?.title ? `${c.title} · KnowledgeMarket` : 'KnowledgeMarket');
      if (c) {
        const desc = c.description ?? `${c.title} on KnowledgeMarket.`;
        this.meta.updateTag({ name: 'description', content: desc });
        this.meta.updateTag({ property: 'og:title', content: c.title });
        this.meta.updateTag({ property: 'og:description', content: desc });
        this.meta.updateTag({ property: 'og:type', content: 'article' });
      }
    });
  }

  longDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  lessonOpen(l: LessonListItem): boolean {
    return l.isFreePreview || this.isOwner() || this.isEnrolled();
  }

  private async loadCourse(): Promise<void> {
    const id = this.courseId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const [c, ls] = await Promise.all([this.api.getCourse(id), this.api.listLessons(id).catch(() => [] as LessonListItem[])]);
      this.course.set(c);
      this.lessons.set([...ls].sort((a, b) => a.sortOrder - b.sortOrder));

      const uid = this.auth.userId();
      if (uid && c.createdById !== uid) {
        try {
          const { enrolled } = await this.api.checkEnrollment(c.id);
          this.isEnrolled.set(enrolled);
        } catch {
          // secondary; the page renders without the enrollment state
        }
      }
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }

  onOwnerUpdated(updated: CourseDto): void {
    this.course.set(updated);
  }
  onOwnerDeleted(): void {
    this.router.navigate(['/courses']);
  }
  async onMediaChanged(): Promise<void> {
    this.videoVersion.update((v) => v + 1);
    this.thumbnailVersion.update((v) => v + 1);
    await this.loadCourse();
  }
}
