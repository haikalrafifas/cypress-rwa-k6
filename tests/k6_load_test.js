import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let errorRate = new Rate('errors');

export let options = {
  vus: 30,
  duration: '30s',
  thresholds: {
    errors: ['rate<0.05'],
    'http_req_duration': ['p(95)<1200'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3001/api';

function tryLogin() {
  const email = __ENV.TEST_USER_EMAIL || 'user@email.com';
  const password = __ENV.TEST_USER_PASSWORD || 'Password123!';
  if (!email || !password) {
    return null;
  }
  const payload = JSON.stringify({ email, password });
  const params = { headers: { 'Content-Type': 'application/json' } };
  const res = http.post(`${BASE}/login`, payload, params);
  if (res.status === 200) {
    try {
      const body = res.json();
      return body.token || body.accessToken || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export default function () {
  let token = tryLogin();

  group('List transactions', function () {
    const res = http.get(`${BASE}/transactions/public`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    const ok = check(res, {
      'transactions status 200': (r) => r.status === 200,
      'transactions non-empty': (r) => r.body && r.body.length > 10,
    });
    if (!ok) {
      errorRate.add(1);
    }
    sleep(0.5)
  });

  group('Get users / profile', function () {
    const res = http.get(`${BASE}/users`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    check(res, {
      'users status 200': (r) => r.status === 200,
    });
    sleep(0.3);
  });

  group('Get transaction details', function () {
    const res = http.get(`${BASE}/transactions/1`, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
    check(res, {
      'detail status': (r) => r.status === 200 || r.status === 404,
    });
    sleep(Math.random() * 1.5);
  });
}
