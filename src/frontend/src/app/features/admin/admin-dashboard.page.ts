import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckCircle, ChevronLeft, ChevronRight, LucideAngularModule, Search, XCircle } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import { setPageTitle } from '@core/page';
import type { AdminOrdersResult, AdminUsersResult, ApiError } from '@core/api/types';
import { AlertComponent, ButtonComponent, LoadingSpinnerComponent } from '@shared/ui';

const PAGE_SIZE = 10;
const searchInputClass = 'pl-8 pr-3 py-2 text-[13px] bg-chalk border-2 border-ink text-ink placeholder:text-ink-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/30 w-52 transition-colors';

interface RoleState {
  userId: string;
  status: 'confirming' | 'loading' | 'success' | 'error';
  errorMsg?: string;
}

@Component({
  selector: 'app-admin-users-panel',
  imports: [FormsModule, LucideAngularModule, AlertComponent, ButtonComponent, LoadingSpinnerComponent],
  templateUrl: './admin-dashboard.page.html',
})
export class AdminUsersPanel {
  private readonly api = inject(ApiService);
  readonly searchIcon = Search; readonly checkIcon = CheckCircle; readonly xIcon = XCircle; readonly leftIcon = ChevronLeft; readonly rightIcon = ChevronRight;
  readonly inputClass = searchInputClass;
  readonly pageSize = PAGE_SIZE;

  readonly query = signal('');
  readonly submittedQuery = signal('');
  readonly page = signal(1);
  readonly result = signal<AdminUsersResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly roleState = signal<RoleState | null>(null);
  readonly totalPages = computed(() => (this.result() ? Math.ceil(this.result()!.total / PAGE_SIZE) : 1));

  constructor() {
    effect(() => {
      this.submittedQuery(); this.page();
      void this.load();
    });
  }
  date(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
  search(): void {
    this.page.set(1);
    this.submittedQuery.set(this.query());
  }
  async confirmRole(userId: string): Promise<void> {
    this.roleState.update((p) => (p ? { ...p, status: 'loading' } : null));
    try {
      await this.api.adminAssignRole(userId, 'Admin');
      this.roleState.update((p) => (p ? { ...p, status: 'success' } : null));
      await this.load();
      setTimeout(() => this.roleState.set(null), 2000);
    } catch (err) {
      const e = err as ApiError;
      this.roleState.update((p) => (p ? { ...p, status: 'error', errorMsg: e.detail ?? e.message ?? 'Failed.' } : null));
    }
  }
  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await this.api.adminListUsers({ q: this.submittedQuery() || undefined, page: this.page(), pageSize: PAGE_SIZE }));
    } catch (err) {
      const e = err as ApiError;
      this.error.set(e.detail ?? e.message ?? 'Failed to load users.');
    } finally {
      this.loading.set(false);
    }
  }
}

type OrderStatusTab = 'all' | 'Pending' | 'Paid' | 'Refunded';
const STATUS_COLORS: Record<string, string> = {
  Paid: 'border-[#1f7a3d] bg-[#eafaf0] text-[#1b5e34]',
  Pending: 'border-[#9a6a00] bg-[#fff7e0] text-[#7a5400]',
  Refunded: 'border-cobalt bg-[#eef0ff] text-cobalt-deep',
  Cancelled: 'border-danger bg-[#fdeceb] text-danger',
};

@Component({
  selector: 'app-admin-orders-panel',
  imports: [FormsModule, LucideAngularModule, AlertComponent, ButtonComponent, LoadingSpinnerComponent],
  template: `
    <section class="bg-chalk border-2 border-ink">
      <div class="px-6 py-4 border-b-2 border-ink flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3"><h2 class="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink">Orders</h2>@if (result()) { <span class="font-mono uppercase tracking-[0.08em] text-[10px] font-bold bg-cobalt text-white px-2 py-1 tabular-nums">{{ result()!.total.toLocaleString() }}</span> }</div>
        <form (ngSubmit)="search()" class="flex items-center gap-2">
          <div class="relative"><lucide-icon [img]="searchIcon" class="w-3.5 h-3.5 text-ink-mute absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" /><input type="text" [ngModel]="query()" (ngModelChange)="query.set($event)" [ngModelOptions]="{ standalone: true }" placeholder="Search by course…" [class]="inputClass" /></div>
          <button appButton type="submit" size="sm" variant="secondary" [disabled]="loading()">Search</button>
        </form>
      </div>

      <div class="px-6 py-3 border-b-2 border-ink flex items-center justify-between flex-wrap gap-3">
        <div class="flex gap-2 flex-wrap">
          @for (tab of tabs; track tab.value) {
            <button (click)="statusFilter.set(tab.value); page.set(1)" class="px-3 py-1.5 font-mono uppercase tracking-[0.08em] text-[11px] font-bold border-2 border-ink transition-colors" [class]="statusFilter() === tab.value ? 'bg-ink text-paper' : 'bg-chalk text-ink-mute hover:bg-ink hover:text-paper'">{{ tab.label }}</button>
          }
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">From</span>
          <input type="date" [ngModel]="dateFrom()" (ngModelChange)="dateFrom.set($event); page.set(1)" [ngModelOptions]="{ standalone: true }" class="bg-chalk border-2 border-ink px-2 py-1.5 text-[12px] text-ink focus:outline-none focus:border-cobalt" />
          <span class="font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">To</span>
          <input type="date" [ngModel]="dateTo()" (ngModelChange)="dateTo.set($event); page.set(1)" [ngModelOptions]="{ standalone: true }" class="bg-chalk border-2 border-ink px-2 py-1.5 text-[12px] text-ink focus:outline-none focus:border-cobalt" />
        </div>
      </div>

      @if (loading() && !result()) {
        <div class="flex items-center justify-center py-16"><app-loading-spinner /></div>
      } @else if (error()) {
        <div class="px-6 py-6"><app-alert type="error">{{ error() }}</app-alert></div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full text-[13px]">
            <thead><tr class="border-b-2 border-ink bg-paper-dim"><th class="text-left px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">Order ID</th><th class="text-left px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">Buyer ID</th><th class="text-left px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">Course</th><th class="text-left px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">Amount</th><th class="text-left px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">Status</th><th class="text-left px-6 py-3 font-mono uppercase tracking-[0.1em] text-[10px] font-bold text-ink-mute">Date</th></tr></thead>
            <tbody>
              @if (result() && result()!.items.length === 0) { <tr><td colspan="6" class="px-6 py-10 text-center text-ink-mute">No orders found.</td></tr> }
              @for (order of result()?.items ?? []; track order.id) {
                <tr class="border-b-2 border-ink/10 hover:bg-paper-dim transition-colors">
                  <td class="px-6 py-3 font-mono text-ink-mute" [title]="order.id">{{ trunc(order.id) }}</td>
                  <td class="px-6 py-3 font-mono text-ink-mute" [title]="order.buyerId">{{ trunc(order.buyerId) }}</td>
                  <td class="px-6 py-3 text-ink max-w-[200px] truncate">{{ order.courseTitle }}</td>
                  <td class="px-6 py-3 text-ink tabular-nums font-semibold">{{ order.priceAmount === 0 ? 'Free' : order.priceAmount.toFixed(2) + ' ' + order.priceCurrency }}</td>
                  <td class="px-6 py-3"><span class="inline-flex px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-[0.08em] border-2 {{ badge(order.status) }}">{{ order.status }}</span></td>
                  <td class="px-6 py-3 text-ink-mute tabular-nums">{{ date(order.createdAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (result() && result()!.total > pageSize) {
          <div class="px-6 py-3 border-t-2 border-ink flex items-center justify-between">
            <span class="font-mono uppercase tracking-[0.1em] text-[11px] font-bold text-ink-mute">Page {{ page() }} of {{ totalPages() }}</span>
            <div class="flex items-center gap-1.5"><button appButton size="sm" variant="secondary" (click)="page.set(page() - 1)" [disabled]="page() <= 1 || loading()"><lucide-icon [img]="leftIcon" class="w-3.5 h-3.5" /></button><button appButton size="sm" variant="secondary" (click)="page.set(page() + 1)" [disabled]="page() >= totalPages() || loading()"><lucide-icon [img]="rightIcon" class="w-3.5 h-3.5" /></button></div>
          </div>
        }
      }
    </section>
  `,
})
export class AdminOrdersPanel {
  private readonly api = inject(ApiService);
  readonly searchIcon = Search; readonly leftIcon = ChevronLeft; readonly rightIcon = ChevronRight;
  readonly inputClass = searchInputClass;
  readonly pageSize = PAGE_SIZE;
  readonly tabs: { value: OrderStatusTab; label: string }[] = [
    { value: 'all', label: 'All' }, { value: 'Pending', label: 'Pending' }, { value: 'Paid', label: 'Paid' }, { value: 'Refunded', label: 'Refunded' },
  ];

  readonly page = signal(1);
  readonly result = signal<AdminOrdersResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly statusFilter = signal<OrderStatusTab>('all');
  readonly query = signal('');
  readonly submittedQuery = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly totalPages = computed(() => (this.result() ? Math.ceil(this.result()!.total / PAGE_SIZE) : 1));

  constructor() {
    effect(() => {
      this.page(); this.statusFilter(); this.submittedQuery(); this.dateFrom(); this.dateTo();
      void this.load();
    });
  }
  date(iso: string): string {
    return new Date(iso).toLocaleDateString();
  }
  trunc(id: string): string {
    return `${id.slice(0, 8)}…`;
  }
  badge(status: string): string {
    return STATUS_COLORS[status] ?? 'border-ink bg-paper-dim text-ink-mute';
  }
  search(): void {
    this.page.set(1);
    this.submittedQuery.set(this.query());
  }
  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.result.set(await this.api.adminListOrders({
        status: this.statusFilter() === 'all' ? undefined : this.statusFilter(),
        q: this.submittedQuery() || undefined,
        from: this.dateFrom() || undefined,
        to: this.dateTo() || undefined,
        page: this.page(),
        pageSize: PAGE_SIZE,
      }));
    } catch (err) {
      const e = err as ApiError;
      this.error.set(e.detail ?? e.message ?? 'Failed to load orders.');
    } finally {
      this.loading.set(false);
    }
  }
}

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [AdminUsersPanel, AdminOrdersPanel],
  template: `
    @if (!auth.isAdmin()) {
      <div class="min-h-screen bg-paper flex items-center justify-center px-6">
        <div class="bg-chalk border-2 border-ink shadow-hard px-10 py-12 flex flex-col items-center gap-4 max-w-md text-center">
          <div class="font-display display-x font-extrabold text-[64px] leading-none tracking-[-0.03em] text-danger">403</div>
          <h1 class="font-display font-bold uppercase tracking-[-0.01em] text-[22px] text-ink">Access Denied</h1>
          <p class="text-[14px] text-ink-mute">You do not have permission to view this page. Admin role required.</p>
        </div>
      </div>
    } @else {
      <div class="min-h-screen bg-paper">
        <div class="bg-grid border-b-2 border-ink">
          <div class="max-w-6xl mx-auto px-6 py-10">
            <div class="font-mono uppercase tracking-[0.14em] text-[11px] font-bold text-cobalt mb-3">Console</div>
            <h1 class="font-display display-x font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-ink text-[clamp(2.5rem,7vw,4rem)]">Admin Dashboard</h1>
            <p class="text-[14px] text-ink-soft mt-4 max-w-[60ch]">Manage users, orders, and platform settings.</p>
          </div>
        </div>
        <div class="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">
          <app-admin-users-panel />
          <app-admin-orders-panel />
        </div>
      </div>
    }
  `,
})
export class AdminDashboardPage {
  protected readonly auth = inject(AuthService);
  constructor() {
    setPageTitle('Admin');
  }
}
