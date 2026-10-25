import exec from 'k6/execution';
import { Session } from './client.js';
import { landing, catalog, search, courseDetail, lessonView, enroll, signIn } from './pages.js';

// One iteration is one page view. The weights are a judgement about how a course
// marketplace is used, stated here so they can be argued with: mostly browsing, a steady
// share of studying, and few writes.
//
// For experiments, override any weight: k6 run -e MIX=signin:0 ... (or MIX=signin:1,landing:0,...)
const PAGES = {
  landing: [25, () => landing()],
  catalog: [20, (s, d) => catalog(s, d)],
  search: [15, (s, d) => search(s, d)],
  detail: [20, (s, d) => courseDetail(s, d)],
  lesson: [12, (s, d, st) => lessonView(s, d, st)],
  enroll: [5, (s, d, st) => enroll(s, d, st)],
  signin: [3, (s) => signIn(s)],
};
for (const pair of (__ENV.MIX || '').split(',').filter(Boolean)) {
  const [page, weight] = pair.split(':');
  if (!PAGES[page]) throw new Error(`unknown page "${page}" in MIX; use ${Object.keys(PAGES).join(', ')}`);
  PAGES[page][0] = Number(weight);
}
const MIX = Object.values(PAGES).filter(([w]) => w > 0);
const TOTAL = MIX.reduce((sum, [w]) => sum + w, 0);

// Per-VU state. Each VU is one learner for the whole test, restored from the session
// setup() created, so a VU never signs in twice unless the mix says so.
let session = null;
const state = { owned: null };

export function pageView(data) {
  if (!session) session = Session.restore(data.sessions[(exec.vu.idInTest - 1) % data.sessions.length]);
  let roll = Math.random() * TOTAL;
  for (const [weight, run] of MIX) {
    roll -= weight;
    if (roll < 0) return run(session, data, state);
  }
}
