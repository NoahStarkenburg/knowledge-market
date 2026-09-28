// Rate limits: here a 429 is the expected result, measured on purpose rather than hidden.
//
//   k6 run loadtest/rate-limits.js
//
// Through nginx, the same path production traffic takes, it checks that:
//   1. one address gets 200 requests a minute, then 429s
//   2. one address gets 10 sign-in attempts a minute, then 429s
//   3. two signed-in learners behind ONE address each get their own 200 a minute
//      (an office or a phone carrier's NAT), because signed-in limits are per user
//
// Each check runs from its own fresh address, so they can't use up each other's budget.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './lib/config.js';
import { anonGet, frontDoorHeaders, Session } from './lib/client.js';
import { learnerAccount, totalLearners } from './lib/setup.js';

export const options = {
  scenarios: {
    limits: { executor: 'shared-iterations', vus: 1, iterations: 1, maxDuration: '5m' },
  },
  thresholds: { checks: ['rate==1'] },
};

const fresh = () => `10.99.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;

function statusCounts(responses) {
  const counts = {};
  responses.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  return counts;
}

export default function () {
  // 1. Anonymous: 210 requests from one address inside a minute.
  const ip = fresh();
  const anon = [];
  for (let i = 0; i < 210; i++) anon.push(anonGet('/api/catalog/stats', ip, 'GET /api/catalog/stats (limit check)'));
  const a = statusCounts(anon);
  console.log(`one address, 210 requests: ${JSON.stringify(a)}`);
  check(a, {
    'first 200 requests from one address succeed': () => anon.slice(0, 200).every((r) => r.status === 200),
    'requests past 200 a minute get 429': () => anon.slice(200).every((r) => r.status === 429),
  });

  // 2. Sign-in attempts: 12 from one address, for an account that does not exist.
  const loginIp = fresh();
  const logins = [];
  for (let i = 0; i < 12; i++) {
    logins.push(http.post(`${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: `nobody-${i}@loadtest.local`, password: 'Wrong-password-1!' }),
      { headers: Object.assign(frontDoorHeaders(loginIp), { 'Content-Type': 'application/json' }), tags: { name: 'POST /api/auth/login (limit check)' } }));
  }
  const l = statusCounts(logins);
  console.log(`one address, 12 sign-in attempts: ${JSON.stringify(l)}`);
  check(l, {
    'first 10 sign-in attempts are answered (401)': () => logins.slice(0, 10).every((r) => r.status === 401),
    'sign-in attempts past 10 a minute get 429': () => logins.slice(10).every((r) => r.status === 429),
  });

  // 3. Two learners behind one shared address.
  const shared = fresh();
  // The last two learners: only a full-size run uses them, so their budgets start untouched.
  const [a1, a2] = [learnerAccount(totalLearners() - 1), learnerAccount(totalLearners() - 2)];
  const first = new Session(a1.email, a1.password, shared);
  const second = new Session(a2.email, a2.password, shared);
  check(null, { 'both learners signed in': () => first.login() && second.login() });
  const firstUser = [];
  for (let i = 0; i < 201; i++) firstUser.push(first.get('/api/users/me', 'GET /api/users/me (limit check)'));
  const f = statusCounts(firstUser);
  const other = second.get('/api/users/me', 'GET /api/users/me (limit check)');
  console.log(`learner 1, 201 requests: ${JSON.stringify(f)}; learner 2 on the same address: ${other.status}`);
  check(f, {
    'learner 1 gets 200 requests': () => firstUser.slice(0, 200).every((r) => r.status === 200),
    'learner 1 request 201 gets 429': () => firstUser[200].status === 429,
    'learner 2 on the same address is unaffected': () => other.status === 200,
  });
}
