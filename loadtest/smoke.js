// Smoke test: does every page and every check work at all, before any load?
//
//   k6 run loadtest/smoke.js
//
// Two learners, each visiting every page a few times. If this fails, a bigger test would
// only measure a broken script or a broken app.
import { baseOptions, sloThresholds } from './lib/config.js';
import { loadCatalog, signInLearners } from './lib/setup.js';
import { Session } from './lib/client.js';
import { landing, catalog, search, courseDetail, lessonView, enroll, signIn } from './lib/pages.js';
import exec from 'k6/execution';

export const options = Object.assign({}, baseOptions, {
  scenarios: {
    smoke: { executor: 'per-vu-iterations', vus: 2, iterations: 5, maxDuration: '2m' },
  },
  thresholds: sloThresholds(),
});

export function setup() {
  const sessions = signInLearners(2);
  return Object.assign({ sessions }, loadCatalog(Session.restore(sessions[0])));
}

export default function (data) {
  const session = Session.restore(data.sessions[exec.vu.idInTest - 1]);
  const state = { owned: null };
  landing();
  catalog(session, data);
  search(session, data);
  courseDetail(session, data);
  enroll(session, data, state);
  lessonView(session, data, state);
  signIn(session);
}
