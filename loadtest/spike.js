// Spike test: normal traffic, then a sudden surge far past capacity (a course goes viral,
// a newsletter lands), then back to normal. The questions are what fails during the surge
// and how long the system takes to recover afterwards.
//
//   k6 run loadtest/spike.js
//   k6 run -e BASE=30 -e PEAK=200 loadtest/spike.js
//
// Requests are tagged with the phase they ran in: before, spike, after.
import exec from 'k6/execution';
import { baseOptions, SLO } from './lib/config.js';
import { loadCatalog, signInLearners } from './lib/setup.js';
import { Session } from './lib/client.js';
import { pageView } from './lib/mix.js';

const BASE = Number(__ENV.BASE || 30);
const PEAK = Number(__ENV.PEAK || 200);
const VUS = Number(__ENV.VUS || 1000);

const stages = [
  { duration: '2m', target: BASE, phase: 'before' },
  { duration: '10s', target: PEAK, phase: 'spike' },
  { duration: '1m', target: PEAK, phase: 'spike' },
  { duration: '10s', target: BASE, phase: 'after' },
  { duration: '4m', target: BASE, phase: 'after' },
];

const thresholds = {};
for (const phase of ['before', 'spike', 'after']) {
  thresholds[`http_req_duration{phase:${phase},kind:read}`] = [`p(95)<${SLO.read.p95}`, `p(99)<${SLO.read.p99}`];
  thresholds[`http_req_failed{phase:${phase}}`] = [`rate<${(1 - SLO.availability).toFixed(3)}`];
  thresholds[`http_reqs{phase:${phase}}`] = ['count>0'];
}

export const options = Object.assign({}, baseOptions, {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: BASE,
      timeUnit: '1s',
      preAllocatedVUs: VUS,
      maxVUs: VUS,
      stages: stages.map(({ duration, target }) => ({ duration, target })),
    },
  },
  thresholds,
});

export function setup() {
  const sessions = signInLearners(VUS);
  return Object.assign({ sessions }, loadCatalog(Session.restore(sessions[0])));
}

const seconds = (d) => Number(d.replace(/[sm]$/, '')) * (d.endsWith('m') ? 60 : 1);

export default function (data) {
  let elapsed = (Date.now() - exec.scenario.startTime) / 1000;
  let phase = 'after';
  for (const s of stages) {
    elapsed -= seconds(s.duration);
    if (elapsed < 0) { phase = s.phase; break; }
  }
  exec.vu.metrics.tags.phase = phase;
  pageView(data);
}
