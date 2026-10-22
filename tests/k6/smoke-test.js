import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke test nhẹ để kiểm tra đường truyền và xác nhận k6 hoạt động trước khi stress test
export const options = {
  vus: 3, // 3 người dùng mô phỏng
  duration: '20s', // Chạy trong 20 giây

  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true }], // Dừng ngay nếu lỗi > 5%
    http_req_duration: ['p(95)<2000'], // 95% request dưới 2s
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://coduongnguvan.duckdns.org';

export default function () {
  // 1. Health check
  const resHealth = http.get(`${BASE_URL}/api/health`);
  check(resHealth, {
    'Status 200': (r) => r.status === 200,
    'App online': (r) => r.body.includes('Cô Dương'),
  });

  // 2. CSRF Token
  const resCsrf = http.get(`${BASE_URL}/api/csrf-token`);
  check(resCsrf, {
    'CSRF Token 200': (r) => r.status === 200,
  });

  sleep(1);
}
