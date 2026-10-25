// One-off setup: registers the load-test learners through the public sign-up endpoint.
//
//   k6 run loadtest/create-learners.js
//
// The bulk seed only has 100 learners, and the API allows each signed-in user 200 requests
// a minute. A few hundred requests a second from 100 users would make every one of them
// look like an abusive client, so the rate limiter would rightly start refusing them. Real
// traffic at that rate comes from thousands of people making a few requests a minute each.
//
// Each learner registers from its own address, because sign-up is limited to 5 accounts
// per address per hour. Running it again is safe: an existing account answers 409.
import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';
import { BASE_URL, SEEDED_LEARNERS, LOADTEST_LEARNERS } from './lib/config.js';
import { frontDoorHeaders, learnerIp } from './lib/client.js';
import { learnerAccount } from './lib/setup.js';

export const options = {
  scenarios: {
    register: {
      executor: 'shared-iterations',
      vus: 5,
      iterations: LOADTEST_LEARNERS,
      maxDuration: '30m',
    },
  },
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  const index = SEEDED_LEARNERS + exec.scenario.iterationInTest;
  const acct = learnerAccount(index);
  const res = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({ email: acct.email, password: acct.password }),
    { headers: Object.assign(frontDoorHeaders(learnerIp(index)), { 'Content-Type': 'application/json' }), tags: { name: 'POST /api/auth/register' } },
  );
  check(res, { 'registered or already exists': (r) => r.status === 200 || r.status === 409 });
}
