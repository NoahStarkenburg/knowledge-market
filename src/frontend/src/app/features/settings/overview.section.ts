import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import { EnrolledCoursesStore } from '@core/enrolled-courses.store';
import type { ApiError, CourseDto, OrderDto } from '@core/api/types';
import { FormErrorListComponent, SkeletonComponent } from '@shared/ui';

@Component({
  selector: 'app-overview-section',
  imports: [RouterLink, FormErrorListComponent, SkeletonComponent],
  providers: [EnrolledCoursesStore],
  templateUrl: './overview.section.html',
})
export class OverviewSection implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  protected readonly store = inject(EnrolledCoursesStore);

  readonly myCourses = signal<CourseDto[]>([]);
  readonly recentOrders = signal<OrderDto[]>([]);
  readonly totalOrders = signal(0);
  readonly dataLoading = signal(false);
  readonly dataError = signal<ApiError | undefined>(undefined);

  readonly initials = computed(() => {
    const email = this.auth.email();
    if (!email) return '?';
    return email.split('@')[0].split(/[._-]/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('');
  });
  readonly username = computed(() => this.auth.email()?.split('@')[0] ?? 'User');

  async ngOnInit(): Promise<void> {
    void this.store.reload();
    this.dataLoading.set(true);
    this.dataError.set(undefined);
    try {
      const [coursesResult, ordersResult] = await Promise.all([this.api.getMyCourses({ pageSize: 50 }), this.api.listOrders({ page: 1, pageSize: 3 })]);
      this.myCourses.set(coursesResult.items);
      this.recentOrders.set(ordersResult.items);
      this.totalOrders.set(ordersResult.total);
    } catch (err) {
      this.dataError.set(err as ApiError);
    } finally {
      this.dataLoading.set(false);
    }
  }
}
