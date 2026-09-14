import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, Search, X } from 'lucide-angular';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import { setPageTitle } from '@core/page';
import { formatPrice } from '@core/format';
import type { ApiError, CourseDto } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, SkeletonComponent } from '@shared/ui';

type StatusFilter = 'all' | 'Published' | 'Draft';

const THUMB_TONES = ['bg-cobalt', 'bg-ink', 'bg-cobalt-deep', 'bg-[#1f7a3d]', 'bg-[#7a3b12]', 'bg-[#5b2d82]'];

@Component({
  selector: 'app-courses-list-page',
  imports: [FormsModule, RouterLink, LucideAngularModule, ButtonComponent, FormErrorListComponent, SkeletonComponent],
  templateUrl: './courses-list.page.html',
})
export class CoursesListPage {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly searchIcon = Search;
  readonly xIcon = X;
  readonly today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  readonly pageSize = 20;
  readonly fmtPrice = formatPrice;
  readonly sortOptions = [
    { value: '', label: 'Newest first' },
    { value: 'price_asc', label: 'Price · low to high' },
    { value: 'price_desc', label: 'Price · high to low' },
  ];
  readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'Published', label: 'Published' },
    { value: 'Draft', label: 'My drafts' },
    { value: 'all', label: 'All' },
  ];

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  readonly statusFilter = computed<StatusFilter>(() => (this.params().get('status') as StatusFilter) || 'Published');
  readonly page = computed(() => Math.max(1, parseInt(this.params().get('page') || '1', 10)));
  readonly selectedTag = computed(() => this.params().get('tag'));
  readonly sortBy = computed(() => this.params().get('sortBy') || '');
  readonly urlQuery = computed(() => this.params().get('q') || '');
  readonly urlMinPrice = computed(() => this.params().get('minPrice') || '');
  readonly urlMaxPrice = computed(() => this.params().get('maxPrice') || '');

  readonly searchInput = signal('');
  readonly minPriceInput = signal('');
  readonly maxPriceInput = signal('');
  readonly tagSearch = signal('');
  readonly allTags = signal<string[]>([]);
  readonly courses = signal<CourseDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly pagedTotal = signal(0);

  readonly isSearchMode = computed(() => this.urlQuery().length > 0);
  readonly isFilteredMode = computed(
    () => this.isSearchMode() || this.selectedTag() !== null || this.urlMinPrice() !== '' || this.urlMaxPrice() !== '' || this.sortBy() !== '',
  );
  readonly visibleTags = computed(() => {
    const s = this.tagSearch().trim().toLowerCase();
    return s ? this.allTags().filter((t) => t.toLowerCase().includes(s)) : this.allTags();
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.pagedTotal() / this.pageSize)));
  readonly activeFilterCount = computed(
    () => (this.urlQuery() ? 1 : 0) + (this.selectedTag() ? 1 : 0) + (this.urlMinPrice() ? 1 : 0) + (this.urlMaxPrice() ? 1 : 0) + (this.sortBy() ? 1 : 0),
  );

  private searchTimer?: ReturnType<typeof setTimeout>;
  private priceTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    setPageTitle('Catalog');
    this.searchInput.set(this.urlQuery());
    this.minPriceInput.set(this.urlMinPrice());
    this.maxPriceInput.set(this.urlMaxPrice());
    this.fetchTags();
    // Reload whenever any URL-driven filter changes.
    effect(() => {
      this.statusFilter(); this.page(); this.selectedTag(); this.sortBy(); this.urlQuery(); this.urlMinPrice(); this.urlMaxPrice();
      void this.loadCourses();
    });
  }

  thumbTone(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return THUMB_TONES[Math.abs(hash) % THUMB_TONES.length];
  }

  rowNo(idx: number): string {
    return String((this.page() - 1) * this.pageSize + idx + 1).padStart(3, '0');
  }

  pageStr(p: number): string {
    return String(Math.min(this.totalPages(), Math.max(1, p)));
  }

  onSearchChange(v: string): void {
    this.searchInput.set(v);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.updateParams({ q: v.trim() || null, page: null }), 350);
  }

  onPriceChange(): void {
    clearTimeout(this.priceTimer);
    this.priceTimer = setTimeout(() => this.updateParams({ minPrice: this.minPriceInput() || null, maxPrice: this.maxPriceInput() || null, page: null }), 350);
  }

  updateParams(updates: Record<string, string | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: updates, queryParamsHandling: 'merge' });
  }

  clearAllFilters(): void {
    this.searchInput.set('');
    this.minPriceInput.set('');
    this.maxPriceInput.set('');
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  private async fetchTags(): Promise<void> {
    try {
      const result = await this.api.listCourses({ status: 'Published', page: 1, pageSize: 100 });
      const seen = new Set<string>();
      result.items.forEach((c) => c.tags.forEach((t) => seen.add(t)));
      this.allTags.set([...seen].sort((a, b) => a.localeCompare(b)));
    } catch {
      // non-critical
    }
  }

  private async loadCourses(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    try {
      if (this.isFilteredMode()) {
        const result = await this.api.searchCourses({
          q: this.urlQuery() || undefined,
          tags: this.selectedTag() || undefined,
          minPrice: this.urlMinPrice() ? Number(this.urlMinPrice()) : undefined,
          maxPrice: this.urlMaxPrice() ? Number(this.urlMaxPrice()) : undefined,
          sortBy: this.sortBy() || undefined,
          page: this.page(),
          pageSize: this.pageSize,
        });
        this.courses.set(result.items);
        this.pagedTotal.set(result.total);
      } else {
        const status = this.statusFilter() === 'all' ? undefined : this.statusFilter();
        const result = await this.api.listCourses({ status, page: this.page(), pageSize: this.pageSize });
        this.courses.set(result.items);
        this.pagedTotal.set(result.total);
        const seen = new Set<string>();
        result.items.forEach((c) => c.tags.forEach((t) => seen.add(t)));
        if (seen.size > 0) {
          this.allTags.set([...new Set([...this.allTags(), ...seen])].sort((a, b) => a.localeCompare(b)));
        }
      }
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }
}
