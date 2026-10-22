import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ==============================================================================
// CÁC CHỈ SỐ ĐO LƯỜNG TÙY BIẾN (CUSTOM METRICS)
// ==============================================================================
const errorCount = new Counter('total_error_count');
const successfulFlowRate = new Rate('successful_flow_rate');
const apiResponseTime = new Trend('api_flow_duration_ms');

// ==============================================================================
// CẤU HÌNH TĂNG DẦN NGƯỜI DÙNG & TỰ DỪNG KHI LỖI TĂNG (STAGES & THRESHOLDS)
// ==============================================================================
export const options = {
  // 1. TĂNG DẦN NGƯỜI DÙNG MÔ PHỎNG (RAMPING VUs)
  stages: [
    { duration: '30s', target: 10 },  // Giai đoạn 1: Khởi động ấm từ 1 -> 10 học sinh
    { duration: '1m', target: 30 },   // Giai đoạn 2: Tăng lên 30 học sinh (tương đương 1 lớp học)
    { duration: '1m', target: 50 },   // Giai đoạn 3: Tăng lên 50 học sinh
    { duration: '2m', target: 100 },  // Giai đoạn 4: Đỉnh tải 100 học sinh truy cập cùng lúc
    { duration: '1m', target: 100 },  // Giai đoạn 5: Duy trì ổn định ở mức 100 học sinh
    { duration: '30s', target: 0 },   // Giai đoạn 6: Hạ dần người dùng về 0 (Cool-down)
  ],

  // 2. ĐẶT NGƯỠNG & TỰ ĐỘNG DỪNG KHẨN CẤP (ABORT ON FAIL)
  thresholds: {
    // ⚠️ TỰ DỪNG TEST NGAY LẬP TỨC nếu tỷ lệ request lỗi vượt quá 10% (đánh giá sau 15 giây chạy)
    http_req_failed: [
      {
        threshold: 'rate<0.10',
        abortOnFail: true,
        delayAbortEval: '15s',
      },
    ],

    // ⚠️ TỰ DỪNG TEST NGAY LẬP TỨC nếu 95% thời gian phản hồi vượt quá 4 giây (server bị nghẽn/treo)
    http_req_duration: [
      {
        threshold: 'p(95)<4000',
        abortOnFail: true,
        delayAbortEval: '20s',
      },
    ],

    // Đảm bảo tối thiểu 90% số lượng kiểm tra logic đạt chuẩn
    checks: ['rate>0.90'],
  },
};

// URL mục tiêu (Mặc định là bản chính thức VPS, có thể ghi đè bằng: -e BASE_URL=http://...)
const BASE_URL = __ENV.BASE_URL || 'https://coduongnguvan.duckdns.org';
const TEST_USERNAME = __ENV.USERNAME || 'HS2026001';
const TEST_PASSWORD = __ENV.PASSWORD || '123456';

export default function () {
  const startTime = Date.now();
  let flowSuccess = true;

  // Header mặc định
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    timeout: '10s',
  };

  // ----------------------------------------------------------------------------
  // BƯỚC 1: KIỂM TRA SỨC KHỎE HỆ THỐNG (/api/health)
  // ----------------------------------------------------------------------------
  group('01_Health_Check', function () {
    const res = http.get(`${BASE_URL}/api/health`, params);
    const ok = check(res, {
      'Health check status là 200': (r) => r.status === 200,
      'App name trả về chính xác': (r) => r.body && r.body.includes('Cô Dương dạy văn dễ thương'),
    });
    if (!ok) {
      errorCount.add(1);
      flowSuccess = false;
    }
  });

  sleep(1); // Thời gian chờ của người dùng

  // ----------------------------------------------------------------------------
  // BƯỚC 2: LẤY CSRF TOKEN & SESSION COOKIE (/api/csrf-token)
  // ----------------------------------------------------------------------------
  let csrfToken = '';
  group('02_Get_CSRF_Token', function () {
    const res = http.get(`${BASE_URL}/api/csrf-token`, params);
    const ok = check(res, {
      'Lấy CSRF token thành công': (r) => r.status === 200,
    });
    if (ok) {
      try {
        const body = JSON.parse(res.body);
        csrfToken = body.csrfToken || '';
      } catch (e) {
        flowSuccess = false;
      }
    } else {
      errorCount.add(1);
      flowSuccess = false;
    }
  });

  sleep(1);

  // ----------------------------------------------------------------------------
  // BƯỚC 3: ĐĂNG NHẬP HỌC SINH (/api/auth/login)
  // ----------------------------------------------------------------------------
  group('03_Student_Login', function () {
    const loginPayload = JSON.stringify({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    });

    const loginParams = {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken,
      },
    };

    const res = http.post(`${BASE_URL}/api/auth/login`, loginPayload, loginParams);
    const ok = check(res, {
      'Đăng nhập thành công (HTTP 200)': (r) => r.status === 200,
    });

    if (!ok) {
      errorCount.add(1);
      flowSuccess = false;
    }
  });

  sleep(1.5);

  // ----------------------------------------------------------------------------
  // BƯỚC 4: HỌC SINH TẢI DANH SÁCH TÁC PHẨM VĂN HỌC (/api/student/works)
  // ----------------------------------------------------------------------------
  let firstWorkId = null;
  group('04_Get_Student_Works', function () {
    const res = http.get(`${BASE_URL}/api/student/works`, params);
    const ok = check(res, {
      'Lấy danh sách tác phẩm thành công': (r) => r.status === 200,
    });

    if (ok) {
      try {
        const data = JSON.parse(res.body);
        if (Array.isArray(data) && data.length > 0) {
          firstWorkId = data[0].id;
        }
      } catch (e) {
        flowSuccess = false;
      }
    } else {
      errorCount.add(1);
      flowSuccess = false;
    }
  });

  sleep(1);

  // ----------------------------------------------------------------------------
  // BƯỚC 5: TẢI GỢI Ý CÂU HỎI BÀI HỌC (/api/student/works/:id/suggestions)
  // ----------------------------------------------------------------------------
  if (firstWorkId) {
    group('05_Get_Work_Suggestions', function () {
      const res = http.get(`${BASE_URL}/api/student/works/${firstWorkId}/suggestions`, params);
      const ok = check(res, {
        'Lấy gợi ý câu hỏi thành công': (r) => r.status === 200,
      });
      if (!ok) {
        errorCount.add(1);
        flowSuccess = false;
      }
    });
  }

  // ----------------------------------------------------------------------------
  // BƯỚC 6: KIỂM TRA HẠN MỨC HỎI ĐÁP QUOTA (/api/student/quota)
  // ----------------------------------------------------------------------------
  group('06_Get_Student_Quota', function () {
    const res = http.get(`${BASE_URL}/api/student/quota`, params);
    const ok = check(res, {
      'Kiểm tra quota thành công': (r) => r.status === 200,
    });
    if (!ok) {
      errorCount.add(1);
      flowSuccess = false;
    }
  });

  // Ghi nhận chỉ số
  successfulFlowRate.add(flowSuccess ? 1 : 0);
  apiResponseTime.add(Date.now() - startTime);

  // Thời gian suy ngẫm ngẫu nhiên trước lượt tiếp theo (từ 2s đến 4s)
  sleep(Math.random() * 2 + 2);
}
