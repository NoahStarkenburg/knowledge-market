// A fixed rate of page views for a fixed time: the building block for experiments, the
// soak test and the failure drill.
//
//   k6 run -e RATE=50 -e DURATION=3m loadtest/steady.js
//   k6 run -e RATE=50 -e DURATION=3m -e MIX=signin:0 loadtest/steady.js
import { baseOptions, sloThresholds } from './lib/config.js';
import { loadCatalog, signInLearners } from './lib/setup.js';
import { Session } from './lib/client.js';
import { pageView } from './lib/mix.js';

const RATE = Number(__ENV.RATE || 30);
const VUS = Number(__ENV.VUS || 600);

export const options = Object.assign({}, baseOptions, {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: __ENV.DURATION || '5m',
      preAllocatedVUs: VUS,
      maxVUs: VUS,
    },
  },
  thresholds: sloThresholds(),
});

export function setup() {
  const sessions = signInLearners(VUS);
  return Object.assign({ sessions }, loadCatalog(Session.restore(sessions[0])));
}

export default function (data) {
  pageView(data);
}
