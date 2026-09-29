import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, EMULATE_FRONT_DOOR, FRONT_DOOR_ID } from './config.js';

// Headers Azure Front Door adds to every request it relays. nginx believes X-Azure-ClientIP
// only when X-Azure-FDID carries our ID, exactly as in production.
export function frontDoorHeaders(clientIp) {
  return EMULATE_FRONT_DOOR ? { 'X-Azure-FDID': FRONT_DOOR_ID, 'X-Azure-ClientIP': clientIp } : {};
}

// A stable, private address per simulated person, so the API's per-address rate limits
// see many visitors rather than one load generator.
export function learnerIp(index) {
  return `10.50.${(index >> 8) & 255}.${index & 255}`;
}

export function randomVisitorIp() {
  return `10.200.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// An anonymous visitor: no cookies, just the Front Door headers.
export function anonGet(path, clientIp, name, kind = 'read') {
  return http.get(`${BASE_URL}${path}`, {
    headers: frontDoorHeaders(clientIp),
    tags: { name, kind },
  });
}

// A signed-in learner, behaving like the browser plus the Angular app:
//   - the auth cookies go back on every request. They are Secure cookies; a browser still
//     sends them to http://localhost, but k6 follows the rule strictly, so they are carried
//     here explicitly instead of through k6's cookie jar
//   - the CSRF cookie's value goes in X-CSRF on every write
//   - a 401 triggers one refresh of the 15-minute access token, then one retry
export class Session {
  constructor(email, password, clientIp) {
    this.email = email;
    this.password = password;
    this.clientIp = clientIp;
    this.cookies = {};
  }

  static restore(saved) {
    const s = new Session(saved.email, saved.password, saved.clientIp);
    s.cookies = Object.assign({}, saved.cookies);
    return s;
  }

  save() {
    return { email: this.email, password: this.password, clientIp: this.clientIp, cookies: this.cookies };
  }

  absorb(res) {
    for (const [cookieName, values] of Object.entries(res.cookies || {})) {
      if (values.length > 0) this.cookies[cookieName] = values[0].value;
    }
  }

  cookieHeader(path) {
    // The refresh token cookie is scoped to /api/auth, so the browser only sends it there.
    return Object.entries(this.cookies)
      .filter(([cookieName]) => cookieName !== 'km_rt' || path.startsWith('/api/auth'))
      .map(([cookieName, value]) => `${cookieName}=${value}`)
      .join('; ');
  }

  params(path, name, kind, extraHeaders) {
    const headers = Object.assign(frontDoorHeaders(this.clientIp), extraHeaders || {});
    const cookie = this.cookieHeader(path);
    if (cookie) headers.Cookie = cookie;
    return { headers, tags: { name, kind }, redirects: 0 };
  }

  login() {
    const path = '/api/auth/login';
    const res = http.post(
      `${BASE_URL}${path}`,
      JSON.stringify({ email: this.email, password: this.password }),
      this.params(path, 'POST /api/auth/login', 'login', { 'Content-Type': 'application/json' }),
    );
    const ok = check(res, { 'signed in': (r) => r.status === 200 });
    if (ok) {
      this.cookies = {};
      this.absorb(res);
    }
    return ok;
  }

  refresh() {
    const path = '/api/auth/refresh';
    const res = http.post(`${BASE_URL}${path}`, null, this.params(path, 'POST /api/auth/refresh', 'refresh'));
    if (res.status === 200) {
      this.absorb(res);
      return true;
    }
    return this.login();
  }

  send(method, path, body, name, kind) {
    const extra = {};
    if (method !== 'GET') {
      extra['X-CSRF'] = this.cookies.km_csrf || '';
      if (body !== null) extra['Content-Type'] = 'application/json';
    }
    if (body && body.idempotencyKey) {
      extra['Idempotency-Key'] = body.idempotencyKey;
      body = body.payload;
    }
    const payload = body === null || body === undefined ? null : JSON.stringify(body);
    const exec = () => http.request(method, `${BASE_URL}${path}`, payload, this.params(path, name, kind, extra));

    let res = exec();
    if (res.status === 401 && this.refresh()) {
      extra['X-CSRF'] = this.cookies.km_csrf || '';
      res = exec();
    }
    return res;
  }

  get(path, name, kind = 'read') {
    return this.send('GET', path, null, name, kind);
  }

  post(path, body, name, kind = 'write') {
    return this.send('POST', path, body, name, kind);
  }

  // The requests a page makes in parallel, like the Angular page's Promise.all.
  batch(requests) {
    const exec = () => http.batch(requests.map(([path, name]) => ['GET', `${BASE_URL}${path}`, null, this.params(path, name, 'read')]));
    let responses = exec();
    if (responses.some((r) => r.status === 401) && this.refresh()) responses = exec();
    return responses;
  }
}
