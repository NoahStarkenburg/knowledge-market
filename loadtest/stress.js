// Stress test: raise the load in steps until the objectives break, to find the most page
// views per second the stack can serve within them.
//
//   k6 run loadtest/stress.js
//   k6 run -e START=20 -e STEP=10 -e STEPS=8 -e HOLD=2m loadtest/stress.js
//
// An open model: page views arrive at a set rate whether or not earlier ones have finished,
// the way real visitors do. A closed model (each user waits for the last response before
// sending the next) quietly sends less traffic as the system slows, hiding the overload.
//
// Every request is tagged with the step it ran in, so the summary shows p95, p99, error
// rate and throughput for each load level. Ramps between steps are tagged "ramp".
import exec from 'k6/execution';
import { baseOptions, SLO } from './lib/config.js';
import { loadCatalog, signInLearners } from './lib/setup.js';
import { Session } from './lib/client.js';
import { pageView } from './lib/mix.js';

const START = Number(__ENV.START || 20);
const STEP = Number(__ENV.STEP || 20);
const STEPS = Number(__ENV.STEPS || 8);
const HOLD = __ENV.HOLD || '2m';
const RAMP = __ENV.RAMP || '20s';
const VUS = Number(__ENV.VUS || 1000);

const seconds = (d) => Number(d.replace(/s$/, '').replace(/m$/, '')) * (d.endsWith('m') ? 60 : 1);
const stages = [];
const steps = [];
for (let i = 0; i < STEPS; i++) {
  const target = START + i * STEP;
  stages.push({ duration: RAMP, target }, { duration: HOLD, target });
  steps.push(target);
}

const thresholds = {};
for (const t of steps) {
  thresholds[`http_req_duration{stage:${t},kind:read}`] = [`p(95)<${SLO.read.p95}`, `p(99)<${SLO.read.p99}`];
  thresholds[`http_req_failed{stage:${t}}`] = [`rate<${(1 - SLO.availability).toFixed(3)}`];
  thresholds[`http_reqs{stage:${t}}`] = ['count>0'];
  thresholds[`iterations{stage:${t}}`] = ['count>0'];
}

export const options = Object.assign({}, baseOptions, {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      // Many VUs, each a different learner, so every learner's own rate stays at a few
      // requests a minute, like a real person's, even at the highest step.
      preAllocatedVUs: VUS,
      maxVUs: VUS,
      stages,
    },
  },
  thresholds,
});

export function setup() {
  const sessions = signInLearners(VUS);
  return Object.assign({ sessions }, loadCatalog(Session.restore(sessions[0])));
}

function currentStep() {
  let elapsed = (Date.now() - exec.scenario.startTime) / 1000;
  for (let i = 0; i < stages.length; i++) {
    elapsed -= seconds(stages[i].duration);
    if (elapsed < 0) return i % 2 === 1 ? String(stages[i].target) : 'ramp';
  }
  return 'ramp';
}

export default function (data) {
  exec.vu.metrics.tags.stage = currentStep();
  pageView(data);
}
