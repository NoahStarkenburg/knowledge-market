// Sends a quick burst to one path and counts the answers: the way to prove a rate limit is
// on or off rather than assume it.
//
//   k6 run -e BASE_URL=https://<front-door-host> -e TARGET=/ -e COUNT=1100 loadtest/burst.js
//   k6 run -e BASE_URL=https://<front-door-host> -e TARGET=/api/catalog/stats -e COUNT=250 loadtest/burst.js
//
// "/" is served by nginx, so a 429 there can only come from Front Door's WAF. An /api path
// passes both the WAF and the API's own limiter. Only the API adds Strict-Transport-Security
// (its security headers are set before its rate limiter runs), so a 429 carrying that header
// came from the API and one without it from Front Door.
import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { BASE_URL } from './lib/config.js';
import { frontDoorHeaders } from './lib/client.js';

const TARGET = __ENV.TARGET || '/';
const COUNT = Number(__ENV.COUNT || 300);
const answers = new Counter('answers');

export const options = {
  scenarios: { burst: { executor: 'shared-iterations', vus: Number(__ENV.VUS || 20), iterations: COUNT, maxDuration: '5m' } },
  summaryTrendStats: ['med', 'p(95)', 'max'],
  // Listing these makes the summary print a count for each.
  thresholds: {
    'answers{result:ok}': ['count>=0'],
    'answers{result:429 from the API}': ['count>=0'],
    'answers{result:429 from Front Door}': ['count>=0'],
    'answers{result:other}': ['count>=0'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}${TARGET}`, { headers: frontDoorHeaders('10.77.0.1') });
  let result = 'other';
  if (res.status === 200) result = 'ok';
  else if (res.status === 429) {
    result = res.headers['Strict-Transport-Security'] ? '429 from the API' : '429 from Front Door';
  }
  answers.add(1, { result });
}
