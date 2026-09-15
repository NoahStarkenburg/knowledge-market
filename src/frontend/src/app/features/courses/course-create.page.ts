import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { setPageTitle } from '@core/page';
import type { ApiError, CreateCourseRequest } from '@core/api/types';
import { ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective } from '@shared/ui';

@Component({
  selector: 'app-course-create-page',
  imports: [FormsModule, ButtonComponent, FieldComponent, FormErrorListComponent, InputDirective],
  templateUrl: './course-create.page.html',
})
export class CourseCreatePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly title = signal('');
  readonly desc = signal('');
  readonly priceAmount = signal(0);
  readonly priceCurrency = signal('USD');
  readonly tagsInput = signal('');
  readonly error = signal<ApiError | undefined>(undefined);
  readonly loading = signal(false);

  constructor() {
    setPageTitle('New course');
  }

  async submit(): Promise<void> {
    this.error.set(undefined);
    this.loading.set(true);
    const tags = this.tagsInput()
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);
    const req: CreateCourseRequest = {
      title: this.title(),
      description: this.desc(),
      priceAmount: this.priceAmount(),
      priceCurrency: this.priceCurrency(),
      tags,
    };
    try {
      const course = await this.api.createCourse(req);
      this.router.navigate(['/courses', course.id]);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }
}
