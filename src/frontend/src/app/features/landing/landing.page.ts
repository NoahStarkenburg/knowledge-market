import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '@core/api/api.service';
import { NavbarComponent } from '@layout/navbar';
import { FooterComponent } from '@layout/footer';
import { setPageTitle } from '@core/page';
import { formatDate, formatPrice } from '@core/format';
import type { CourseDto } from '@core/api/types';

@Component({
  selector: 'app-featured-card',
  imports: [RouterLink],
  templateUrl: './landing.page.html',
})
export class FeaturedCardComponent {
  course = input.required<CourseDto>();
  index = input.required<number>();
  highlight = input(false);

  readonly cardBase = 'group flex flex-col border-2 border-ink p-6 transition-[transform,box-shadow] duration-100 hover:-translate-x-[3px] hover:-translate-y-[3px] hover:shadow-hard';
  metaTone = computed(() => (this.highlight() ? 'text-white/70' : 'text-ink-mute'));
  price = computed(() => formatPrice(this.course().priceAmount, this.course().priceCurrency));
}

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, NavbarComponent, FooterComponent, FeaturedCardComponent],
  template: `
    <div class="min-h-screen bg-paper text-ink">
      <app-navbar />
      <main id="main">
        <!-- STATUS STRIP -->
        <div class="border-b-2 border-ink">
          <div class="max-w-[1320px] mx-auto px-5 sm:px-6 h-9 flex items-center justify-between font-mono uppercase tracking-[0.14em] text-[10px] font-bold text-ink">
            <span>Vol. 01 / The Catalog</span>
            <span class="hidden sm:inline text-ink-mute">{{ dateLine }}</span>
            <span class="text-cobalt">{{ stats() ? stats()!.publishedCourses + ' courses / ' + stats()!.creators + ' makers' : 'Loading…' }}</span>
          </div>
        </div>

        <!-- HERO -->
        <section class="relative overflow-hidden border-b-2 border-ink">
          <div aria-hidden="true" class="pointer-events-none absolute inset-0">
            <div class="absolute inset-0 bg-grid animate-grid-pan"></div>
            <div class="absolute -left-16 top-10 w-44 h-44 border-2 border-cobalt/20 animate-spin-slow"></div>
            <div class="absolute left-[20%] bottom-8 w-16 h-16 border-2 border-ink/15 animate-float-rev"></div>
            <div class="absolute right-[32%] top-14 w-10 h-10 bg-signal/40 animate-float"></div>
            <div class="absolute right-[10%] bottom-14 w-8 h-8 bg-cobalt/20 animate-float-rev"></div>
          </div>
          <div class="relative z-10 max-w-[1320px] mx-auto px-5 sm:px-6 pt-12 pb-10 md:pt-16 md:pb-12">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
              <div class="lg:col-span-8">
                <p class="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-ink-mute mb-6">An independent catalog · est. 2026</p>
                <h1 class="font-display display-x font-extrabold uppercase tracking-[-0.04em] leading-[0.82] text-ink text-[clamp(3.25rem,11vw,8.5rem)]">
                  <span class="block overflow-hidden"><span class="block animate-rise [animation-delay:0ms]">Learn</span></span>
                  <span class="block overflow-hidden"><span class="block animate-rise [animation-delay:90ms]">the <span class="bg-signal text-ink px-2 box-decoration-clone">hard</span></span></span>
                  <span class="block overflow-hidden"><span class="block animate-rise [animation-delay:180ms]">things.</span></span>
                </h1>
                <p class="mt-7 text-[17px] md:text-[19px] leading-[1.5] text-ink-soft max-w-[46ch]">Courses on the parts of building software and products that are genuinely hard, taught by people who do the work. Buy one course, or subscribe for all of them.</p>
                <div class="mt-8 flex flex-wrap items-center gap-3">
                  <a routerLink="/courses" class="inline-flex items-center font-mono uppercase tracking-[0.08em] text-[12px] font-bold bg-ink text-paper border-2 border-ink px-6 py-3.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100">Browse the catalog →</a>
                  <a routerLink="/register" class="inline-flex items-center font-mono uppercase tracking-[0.08em] text-[12px] font-bold bg-paper text-ink border-2 border-ink px-6 py-3.5 hover:bg-ink hover:text-paper active:translate-x-[3px] active:translate-y-[3px] transition-[background-color,color,transform] duration-100">Teach on KM</a>
                </div>
              </div>
              <div class="lg:col-span-4">
                <div class="bg-cobalt bg-grid-cobalt text-white border-2 border-ink shadow-hard divide-y-2 divide-white/25">
                  @for (s of monolith(); track s.label) {
                    <div class="px-6 py-6">
                      <div class="font-display display-x font-extrabold tabular-nums tracking-[-0.03em] leading-none text-[64px] md:text-[72px]">{{ s.value }}</div>
                      <div class="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-white/75 mt-3">{{ s.label }}</div>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- FIELD INDEX -->
        @if (fields().length > 0) {
          <section class="border-b-2 border-ink bg-ink text-paper">
            <div class="max-w-[1320px] mx-auto px-5 sm:px-6 py-4 flex items-center gap-5 overflow-x-auto">
              <span class="font-mono uppercase tracking-[0.16em] text-[10px] font-bold text-paper/60 shrink-0">Fields</span>
              <div class="flex items-center gap-2.5">
                @for (f of fields(); track f) {
                  <a [routerLink]="['/courses']" [queryParams]="{ tag: f }" class="shrink-0 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-paper border-2 border-paper/30 px-3 py-1.5 hover:bg-signal hover:text-ink hover:border-signal transition-colors">{{ f }}</a>
                }
              </div>
            </div>
          </section>
        }

        <!-- TODAY / WHAT'S NEW -->
        <section class="border-b-2 border-ink">
          <div class="max-w-[1320px] mx-auto px-5 sm:px-6 py-12 md:py-16">
            <div class="flex items-end justify-between gap-4 mb-8">
              <div>
                <p class="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">Just added</p>
                <h2 class="font-display font-extrabold uppercase tracking-[-0.02em] text-[clamp(1.8rem,5vw,3rem)] leading-[0.95]">Fresh off the press</h2>
              </div>
              <a routerLink="/courses" class="hidden sm:inline font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-ink underline underline-offset-4 decoration-2 decoration-cobalt hover:text-cobalt shrink-0">See all →</a>
            </div>

            @if (loading() && todayCourses().length === 0) {
              <ul class="border-t-2 border-ink">
                @for (i of [0,1,2,3]; track i) {
                  <li class="grid grid-cols-12 gap-4 py-5 border-b-2 border-ink">
                    <div class="col-span-1 h-3 bg-paper-dim animate-pulse"></div>
                    <div class="col-span-2 h-3 bg-paper-dim animate-pulse"></div>
                    <div class="col-span-7 h-6 bg-paper-dim animate-pulse"></div>
                    <div class="col-span-2 h-4 bg-paper-dim animate-pulse"></div>
                  </li>
                }
              </ul>
            } @else if (todayCourses().length === 0) {
              <div class="border-y-2 border-ink py-12"><p class="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink-mute text-center">The catalog is still being assembled. Check back tomorrow.</p></div>
            } @else {
              <ul class="border-t-2 border-ink">
                @for (c of todayCourses(); track c.id) {
                  <li>
                    <a [routerLink]="['/courses', c.id]" class="group grid grid-cols-12 gap-3 md:gap-4 items-center py-4 md:py-5 border-b-2 border-ink px-2 -mx-2 hover:bg-ink transition-colors">
                      <div class="col-span-3 md:col-span-1 font-mono uppercase tracking-[0.08em] text-[10px] md:text-[11px] font-bold text-ink-mute group-hover:text-paper/60">{{ fmtDate(c.publishedAt ?? c.createdAt) }}</div>
                      <div class="hidden md:block md:col-span-2 font-mono uppercase tracking-[0.08em] text-[11px] font-bold text-cobalt group-hover:text-signal truncate">{{ c.tags?.[0] ?? 'General' }}</div>
                      <div class="col-span-9 md:col-span-7 font-display font-bold tracking-[-0.01em] text-[20px] md:text-[26px] leading-[1.05] text-ink group-hover:text-paper">{{ c.title }}</div>
                      <div class="hidden md:block md:col-span-2 font-display font-extrabold text-[20px] text-right tabular-nums text-cobalt group-hover:text-signal">{{ fmtPrice(c.priceAmount, c.priceCurrency) }}</div>
                    </a>
                  </li>
                }
              </ul>
            }
          </div>
        </section>

        <!-- FEATURED -->
        <section class="border-b-2 border-ink bg-paper-dim/40">
          <div class="max-w-[1320px] mx-auto px-5 sm:px-6 py-12 md:py-16">
            <div class="flex items-end justify-between gap-4 mb-8">
              <div>
                <p class="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-3">Editor's selection</p>
                <h2 class="font-display font-extrabold uppercase tracking-[-0.02em] text-[clamp(1.8rem,5vw,3rem)] leading-[0.95] max-w-[16ch]">Picked by hand, not by an algorithm</h2>
              </div>
            </div>

            @if (loading() && featuredCourses().length === 0) {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                @for (i of [0,1,2,3,4,5]; track i) { <div class="h-52 bg-paper-dim animate-pulse border-2 border-ink"></div> }
              </div>
            } @else if (featuredCourses().length === 0) {
              <div class="border-y-2 border-ink py-12"><p class="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-ink-mute text-center">No published courses yet. Check back soon.</p></div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                @for (c of featuredCourses(); track c.id; let idx = $index) {
                  <app-featured-card [course]="c" [index]="idx" [highlight]="idx === 0" />
                }
              </div>
            }
          </div>
        </section>

        <!-- TEACH -->
        <section class="border-b-2 border-ink">
          <div class="max-w-[1320px] mx-auto px-5 sm:px-6 py-14 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div class="lg:col-span-5">
              <p class="font-mono uppercase tracking-[0.16em] text-[11px] font-bold text-cobalt mb-5">For makers</p>
              <h2 class="font-display display-x font-extrabold uppercase tracking-[-0.03em] leading-[0.9] text-[clamp(2.25rem,6vw,4rem)]">Get paid for what you already know</h2>
              <p class="mt-6 text-[16px] leading-[1.6] text-ink-soft max-w-[42ch]">No agent, no production crew, no platform fees buried in your royalty statement. Upload, set a price, get paid.</p>
              <a routerLink="/register" class="inline-flex items-center mt-8 font-mono uppercase tracking-[0.08em] text-[12px] font-bold bg-ink text-paper border-2 border-ink px-6 py-3.5 shadow-hard-sm hover:bg-cobalt hover:border-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,border-color,transform,box-shadow] duration-100">Start teaching →</a>
            </div>
            <ol class="lg:col-span-7 lg:pl-10 lg:border-l-2 lg:border-ink grid sm:grid-cols-2 gap-x-8 gap-y-8 self-center">
              @for (st of steps; track st.n) {
                <li>
                  <div class="font-mono uppercase tracking-[0.12em] text-[12px] font-bold text-cobalt mb-2">{{ st.n }}</div>
                  <div class="font-display font-bold uppercase tracking-[-0.01em] text-[19px] text-ink mb-1.5">{{ st.title }}</div>
                  <p class="text-[14px] leading-[1.55] text-ink-soft">{{ st.body }}</p>
                </li>
              }
            </ol>
          </div>
        </section>

        <!-- CLOSING SIGNAL BAND -->
        <section class="bg-signal border-b-2 border-ink">
          <div class="max-w-[1320px] mx-auto px-5 sm:px-6 py-12 md:py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <h2 class="font-display display-x font-extrabold uppercase tracking-[-0.03em] leading-[0.9] text-ink text-[clamp(2rem,6vw,3.75rem)] max-w-[18ch]">Start with one course today</h2>
            <a routerLink="/courses" class="shrink-0 inline-flex items-center font-mono uppercase tracking-[0.08em] text-[13px] font-bold bg-ink text-signal border-2 border-ink px-7 py-4 shadow-hard hover:bg-cobalt hover:text-white active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-[background-color,color,transform,box-shadow] duration-100">Open the catalog →</a>
          </div>
        </section>
      </main>
      <app-footer />
    </div>
  `,
})
export class LandingPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly courses = signal<CourseDto[]>([]);
  readonly stats = signal<{ publishedCourses: number; creators: number } | null>(null);
  readonly loading = signal(true);

  readonly todayCourses = computed(() => this.courses().slice(0, 4));
  readonly featuredCourses = computed(() => this.courses().slice(0, 6));
  readonly fields = computed(() => {
    const seen = new Set<string>();
    for (const c of this.courses()) for (const t of c.tags ?? []) seen.add(t);
    return [...seen].slice(0, 8);
  });
  readonly monolith = computed(() => {
    const s = this.stats();
    return [
      { value: s ? String(s.publishedCourses).padStart(2, '0') : '00', label: 'Courses in print' },
      { value: s ? String(s.creators).padStart(2, '0') : '00', label: 'Makers teaching' },
      { value: this.fields().length > 0 ? String(this.fields().length).padStart(2, '0') : '00', label: 'Fields covered' },
    ];
  });

  readonly dateLine = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  readonly steps = [
    { n: '01', title: 'Upload lessons', body: 'Markdown, video, audio, PDF. Drag and drop or paste a link.' },
    { n: '02', title: 'Set your price', body: 'One-time purchase or recurring access. Change it whenever.' },
    { n: '03', title: 'We handle payments', body: 'Stripe checkout, invoicing, refunds, and chargebacks.' },
    { n: '04', title: 'Keep your audience', body: 'Export your students any time. We never lock you in.' },
  ];

  readonly fmtPrice = formatPrice;
  readonly fmtDate = formatDate;

  constructor() {
    setPageTitle();
  }

  async ngOnInit(): Promise<void> {
    const [fc, st] = await Promise.all([
      this.api.getFeaturedCourses(7).catch(() => [] as CourseDto[]),
      this.api.getCatalogStats().catch(() => ({ publishedCourses: 0, creators: 0 })),
    ]);
    this.courses.set(fc);
    this.stats.set(st);
    this.loading.set(false);
  }
}
