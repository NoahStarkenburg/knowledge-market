import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/api/api.service';
import type { ApiError, EnrolledCourseProgress } from '@core/api/types';

// Loads the caller's enrolled courses with per-course lesson progress. Provided at component
// level (not root) so each consuming page gets its own instance and state.
@Injectable()
export class EnrolledCoursesStore {
  private readonly api = inject(ApiService);

  readonly entries = signal<EnrolledCourseProgress[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const result = await this.api.getPurchasedCourses({ page: 1, pageSize: 100 });
      const entries = await Promise.all(
        result.items.map(async (course) => {
          const [lessons, progress] = await Promise.all([this.api.listLessons(course.id), this.api.getCourseProgress(course.id)]);
          const totalLessons = lessons.length;
          const completedCount = progress.completedLessonIds.length;
          const progressPct = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
          return { course, totalLessons, completedCount, progressPct } satisfies EnrolledCourseProgress;
        }),
      );
      this.entries.set(entries);
      this.loading.set(false);
    } catch (err) {
      this.entries.set([]);
      this.error.set(err as ApiError);
      this.loading.set(false);
    }
  }
}
