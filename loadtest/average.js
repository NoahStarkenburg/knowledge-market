// Average load: a normal busy hour, and whether the objectives hold during it.
//
//   k6 run loadtest/average.js
//
// The planning assumption, stated so it can be challenged: 1,000 learners online at once,
// each reading for 20 to 40 seconds between pages. That is about 33 page views a second,
// or about 100 API requests a second.
//
// A closed model this time: each VU is one learner who waits for a page, reads, then
// clicks again. That is how real people behave at normal load. The stress test uses an
// open model instead, because under overload people keep arriving regardless.
import { sleep } from 'k6';
import { baseOptions, sloThresholds } from './lib/config.js';
import { loadCatalog, signInLearners } from './lib/setup.js';
import { Session } from './lib/client.js';
import { pageView } from './lib/mix.js';

const LEARNERS = Number(__ENV.LEARNERS || 1000);

export const options = Object.assign({}, baseOptions, {
  scenarios: {
    average: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP || '3m', target: LEARNERS },
        { duration: __ENV.HOLD || '10m', target: LEARNERS },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '40s',
    },
  },
  thresholds: sloThresholds(),
});

export function setup() {
  const sessions = signInLearners(LEARNERS);
  return Object.assign({ sessions }, loadCatalog(Session.restore(sessions[0])));
}

export default function (data) {
  pageView(data);
  sleep(20 + Math.random() * 20);
}
