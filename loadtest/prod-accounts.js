// Creates or deletes the reader accounts prod.js signs in with.
//
//   k6 run -e BASE_URL=https://<front-door-host> -e ACTION=create loadtest/prod-accounts.js
//   k6 run -e BASE_URL=https://<front-door-host> -e ACTION=delete loadtest/prod-accounts.js
//
// example.com addresses (reserved for examples, so no one receives the sign-up email),
// named from PROD_READER_PREFIX, with PROD_READER_PASSWORD. Sign-up allows 5 accounts per
// address per hour, so keep READERS at 5 or fewer. Delete them when the test is over; the
// delete signs in, calls DELETE /api/users/me, then checks that signing in now fails.
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './lib/config.js';
import { Session, frontDoorHeaders } from './lib/client.js';

const PREFIX = __ENV.PROD_READER_PREFIX;
const PASSWORD = __ENV.PROD_READER_PASSWORD;
const READERS = Number(__ENV.READERS || 4);
const ACTION = __ENV.ACTION;
if (!PREFIX || !PASSWORD || !['create', 'delete'].includes(ACTION)) {
  throw new Error('set PROD_READER_PREFIX, PROD_READER_PASSWORD and ACTION=create|delete');
}

export const options = {
  scenarios: { accounts: { executor: 'shared-iterations', vus: 1, iterations: 1 } },
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  for (let n = 1; n <= READERS; n++) {
    const email = `${PREFIX}-${n}@example.com`;
    if (ACTION === 'create') {
      const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({ email, password: PASSWORD }),
        { headers: Object.assign(frontDoorHeaders(''), { 'Content-Type': 'application/json' }) });
      check(res, { [`reader ${n} created`]: (r) => r.status === 200 || r.status === 409 });
      continue;
    }
    const s = new Session(email, PASSWORD, '');
    if (!s.login()) continue;
    const del = s.send('DELETE', '/api/users/me', null, 'DELETE /api/users/me', 'write');
    check(del, { [`reader ${n} deleted`]: (r) => r.status === 204 || r.status === 200 });
    const again = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password: PASSWORD }),
      { headers: Object.assign(frontDoorHeaders(''), { 'Content-Type': 'application/json' }) });
    check(again, { [`reader ${n} can no longer sign in`]: (r) => r.status === 401 });
  }
}
