import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChevronRight, LucideAngularModule } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import type { ApiError, CreatorDashboardDto, CreatorOrderItem } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';

const THUMB_TONES = ['bg-cobalt', 'bg-ink', 'bg-cobalt-deep', 'bg-[#1f7a3d]', 'bg-[#7a3b12]', 'bg-[#5b2d82]'];
function thumbTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return THUMB_TONES[Math.abs(hash) % THUMB_TONES.length];
}
function formatRevenue(amount: number): string {
  if (amount === 0) return '$0';
  return amount % 1 === 0 ? `$${amount.toLocaleString()}` : `$${amount.toFixed(2)}`;
}

@Component({
  selector: 'app-dashboard-section',
  imports: [RouterLink, LucideAngularModule, ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent],
  templateUrl: './dashboard.section.html',
})
export class DashboardSection implements OnInit {
  protected readonly api = inject(ApiService);

  readonly chevron = ChevronRight;
  readonly pageSize = 10;

  readonly dashboard = signal<CreatorDashboardDto | null>(null);
  readonly recentSales = signal<CreatorOrderItem[]>([]);
  readonly salesPage = signal(1);
  readonly salesTotal = signal(0);
  readonly loading = signal(false);
  readonly salesLoading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);

  readonly totalSalesPages = computed(() => Math.max(1, Math.ceil(this.salesTotal() / this.pageSize)));
  readonly stats = computed(() => {
    const d = this.dashboard();
    if (!d) return [];
    return [
      { label: 'Total revenue', value: formatRevenue(d.totalRevenue), note: 'all time' },
      { label: 'Enrollments', value: d.totalEnrollments.toLocaleString(), note: 'total students' },
      { label: 'Avg rating', value: d.averageRating != null ? d.averageRating.toFixed(1) : '—', note: `${d.totalReviews.toLocaleString()} review${d.totalReviews !== 1 ? 's' : ''}` },
      { label: 'Courses', value: String(d.totalCourses), note: `${d.publishedCourses} published${d.draftCourses > 0 ? ` · ${d.draftCourses} draft` : ''}` },
    ];
  });

  readonly tone = thumbTone;
  readonly fmtRev = formatRevenue;

  constructor() {
    effect(() => {
      this.salesPage();
      void this.loadSales();
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      this.dashboard.set(await this.api.getCreatorDashboard());
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }

  monthYear(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  saleDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private async loadSales(): Promise<void> {
    this.salesLoading.set(true);
    try {
      const result = await this.api.getCreatorOrders({ page: this.salesPage(), pageSize: this.pageSize });
      this.recentSales.set(result.items);
      this.salesTotal.set(result.total);
    } catch {
      // secondary
    } finally {
      this.salesLoading.set(false);
    }
  }
}
