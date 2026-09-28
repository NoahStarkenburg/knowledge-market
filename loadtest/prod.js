// Load tests against the live Azure site. Read-only: landing pages, the catalog, search,
// course pages and free preview lessons. No orders, payments, reviews or uploads.
//
//   k6 run -e BASE_URL=https://<front-door-host> -e TEST=baseline loadtest/prod.js
//   k6 run -e BASE_URL=https://<front-door-host> -e TEST=steady -e RATE=20 loadtest/prod.js
//   k6 run -e BASE_URL=https://<front-door-host> -e TEST=stress loadtest/prod.js
//
// Without BASE_URL it runs against the local stack, which is where to try changes first.
//
// Signed-in pages use a few dedicated reader accounts (prod-accounts.js creates and deletes
// them). Their emails and password come from PROD_READER_PREFIX and PROD_READER_PASSWORD
// and are never committed.
//
// baseline  about 2.3 requests a second, under every rate limit, with production exactly as
//           configured. The first request is timed on its own: the serverless database
//           pauses when idle, and waking it is the cold start real visitors hit.
// steady    a fixed rate for 10 minutes.
// stress    steps up until the objectives break. It stops itself early once the site is
//           clearly overloaded (p95 over 1.5 s or 2% errors in a step), so production is
//           never pushed further than needed to find the limit.
//
// steady and stress go past the API's own rate limiter (200 requests a minute per client)
// and Front Door's WAF limits, so they need both lifted for this machine for the length of
// the test. See loadtest/README.md; never leave either lifted.
import http from 'k6/http';
import exec from 'k6/execution';
import { baseOptions, BASE_URL, SLO, sloThresholds } from './lib/config.js';
import { Session, frontDoorHeaders } from './lib/client.js';
import { loadCatalog } from './lib/setup.js';
import { landing, catalog, search, courseDetail, lessonView } from './lib/pages.js';

const PREFIX = __ENV.PROD_READER_PREFIX;
const PASSWORD = __ENV.PROD_READER_PASSWORD;
const READERS = Number(__ENV.READERS || 4);
if (!PREFIX || !PASSWORD) throw new Error('set PROD_READER_PREFIX and PROD_READER_PASSWORD');
export const readerEmail = (n) => `${PREFIX}-${n}@example.com`;

const TEST = __ENV.TEST || 'baseline';
const seconds = (d) => Number(d.replace(/[sm]$/, '')) * (d.endsWith('m') ? 60 : 1);

const stressStages = [];
const stressSteps = [];
for (let i = 0; i < Number(__ENV.STEPS || 6); i++) {
  const target = Number(__ENV.START || 20) + i * Number(__ENV.STEP || 20);
  stressStages.push({ duration: __ENV.RAMP || '20s', target }, { duration: __ENV.HOLD || '2m', target });
  stressSteps.push(target);
}

const scenarios = {
  baseline: { executor: 'constant-arrival-rate', rate: 30, timeUnit: '1m', duration: __ENV.DURATION || '10m', preAllocatedVUs: 10, maxVUs: 20 },
  steady: { executor: 'constant-arrival-rate', rate: Number(__ENV.RATE || 20), timeUnit: '1s', duration: __ENV.DURATION || '10m', preAllocatedVUs: 300, maxVUs: 300 },
  stress: { executor: 'ramping-arrival-rate', startRate: 0, timeUnit: '1s', preAllocatedVUs: 600, maxVUs: 600, stages: stressStages },
};

const thresholds = sloThresholds();
if (TEST === 'stress') {
  for (const t of stressSteps) {
    thresholds[`http_req_duration{stage:${t},kind:read}`] = [
      `p(95)<${SLO.read.p95}`, `p(99)<${SLO.read.p99}`,
      { threshold: 'p(95)<1500', abortOnFail: true, delayAbortEval: '30s' },
    ];
    thresholds[`http_req_failed{stage:${t}}`] = [
      `rate<${(1 - SLO.availability).toFixed(3)}`,
      { threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '20s' },
    ];
    thresholds[`http_reqs{stage:${t}}`] = ['count>0'];
    thresholds[`iterations{stage:${t}}`] = ['count>0'];
  }
}

export const options = Object.assign({}, baseOptions, {
  scenarios: { [TEST]: scenarios[TEST] },
  thresholds,
});

// Read-only pages only; lessonView never writes for a learner who owns nothing.
const PAGES = [
  [30, () => landing()],
  [20, (s, d) => catalog(s, d)],
  [15, (s, d) => search(s, d)],
  [25, (s, d) => courseDetail(s, d)],
  [10, (s, d, st) => lessonView(s, d, st)],
];
const TOTAL = PAGES.reduce((sum, [w]) => sum + w, 0);

export function setup() {
  // The first request wakes the database if it has paused, so it is timed on its own and
  // kept out of the steady-state numbers.
  const started = Date.now();
  const first = http.get(`${BASE_URL}/api/catalog/featured?count=6`, { headers: frontDoorHeaders(''), tags: { name: 'first request', kind: 'cold' }, timeout: '150s' });
  const coldMs = Date.now() - started;
  console.log(`first request: ${first.status} in ${coldMs} ms`);
  if (first.status !== 200) exec.test.abort(`site not healthy: ${first.status}`);

  const sessions = [];
  for (let n = 1; n <= READERS; n++) {
    const s = new Session(readerEmail(n), PASSWORD, '');
    if (!s.login()) exec.test.abort(`reader ${n} could not sign in`);
    sessions.push(s.save());
  }
  return Object.assign({ sessions, coldMs }, loadCatalog(Session.restore(sessions[0])));
}

let session = null;
const state = { owned: null };

function currentStep() {
  let elapsed = (Date.now() - exec.scenario.startTime) / 1000;
  for (let i = 0; i < stressStages.length; i++) {
    elapsed -= seconds(stressStages[i].duration);
    if (elapsed < 0) return i % 2 === 1 ? String(stressStages[i].target) : 'ramp';
  }
  return 'ramp';
}

export default function (data) {
  if (TEST === 'stress') exec.vu.metrics.tags.stage = currentStep();
  if (!session) session = Session.restore(data.sessions[(exec.vu.idInTest - 1) % data.sessions.length]);
  let roll = Math.random() * TOTAL;
  for (const [weight, run] of PAGES) {
    roll -= weight;
    if (roll < 0) return run(session, data, state);
  }
}
