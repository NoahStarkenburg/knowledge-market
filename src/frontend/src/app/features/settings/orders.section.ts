import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Search } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import type { ApiError, OrderDto } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, SkeletonComponent } from '@shared/ui';

type StatusTab = 'all' | 'Pending' | 'Paid' | 'Refunded';

@Component({
  selector: 'app-orders-section',
  imports: [FormsModule, RouterLink, LucideAngularModule, ButtonComponent, FormErrorListComponent, SkeletonComponent],
  templateUrl: './orders.section.html',
})
export class OrdersSection {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly searchIcon = Search;
  readonly tabs: { value: StatusTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Paid', label: 'Paid' },
    { value: 'Refunded', label: 'Refunded' },
  ];
  readonly pageSize = 20;

  readonly orders = signal<OrderDto[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly actionLoading = signal<string | null>(null);
  readonly actionError = signal<ApiError | undefined>(undefined);
  readonly refundConfirming = signal<string | null>(null);
  readonly refundSucceeded = signal<string | null>(null);

  readonly statusFilter = signal<StatusTab>('all');
  readonly searchInput = signal('');
  readonly debouncedQuery = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly hasFilters = computed(() => !!(this.debouncedQuery() || this.statusFilter() !== 'all' || this.dateFrom() || this.dateTo()));

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      this.page(); this.statusFilter(); this.debouncedQuery(); this.dateFrom(); this.dateTo();
      void this.loadOrders();
    });
  }

  onSearch(v: string): void {
    this.searchInput.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.debouncedQuery.set(v.trim());
      this.page.set(1);
    }, 350);
  }

  longDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
  withinRefundWindow(paidAt: string): boolean {
    return Date.now() - new Date(paidAt).getTime() < 24 * 60 * 60 * 1000;
  }

  payNow(orderId: string): void {
    this.actionLoading.set(orderId);
    this.actionError.set(undefined);
    this.router.navigate(['/checkout', orderId]);
    this.actionLoading.set(null);
  }

  async refund(orderId: string): Promise<void> {
    this.actionLoading.set(orderId);
    this.actionError.set(undefined);
    this.refundConfirming.set(null);
    try {
      await this.api.refundOrder(orderId);
      this.refundSucceeded.set(orderId);
      setTimeout(() => {
        this.refundSucceeded.set(null);
        void this.loadOrders();
      }, 2000);
    } catch (err) {
      this.actionError.set(err as ApiError);
    } finally {
      this.actionLoading.set(null);
    }
  }

  private async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const result = await this.api.listOrders({
        status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
        q: this.debouncedQuery() || undefined,
        from: this.dateFrom() || undefined,
        to: this.dateTo() || undefined,
        page: this.page(),
        pageSize: this.pageSize,
      });
      this.orders.set(result.items);
      this.total.set(result.total);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }
}
