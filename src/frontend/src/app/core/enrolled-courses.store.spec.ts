import { TestBed } from '@angular/core/testing';
import { ApiService } from '@core/api/api.service';
import { EnrolledCoursesStore } from './enrolled-courses.store';

describe('EnrolledCoursesStore', () => {
  let api: {
    getPurchasedCourses: ReturnType<typeof vi.fn>;
    listLessons: ReturnType<typeof vi.fn>;
    getCourseProgress: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    api = { getPurchasedCourses: vi.fn(), listLessons: vi.fn(), getCourseProgress: vi.fn() };
    TestBed.configureTestingModule({ providers: [EnrolledCoursesStore, { provide: ApiService, useValue: api }] });
  });

  it('combines each purchased course with its lesson progress', async () => {
    api.getPurchasedCourses.mockResolvedValue({ items: [{ id: 'c1' }, { id: 'c2' }] });
    api.listLessons.mockImplementation((id: string) => Promise.resolve(id === 'c1' ? [{}, {}, {}, {}] : []));
    api.getCourseProgress.mockImplementation((id: string) =>
      Promise.resolve({ completedLessonIds: id === 'c1' ? ['l1'] : [] }),
    );
    const store = TestBed.inject(EnrolledCoursesStore);

    await store.reload();

    expect(store.entries()).toEqual([
      { course: { id: 'c1' }, totalLessons: 4, completedCount: 1, progressPct: 25 },
      // A course with no lessons yet is 0%, not a division by zero.
      { course: { id: 'c2' }, totalLessons: 0, completedCount: 0, progressPct: 0 },
    ]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeUndefined();
  });

  it('exposes the error and clears entries when loading fails', async () => {
    api.getPurchasedCourses.mockRejectedValue({ status: 500, title: 'Server error' });
    const store = TestBed.inject(EnrolledCoursesStore);

    await store.reload();

    expect(store.entries()).toEqual([]);
    expect(store.error()).toEqual({ status: 500, title: 'Server error' });
    expect(store.loading()).toBe(false);
  });
});
