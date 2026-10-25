import { check, group } from 'k6';
import { anonGet, randomVisitorIp, uuid } from './client.js';

// Each function is one page of the Angular app, making the same API calls the page makes
// (see src/frontend/src/app/features). JavaScript bundles are left out: they are hashed,
// cached for a year by the browser and served by Front Door's edge in production.

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const ok = (res, label) => check(res, { [label]: (r) => r.status >= 200 && r.status < 400 });

// Anyone, signed in or not.
export function landing() {
  group('landing', () => {
    const ip = randomVisitorIp();
    ok(anonGet('/', ip, 'GET / (index.html)', 'static'), 'index.html served');
    ok(anonGet('/api/catalog/stats', ip, 'GET /api/catalog/stats'), 'stats');
    ok(anonGet('/api/catalog/featured?count=6', ip, 'GET /api/catalog/featured'), 'featured');
  });
}

export function catalog(session, data) {
  group('catalog', () => {
    const page = 1 + Math.floor(Math.random() * Math.ceil(data.courses.length / 12));
    ok(session.get(`/api/courses/?status=Published&page=${page}&pageSize=12`, 'GET /api/courses'), 'catalog page');
  });
}

export function search(session, data) {
  group('search', () => {
    const term = encodeURIComponent(pick(data.searchTerms));
    ok(session.get(`/api/courses/search?q=${term}&page=1&pageSize=12`, 'GET /api/courses/search'), 'search results');
  });
}

export function courseDetail(session, data) {
  group('course detail', () => {
    const c = pick(data.courses);
    const calls = [
      [`/api/courses/${c.id}`, 'GET /api/courses/{id}'],
      [`/api/courses/${c.id}/lessons`, 'GET /api/courses/{id}/lessons'],
      [`/api/orders/check?courseId=${c.id}`, 'GET /api/orders/check'],
      [`/api/courses/${c.id}/reviews?page=1&pageSize=5`, 'GET /api/courses/{id}/reviews'],
      [`/api/catalog/by-creator/${c.creatorId}?exclude=${c.id}&count=4`, 'GET /api/catalog/by-creator/{id}'],
    ];
    if (c.thumbnail) calls.push([`/api/courses/${c.id}/thumbnail`, 'GET /api/courses/{id}/thumbnail']);
    session.batch(calls).forEach((res, i) => ok(res, calls[i][1]));
  });
}

// A lesson in a course the learner owns, or a free preview lesson when they own nothing yet.
export function lessonView(session, data, state) {
  group('lesson', () => {
    if (!state.owned) {
      const res = session.get('/api/courses/purchased?page=1&pageSize=50', 'GET /api/courses/purchased');
      state.owned = res.status === 200 ? res.json('items').map((c) => c.id) : [];
    }
    const owns = state.owned.length > 0;
    const courseId = owns ? pick(state.owned) : pick(data.courses).id;

    const [course, lessons] = session.batch([
      [`/api/courses/${courseId}`, 'GET /api/courses/{id}'],
      [`/api/courses/${courseId}/lessons`, 'GET /api/courses/{id}/lessons'],
      [`/api/courses/${courseId}/lessons/progress`, 'GET /api/courses/{id}/lessons/progress'],
      [`/api/orders/check?courseId=${courseId}`, 'GET /api/orders/check'],
    ]);
    ok(course, 'lesson page course');
    if (!ok(lessons, 'lesson list')) return;
    const list = lessons.json('items');
    const candidates = owns ? list : list.filter((l) => l.isFreePreview);
    if (candidates.length === 0) return;
    const lesson = pick(candidates);

    ok(session.get(`/api/courses/${courseId}/lessons/${lesson.id}`, 'GET /api/courses/{id}/lessons/{id}'), 'lesson');
    ok(session.get(`/api/courses/${courseId}/lessons/${lesson.id}/content`, 'GET /api/courses/{id}/lessons/{id}/content'), 'lesson content');
    if (owns && Math.random() < 0.3) {
      ok(session.post(`/api/courses/${courseId}/lessons/${lesson.id}/complete`, null, 'POST /api/courses/{id}/lessons/{id}/complete'), 'lesson completed');
    }
  });
}

// Enrolling in a free course: the real purchase endpoint with a real Idempotency-Key.
// Free courses become Paid at once without Stripe, which is off locally. One enrollment in
// ten sends the same key again, as a double-click or a retried request would, and must get
// the same order back.
export function enroll(session, data, state) {
  group('enroll', () => {
    const c = pick(data.courses.filter((x) => x.free));
    const key = uuid();
    const res = session.post('/api/orders/', { idempotencyKey: key, payload: { courseId: c.id } }, 'POST /api/orders');
    if (!check(res, { 'enrolled': (r) => r.status === 201 })) return;
    if (Math.random() < 0.1) {
      const replay = session.post('/api/orders/', { idempotencyKey: key, payload: { courseId: c.id } }, 'POST /api/orders (replay)');
      check(replay, { 'replay returns the same order': (r) => r.status === 201 && r.json('id') === res.json('id') });
    }
    state.owned = null;
  });
}

// A returning learner signing in again from the sign-in page.
export function signIn(session) {
  group('sign in', () => {
    session.login();
  });
}
