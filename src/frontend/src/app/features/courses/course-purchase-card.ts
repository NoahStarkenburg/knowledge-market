import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import type { ApiError, CourseDto } from '@core/api/types';
import { AlertComponent, ButtonComponent, FormErrorListComponent } from '@shared/ui';
import { StarsComponent } from './stars';

// The sticky sidebar: price, rating summary, what-you-get, and the call to action, which is
// enroll/buy + subscribe for visitors, "go to course" for enrolled learners, and "manage
// lessons" for the owner. Owns the purchase/subscribe flows end to end.
@Component({
  selector: 'app-course-purchase-card',
  imports: [LucideAngularModule, AlertComponent, ButtonComponent, FormErrorListComponent, StarsComponent],
  templateUrl: './course-purchase-card.html',
})
export class CoursePurchaseCardComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly course = input.required<CourseDto>();
  readonly isOwner = input(false);
  readonly isEnrolled = input(false);
  readonly lessonsCount = input(0);
  readonly freePreviewCount = input(0);
  readonly avgRating = input<number | null>(null);
  readonly reviewsTotal = input(0);

  readonly chevronIcon = ChevronRight;

  readonly purchaseLoading = signal(false);
  readonly subscribeLoading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly successMessage = signal<string | undefined>(undefined);

  readonly roundAvg = computed(() => Math.round(this.avgRating() ?? 0));
  readonly whatYouGet = computed(() => [
    { label: 'Lessons', value: String(this.lessonsCount()) },
    { label: 'Lifetime access', value: 'Yes' },
    { label: 'All devices', value: 'Yes' },
    { label: 'Refund window', value: '14 days' },
  ]);

  fmtPrice(amount: number): string {
    if (amount === 0) return 'Free';
    return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`;
  }

  go(commands: unknown[]): void {
    this.router.navigate(commands);
  }

  async purchase(): Promise<void> {
    const c = this.course();
    this.error.set(undefined);
    this.successMessage.set(undefined);
    this.purchaseLoading.set(true);
    try {
      const order = await this.api.purchaseCourse(c.id);
      if (order.status === 'Paid') this.router.navigate(['/courses', c.id, 'lessons']);
      else this.router.navigate(['/checkout', order.id]);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.purchaseLoading.set(false);
    }
  }

  async subscribe(): Promise<void> {
    const c = this.course();
    this.error.set(undefined);
    this.successMessage.set(undefined);
    this.subscribeLoading.set(true);
    try {
      const sub = await this.api.subscribeToCreator(c.id);
      this.successMessage.set(`Subscribed successfully! ID: ${sub.subscription.id ?? 'OK'}`);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.subscribeLoading.set(false);
    }
  }
}
