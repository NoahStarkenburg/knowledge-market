// Settings and service level objectives shared by every test.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// k6 stands in for Azure Front Door locally (see docker-compose.loadtest.yml). This must
// match the web container's FRONT_DOOR_ID. Against the real site (https) the real Front
// Door sets these headers itself, so k6 sends none.
export const FRONT_DOOR_ID = __ENV.FRONT_DOOR_ID || 'local-loadtest-front-door';
export const EMULATE_FRONT_DOOR = !BASE_URL.startsWith('https://');

// The bulk seed's 100 learners (buyer001..buyer100) plus the load-test learners that
// create-learners.js registers. Both are local, development-only accounts.
export const SEEDED_LEARNERS = 100;
export const SEEDED_PASSWORD = __ENV.SEEDED_PASSWORD || 'BulkSeed@2026!';
export const LOADTEST_LEARNERS = Number(__ENV.LOADTEST_LEARNERS || 1000);
export const LOADTEST_PASSWORD = __ENV.LOADTEST_PASSWORD || 'LoadTest@Local2026!';

// The objectives, and why these numbers:
//
// Availability 99.5%: one API replica, a serverless database that pauses when idle, and no
// second region. 99.9% would promise more than this architecture can keep.
//
// Reads: 95% under 300 ms and 99% under 1 s. A page makes up to 5 API calls, several in
// parallel; at 300 ms each the page's data arrives within about a second, the point where
// people stop feeling that the page is responding to them.
//
// Writes (enrolling, completing a lesson) get 500 ms / 1.5 s: they touch more tables and
// run inside a transaction, and people expect a button press to take a moment.
//
// Sign-in gets 1 s at p95 on purpose: PBKDF2 with 100,000 iterations is slow by design, so
// that stolen password hashes are slow to crack.
export const SLO = {
  availability: 0.995,
  read: { p95: 300, p99: 1000 },
  write: { p95: 500, p99: 1500 },
  login: { p95: 1000 },
};

export function sloThresholds() {
  return {
    http_req_failed: [`rate<${(1 - SLO.availability).toFixed(3)}`],
    'http_req_duration{kind:read}': [`p(95)<${SLO.read.p95}`, `p(99)<${SLO.read.p99}`],
    'http_req_duration{kind:write}': [`p(95)<${SLO.write.p95}`, `p(99)<${SLO.write.p99}`],
    'http_req_duration{kind:login}': [`p(95)<${SLO.login.p95}`],
    checks: ['rate>0.99'],
  };
}

// Shared k6 options. `url` is dropped from the metric tags because every course and lesson
// id would become its own series in Mimir; requests are grouped by the `name` tag instead.
export const baseOptions = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  systemTags: ['status', 'method', 'name', 'group', 'check', 'error', 'error_code', 'scenario', 'expected_response'],
  setupTimeout: '10m',
};
