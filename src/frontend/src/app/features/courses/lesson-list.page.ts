import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, Lock, LucideAngularModule, PlayCircle, Trash2 } from 'lucide-angular';
import { Title } from '@angular/platform-browser';
import { ApiService } from '@core/api/api.service';
import { AuthService } from '@core/auth.service';
import type { ApiError, CourseDto, LessonItem, LessonListItem } from '@core/api/types';
import { ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent } from '@shared/ui';

interface LessonState {
  expanded: boolean;
  content: LessonItem[] | null;
  contentLoading: boolean;
  accessDenied?: boolean;
}

@Component({
  selector: 'app-lesson-list-page',
  imports: [FormsModule, RouterLink, LucideAngularModule, ButtonComponent, FormErrorListComponent, LoadingSpinnerComponent],
  templateUrl: './lesson-list.page.html',
})
export class LessonListPage {
  protected readonly api = inject(ApiService);
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly titleSvc = inject(Title);

  readonly chevronLeft = ChevronLeft;
  readonly chevronDown = ChevronDown;
  readonly chevronRight = ChevronRight;
  readonly grip = GripVertical;
  readonly lock = Lock;
  readonly play = PlayCircle;
  readonly trash = Trash2;

  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  readonly courseId = computed(() => this.params().get('courseId') ?? '');

  readonly lessons = signal<LessonListItem[]>([]);
  readonly lessonStates = signal<Record<string, LessonState>>({});
  readonly loading = signal(false);
  readonly error = signal<ApiError | undefined>(undefined);
  readonly isOwner = signal<boolean | null>(null);
  readonly isEnrolled = signal(false);
  readonly courseDetail = signal<CourseDto | null>(null);

  readonly title = signal('');
  readonly body = signal('');
  readonly isFreePreview = signal(false);
  readonly createError = signal<ApiError | undefined>(undefined);
  readonly createLoading = signal(false);

  readonly draggedId = signal<string | null>(null);
  readonly dragOverId = signal<string | null>(null);
  readonly reorderError = signal<ApiError | undefined>(undefined);

  readonly confirmDeleteId = signal<string | null>(null);
  readonly deleteLoading = signal(false);

  constructor() {
    effect(() => {
      const cd = this.courseDetail();
      this.titleSvc.setTitle(cd ? `Lessons · ${cd.title} · KnowledgeMarket` : 'Lessons · KnowledgeMarket');
    });
    effect(() => {
      this.courseId();
      this.auth.userId();
      void this.loadLessons();
    });
  }

  liClasses(id: string): string {
    const dragged = this.draggedId() === id ? 'opacity-40 ' : '';
    const over = this.dragOverId() === id && this.draggedId() !== id ? 'bg-cobalt/10' : '';
    return dragged + over;
  }

  state(id: string): LessonState | undefined {
    return this.lessonStates()[id];
  }
  sortedContent(id: string): LessonItem[] {
    return [...(this.lessonStates()[id]?.content ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  private patchState(id: string, partial: Partial<LessonState>): void {
    this.lessonStates.update((prev) => ({ ...prev, [id]: { ...prev[id], ...partial } }));
  }

  private async loadLessons(): Promise<void> {
    const id = this.courseId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const [course, result] = await Promise.all([this.api.getCourse(id), this.api.listLessons(id)]);
      this.courseDetail.set(course);
      const uid = this.auth.userId();
      const owner = !!(uid && course.createdById === uid);
      this.isOwner.set(owner);

      if (!owner && uid) {
        try {
          const { enrolled } = await this.api.checkEnrollment(id);
          this.isEnrolled.set(enrolled);
        } catch {
          this.isEnrolled.set(false);
        }
      } else if (owner) {
        this.isEnrolled.set(true);
      }

      const sorted = [...result].sort((a, b) => a.sortOrder - b.sortOrder);
      this.lessons.set(sorted);
      const prev = this.lessonStates();
      const states: Record<string, LessonState> = {};
      sorted.forEach((l) => (states[l.id] = prev[l.id] ?? { expanded: false, content: null, contentLoading: false }));
      this.lessonStates.set(states);
    } catch (err) {
      this.error.set(err as ApiError);
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(lesson: LessonListItem): Promise<void> {
    const id = this.courseId();
    if (!id) return;
    const st = this.state(lesson.id);
    if (!st) return;

    if (st.expanded) {
      this.patchState(lesson.id, { expanded: false });
      return;
    }
    if (st.content !== null) {
      this.patchState(lesson.id, { expanded: true });
      return;
    }
    this.patchState(lesson.id, { contentLoading: true });
    try {
      const items = await this.api.getLessonContent(id, lesson.id);
      this.lessonStates.update((prev) => ({ ...prev, [lesson.id]: { expanded: true, content: items, contentLoading: false } }));
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const denied = status === 401 || status === 403;
      this.patchState(lesson.id, { contentLoading: false, expanded: true, accessDenied: denied });
    }
  }

  async createLesson(): Promise<void> {
    const id = this.courseId();
    if (!id) return;
    this.createError.set(undefined);
    this.createLoading.set(true);
    try {
      const { id: lessonId } = await this.api.createLesson(id, { title: this.title(), body: '', isFreePreview: this.isFreePreview() });
      if (this.body().trim()) {
        await this.api.createLessonText(id, lessonId, { title: 'Overview', bodyMarkdown: this.body().trim() });
      }
      this.title.set('');
      this.body.set('');
      this.isFreePreview.set(false);
      await this.loadLessons();
    } catch (err) {
      this.createError.set(err as ApiError);
    } finally {
      this.createLoading.set(false);
    }
  }

  async deleteLesson(lessonId: string): Promise<void> {
    const id = this.courseId();
    if (!id) return;
    this.deleteLoading.set(true);
    try {
      await this.api.deleteLesson(id, lessonId);
      this.confirmDeleteId.set(null);
      await this.loadLessons();
    } catch (err) {
      this.reorderError.set(err as ApiError);
    } finally {
      this.deleteLoading.set(false);
    }
  }

  onDragOver(e: DragEvent, id: string): void {
    e.preventDefault();
    this.dragOverId.set(id);
  }

  async onDrop(e: DragEvent, targetId: string): Promise<void> {
    e.preventDefault();
    this.dragOverId.set(null);
    const id = this.courseId();
    const dragged = this.draggedId();
    if (!id || !dragged || dragged === targetId) {
      this.draggedId.set(null);
      return;
    }
    const reordered = [...this.lessons()];
    const fromIdx = reordered.findIndex((l) => l.id === dragged);
    const toIdx = reordered.findIndex((l) => l.id === targetId);
    if (fromIdx === -1 || toIdx === -1) {
      this.draggedId.set(null);
      return;
    }
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    this.lessons.set(reordered);
    this.draggedId.set(null);
    this.reorderError.set(undefined);
    try {
      await this.api.reorderLessons(id, { items: reordered.map((l, idx) => ({ kind: 'text', id: l.id, newSort: idx + 1 })) });
    } catch (err) {
      this.reorderError.set(err as ApiError);
      await this.loadLessons();
    }
  }
}
