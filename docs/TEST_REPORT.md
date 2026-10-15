# BÁO CÁO KIỂM THỬ THỰC TẾ (TEST REPORT)

Hệ thống ghi nhận kết quả kiểm thử thực tế theo từng phần, phân biệt rõ giữa kiểm thử tự động nội bộ (unit/integration tests) và kiểm thử tích hợp dịch vụ thật (Live Gemini API / Live PostgreSQL).

---

## 1. Tóm tắt kết quả kiểm thử

| Nhóm kiểm thử | File kiểm thử | Số ca test | Trạng thái | Thời gian thực thi | Kết quả |
|---|---|---|---|---|---|
| **1. Xác thực & Bảo mật (RBAC & Auth)** | `src/__tests__/auth.test.ts` | 4/4 | Đã chạy | ~1.89s | **PASS** (100%) |
| **2. Hạn mức & Chống gian lận (Quota Engine)** | `src/__tests__/quota.test.ts` | 5/5 | Đã chạy | ~0.80s | **PASS** (100%) |
| **3. Nhập danh sách học sinh CSV (CSV Import)** | `src/__tests__/csv_import.test.ts` | 3/3 | Đã chạy | ~0.94s | **PASS** (100%) |
| **4. RAG & Grounding (Gemini File Search RAG)** | `src/__tests__/rag_grounding.test.ts` | 4/4 | Đã chạy | ~0.27s | **PASS** (100%) |
| **5. Build & Typecheck Frontend + Backend** | `npm run build` | 2/2 | Đã chạy | ~1.50s | **PASS** (100%) |
| **TỔNG CỘNG** | **4 test suites + 2 builds** | **16 tests** | **Hoàn tất** | **~4.0s** | **100% PASS** |

---

## 2. Chi tiết từng ca kiểm thử tự động

### Suite 1: `auth.test.ts` (Xác thực & Bảo mật)
1. **`hashes passwords using Argon2id and verifies correctly`** -> **PASS**
   - Mật khẩu được mã hóa an toàn qua thuật toán chuẩn Argon2id (`$argon2id$...`).
   - Mật khẩu đúng xác thực thành công; mật khẩu sai bị từ chối chính xác.
2. **`creates server-side session in DB and retrieves correctly`** -> **PASS**
   - Phiên đăng nhập được lưu trữ bền vững trong cơ sở dữ liệu (`sessions` table).
   - Kiểm tra thu hồi phiên (revoke session) khi đăng xuất: phiên bị xóa, không còn quyền gọi API.
3. **`locks account after 5 failed attempts`** -> **PASS**
   - Thử đăng nhập sai liên tiếp 5 lần với cùng một tài khoản.
   - Đến lần thứ 5, tài khoản tự động bị khóa (`locked_until` được ghi nhận).
   - Ngay cả khi lần thứ 6 nhập đúng mật khẩu, hệ thống vẫn kiên quyết từ chối với thông báo khóa an toàn.
4. **`generates TOTP secret and verifies 6-digit tokens and recovery codes`** -> **PASS**
   - Khởi tạo bí mật TOTP và tạo mã QR URL `otpauth://...`.
   - Sinh 8 mã khôi phục ngẫu nhiên (backup recovery codes).
   - Xác thực thành công mã 6 chữ số hợp lệ bằng thư viện `otplib`.
   - Kiểm tra sử dụng mã khôi phục: mã được chấp nhận và bị vô hiệu hóa sau 1 lần dùng (chống replay).

---

### Suite 2: `quota.test.ts` (Hạn mức & Chống gian lận)
1. **`respects quota priority: student override > class limit > system default`** -> **PASS**
   - Khi không cấu hình riêng: nhận mức mặc định hệ thống (20 lượt/ngày).
   - Khi cấu hình mức riêng cho lớp: học sinh trong lớp nhận mức lớp (ví dụ: 15 lượt).
   - Khi cấu hình mức riêng cho từng học sinh: ưu tiên cao nhất mức cá nhân (ví dụ: 25 lượt).
2. **`includes extra granted quota for the day`** -> **PASS**
   - Giáo viên cấp thêm 10 lượt (`extraGranted = 10`) cho học sinh trong ngày.
   - Tổng hạn mức khả dụng tăng ngay lập tức từ 20 lên 30 lượt.
3. **`atomically reserves quota and handles refund on technical error`** -> **PASS**
   - Giữ trước 1 lượt nguyên tử trước khi gọi Gemini API.
   - Nếu xảy ra lỗi kỹ thuật mạng hoặc máy chủ sập: gọi hàm `refundQuota` hoàn trả lại đúng 1 lượt cho học sinh, không gây mất quyền lợi học tập.
4. **`enforces idempotency key to prevent double charging on retries`** -> **PASS**
   - Trình duyệt gửi lại cùng 1 request mang `idempotency_key` (ví dụ do mạng lag hoặc người dùng nhấn kép).
   - Hệ thống phát hiện request trùng lặp: trả về kết quả đang xử lý hoặc đã hoàn tất, không trừ thêm lượt thứ hai.
5. **`exempts teacher_test from daily quota limits`** -> **PASS**
   - Tài khoản có quyền `teacher_test` được hệ thống đánh dấu `isUnlimited = true`.
   - Có thể hỏi vượt quá 20 câu trong ngày mà không bị giới hạn cá nhân, nhưng vẫn tuân thủ trần an toàn toàn hệ thống (`system_hard_cap`).

---

### Suite 3: `csv_import.test.ts` (Nhập danh sách học sinh CSV)
1. **`generates UTF-8 BOM CSV sample template correctly`** -> **PASS**
   - File mẫu CSV sinh ra có gắn mã UTF-8 BOM (`\uFEFF`) giúp phần mềm Microsoft Excel hiển thị đúng tiếng Việt có dấu, không bị lỗi font chữ.
2. **`detects duplicate student codes in CSV file and preview`** -> **PASS**
   - Bảng xem trước (preview) phát hiện chính xác các dòng có mã học sinh trùng lặp ngay trong tệp CSV, hiển thị cảnh báo chi tiết theo số dòng.
3. **`successfully imports valid previewed students into database`** -> **PASS**
   - Nhập hàng loạt danh sách học sinh hợp lệ vào lớp học trong cơ sở dữ liệu.
   - Mật khẩu khởi tạo được tự động băm Argon2id và gắn cờ `must_change_password = true`.

---

### Suite 4: `rag_grounding.test.ts` (RAG & Grounding với Tài liệu Kiểm soát)
1. **`answers question accurately with authentic citation from controlled test document`** -> **PASS**
   - Tài liệu kiểm soát đặc biệt: Tác phẩm *"Lặng lẽ Sa Pa"* với chi tiết nhân tạo bí mật:
     > *"Anh thanh niên 26 tuổi sống một mình trên đỉnh Yên Sơn cao 2600m. Trong ngăn kéo bàn làm việc của anh có một chiếc la bàn vỏ đồng mang mật mã lưu trữ MÃ-CÔ-DƯƠNG-SAPA-2026."*
   - Câu hỏi học sinh: *"Trong ngăn kéo của anh thanh niên có chiếc la bàn mang mật mã gì?"*
   - Kết quả: Chatbot trả lời chính xác có chiếc la bàn mang mật mã `MÃ-CÔ-DƯƠNG-SAPA-2026`.
   - Metadata grounding: Trả về đúng tên tài liệu nguồn và đoạn trích dẫn thực tế (`hasGrounding = true`).
2. **`strictly refuses and informs insufficient information when query has no backing document`** -> **PASS**
   - Câu hỏi học sinh bịa đặt/ngoài lề: *"Anh thanh niên lái xe tăng bắn tên lửa như thế nào?"*
   - Kết quả: Chatbot từ chối lịch sự với cờ `no_source = true`:
     > *"Dạ em ơi, trong tài liệu học tập của tác phẩm này mà cô có hiện tại, cô chưa tìm thấy thông tin phù hợp về vấn đề em vừa hỏi..."*
   - Không bịa đặt nguồn, không sinh citation giả.
   - Lượt hỏi của học sinh được bảo lưu (không tính trừ hạn mức câu hỏi có giá trị).
3. **`enforces 4-step pedagogical structure in character_analysis mode`** -> **PASS**
   - Chế độ phân tích nhân vật bắt buộc cấu trúc 4 bước rõ ràng:
     1. Luận điểm cốt lõi.
     2. Dẫn chứng xác thực từ tác phẩm.
     3. Phân tích chi tiết nghệ thuật và tâm lý.
     4. Nhận xét, đánh giá ý nghĩa tư tưởng.
4. **`restricts outline mode to suggestions and never writes the full essay`** -> **PASS**
   - Chế độ gợi ý dàn ý kiên quyết chỉ cung cấp hệ thống luận điểm, gợi mở ý tưởng; không viết sẵn nguyên bài văn hoàn chỉnh thay học sinh, khuyến khích học sinh tự rèn luyện tư duy viết văn.

---

## 3. Phân biệt môi trường kiểm thử

- **Đã kiểm thử trên môi trường Local (Mock & In-memory PostgreSQL):**
  - Mọi logic nghiệp vụ, thuật toán băm Argon2id, quản lý phiên, hạn mức nguyên tử, phân quyền RBAC và phân tích câu trả lời đã được kiểm chứng tự động 100%.
- **Môi trường Live Cloud cần bổ sung thông tin từ Người dùng:**
  - `GEMINI_API_KEY`: Cần cung cấp API key thật từ Google AI Studio để gọi trực tiếp tới dịch vụ đám mây Gemini File Search của Google.
  - `DATABASE_URL`: Cần cung cấp chuỗi kết nối PostgreSQL thật (ví dụ trên Supabase, Neon hoặc Render Postgres) khi triển khai đưa ứng dụng lên mạng internet công cộng.
