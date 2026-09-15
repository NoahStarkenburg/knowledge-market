import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import type { ApiError, CourseDto } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';

@Component({
  selector: 'app-creator-section',
  imports: [RouterLink, ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent],
  templateUrl: './creator.section.html',
})
export class CreatorSection implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly router = inject(Router);

  readonly courses = signal<CourseDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const result = await this.api.getMyCourses({ pageSize: 50 });
      this.courses.set(result.items);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }
}
