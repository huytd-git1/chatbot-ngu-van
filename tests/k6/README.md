# 🚀 Cẩm nang Kiểm thử Hiệu năng & Tải trọng với k6 (k6 Load Testing)

Thư mục này chứa các kịch bản kiểm thử tải (load testing) và kiểm thử độ bền (stress testing) cho hệ thống **"Cô Dương dạy văn dễ thương"**, sử dụng công cụ mã nguồn mở tiêu chuẩn quốc tế **k6** (Grafana).

---

## 🎯 Tính năng nổi bật của Kịch bản
1. **Tăng dần người dùng mô phỏng (Ramping VUs):**
   - Bắt đầu nhẹ nhàng từ 10 học sinh (làm ấm hệ thống).
   - Tăng dần lên 30 học sinh (tương đương 1 lớp học trực tuyến).
   - Tăng lên 50 rồi đỉnh tải 100 học sinh đồng thời truy cập cùng lúc.
   - Giảm tải dần về 0 để hệ thống hạ nhiệt (Cool-down).

2. **Cơ chế Tự động Dừng Khẩn Cấp (Abort on Fail Thresholds):**
   - 🛑 **Tự động ngắt test ngay lập tức** nếu tỷ lệ request lỗi vượt quá **10%** (`rate < 0.10`).
   - 🛑 **Tự động ngắt test ngay lập tức** nếu 95% thời gian phản hồi vượt quá **4 giây** (`p(95) < 4000ms`), báo hiệu máy chủ bắt đầu bị nghẽn/treo.
   - Nhờ đó, bài test sẽ **bảo vệ VPS không bao giờ bị sập hoặc quá tải tài nguyên**.

3. **Mô phỏng hành trình học sinh thực tế (End-to-End User Flow):**
   - Kiểm tra Health check máy chủ.
   - Lấy CSRF token và bảo mật cookie session.
   - Đăng nhập tài khoản học sinh (`HS2026001` / `123456`).
   - Tải danh sách tác phẩm văn học (`/api/student/works`).
   - Tải gợi ý câu hỏi bài học (`/api/student/works/suggestions`).
   - Kiểm tra hạn mức hỏi đáp (`/api/student/quota`).
   - Thời gian suy ngẫm ngẫu nhiên giữa các thao tác (Think time 2-4s).

---

## 🛠️ Hướng dẫn Chạy Kiểm thử

### Cách 1: Chạy bằng Docker (Khuyên dùng - 0 cần cài đặt)
Anh có thể chạy k6 trực tiếp bằng Docker trên máy tính hoặc trên VPS mà không cần cài thêm bất cứ phần mềm nào:

#### 1. Chạy bài Stress Test (Tăng dần người dùng & Tự dừng khi lỗi):
```bash
docker run --rm -i -v "${PWD}/tests/k6:/scripts" grafana/k6 run /scripts/stress-test.js
```

#### 2. Chạy bài Smoke Test (Kiểm tra nhanh 20 giây):
```bash
docker run --rm -i -v "${PWD}/tests/k6:/scripts" grafana/k6 run /scripts/smoke-test.js
```

---

### Cách 2: Tùy biến URL mục tiêu và tài khoản
Mặc định bài test sẽ hướng tới trang chính thức `https://coduongnguvan.duckdns.org`. Anh có thể đổi sang môi trường **Dev** hoặc truyền tài khoản khác thông qua tham số `-e`:

- **Kiểm thử trên môi trường Dev (`http://103.74.100.234:10001`):**
  ```bash
  docker run --rm -i -v "${PWD}/tests/k6:/scripts" grafana/k6 run -e BASE_URL=http://103.74.100.234:10001 /scripts/stress-test.js
  ```

- **Truyền tài khoản học sinh khác:**
  ```bash
  docker run --rm -i -v "${PWD}/tests/k6:/scripts" grafana/k6 run -e USERNAME=HS2026002 -e PASSWORD=123456 /scripts/stress-test.js
  ```

---

### Cách 3: Chạy trực tiếp qua công cụ k6 (Nếu đã cài k6 trên máy/VPS)

- **Cài đặt k6 trên Windows (PowerShell):**
  ```powershell
  winget install k6 --source winget
  # hoặc: choco install k6
  ```

- **Cài đặt k6 trên Ubuntu VPS:**
  ```bash
  sudo gpg -k
  sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update && sudo apt-get install k6
  ```

- **Chạy lệnh:**
  ```bash
  k6 run tests/k6/stress-test.js
  ```

---

## 📊 Cách đọc kết quả báo cáo của k6
Khi bài test kết thúc (hoặc tự động dừng do chạm ngưỡng lỗi), k6 sẽ in ra bảng tổng kết:
- **`http_req_duration`**: Thời gian phản hồi của server (trung bình `avg`, nhỏ nhất `min`, 95% người dùng `p(95)`). Đạt chuẩn nếu `p(95) < 2s`.
- **`http_req_failed`**: Tỷ lệ phần trăm request bị lỗi. Đạt chuẩn nếu `< 1%`.
- **`checks`**: Tỷ lệ phần trăm các bước nghiệp vụ thành công. Đạt chuẩn nếu `> 95%`.
- **`successful_flow_rate`**: Tỷ lệ học sinh hoàn thành toàn bộ hành trình từ lúc đăng nhập đến khi tra cứu tác phẩm thành công.
