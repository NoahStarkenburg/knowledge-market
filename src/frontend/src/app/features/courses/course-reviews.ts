import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Star, Trash2, LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import { formatDateLong } from '@core/format';
import type { ApiError, ReviewDto } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';
import { StarsComponent } from './stars';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export interface ReviewSummary {
  avgRating: number | null;
  total: number;
}

// The course page's review block: average header, write/update/delete for the caller's own
// review, the paged review list. Owns all review state and loading; the page only supplies
// courseId/canReview and listens for summaryChange to show the average in its sidebar.
@Component({
  selector: 'app-course-reviews',
  imports: [FormsModule, LucideAngularModule, ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent, StarsComponent],
  templateUrl: './course-reviews.html',
})
export class CourseReviewsComponent {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);

  readonly courseId = input.required<string>();
  readonly canReview = input(false);
  readonly summaryChange = output<ReviewSummary>();

  readonly starIcon = Star;
  readonly trashIcon = Trash2;

  readonly reviews = signal<ReviewDto[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly avgRating = signal<number | null>(null);
  readonly loading = signal(false);
  readonly myReview = signal<ReviewDto | null>(null);
  readonly formRating = signal(0);
  readonly formComment = signal('');
  readonly hoveredStar = signal(0);
  readonly submitting = signal(false);
  readonly deleting = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);

  readonly pages = computed(() => Math.ceil(this.total() / 5));
  readonly roundAvg = computed(() => Math.round(this.avgRating() ?? 0));
  readonly ratingLabel = computed(() => RATING_LABELS[this.formRating()] ?? '');

  constructor() {
    effect(() => {
      this.courseId();
      this.page();
      void this.load();
    });
  }

  shortDate(iso: string): string {
    return formatDateLong(iso);
  }

  private async load(): Promise<void> {
    const id = this.courseId();
    if (!id) return;
    this.loading.set(true);
    try {
      const result = await this.api.listCourseReviews(id, { page: this.page(), pageSize: 5 });
      this.reviews.set(result.items);
      this.total.set(result.total);
      this.avgRating.set(result.avgRating);
      this.summaryChange.emit({ avgRating: result.avgRating, total: result.total });
      const found = result.items.find((r) => r.reviewerId === this.auth.userId());
      if (found) {
        this.myReview.set(found);
        if (this.formRating() === 0) this.formRating.set(found.rating);
        if (this.formComment() === '') this.formComment.set(found.comment ?? '');
      }
    } catch {
      // secondary content; the page still works without reviews
    } finally {
      this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    const id = this.courseId();
    if (!id || this.formRating() === 0) return;
    this.submitting.set(true);
    this.error.set(undefined);
    try {
      const result = await this.api.submitReview(id, { rating: this.formRating(), comment: this.formComment().trim() || null });
      this.myReview.set(result);
      await this.load();
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.submitting.set(false);
    }
  }

  async deleteMine(): Promise<void> {
    const id = this.courseId();
    if (!id) return;
    this.deleting.set(true);
    this.error.set(undefined);
    try {
      await this.api.deleteMyReview(id);
      this.myReview.set(null);
      this.formRating.set(0);
      this.formComment.set('');
      await this.load();
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.deleting.set(false);
    }
  }
}
