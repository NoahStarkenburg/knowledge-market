import http from 'k6/http';
import { fail } from 'k6';
import {
  BASE_URL, SEEDED_LEARNERS, SEEDED_PASSWORD, LOADTEST_LEARNERS, LOADTEST_PASSWORD,
} from './config.js';
import { Session, learnerIp } from './client.js';

export function learnerAccount(index) {
  if (index < SEEDED_LEARNERS) {
    return { email: `buyer${String(index + 1).padStart(3, '0')}@bulk.seed.km`, password: SEEDED_PASSWORD };
  }
  const n = index - SEEDED_LEARNERS + 1;
  return { email: `learner${String(n).padStart(4, '0')}@loadtest.local`, password: LOADTEST_PASSWORD };
}

export const totalLearners = () => SEEDED_LEARNERS + LOADTEST_LEARNERS;

// Signs in `count` learners before the test starts, a few at a time, each from its own
// address. Doing it here keeps hundreds of deliberately slow password checks out of the
// measured part of the test; the traffic mix still includes some sign-ins.
export function signInLearners(count) {
  if (count > totalLearners()) fail(`need ${count} learners, only ${totalLearners()} exist; run create-learners.js`);
  const sessions = [];
  const parallel = 10;
  for (let start = 0; start < count; start += parallel) {
    const group = [];
    for (let i = start; i < Math.min(start + parallel, count); i++) {
      const acct = learnerAccount(i);
      group.push(new Session(acct.email, acct.password, learnerIp(i)));
    }
    const responses = http.batch(group.map((s) => ['POST', `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: s.email, password: s.password }),
      s.params('/api/auth/login', 'POST /api/auth/login (setup)', 'setup', { 'Content-Type': 'application/json' })]));
    responses.forEach((res, i) => {
      if (res.status !== 200) fail(`sign-in failed for ${group[i].email}: ${res.status} ${res.body}`);
      group[i].absorb(res);
      sessions.push(group[i].save());
    });
  }
  return sessions;
}

// The published catalog, read once through the API by a signed-in learner.
export function loadCatalog(session) {
  const courses = [];
  for (let page = 1; page < 50; page++) {
    const res = session.get(`/api/courses/?status=Published&page=${page}&pageSize=100`, 'GET /api/courses (setup)', 'setup');
    if (res.status !== 200) fail(`could not list courses: ${res.status}`);
    const body = res.json();
    courses.push(...body.items);
    if (courses.length >= body.total || body.items.length === 0) break;
  }
  if (courses.length === 0) fail('no published courses; seed the database first');

  const words = new Set();
  courses.forEach((c) => c.title.split(/[^A-Za-z]+/).filter((w) => w.length > 4).forEach((w) => words.add(w.toLowerCase())));
  return {
    courses: courses.map((c) => ({ id: c.id, creatorId: c.createdById, free: c.priceAmount === 0, thumbnail: !!c.thumbnailFileId })),
    // Real searches mix hits and misses; a miss still scans the whole table.
    searchTerms: [...words].slice(0, 60).concat(['kubernetes', 'rust', 'pottery', 'zzz']),
  };
}
