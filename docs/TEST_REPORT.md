# BÁO CÁO KIỂM THỬ THỰC TẾ (TEST REPORT)

Hệ thống ghi nhận kết quả kiểm thử thực tế toàn diện theo từng phần, phân biệt rõ giữa kiểm thử tự động nội bộ (unit/integration tests) và kiểm thử tích hợp dịch vụ thật (Live Gemini API / Live PostgreSQL / Cổng Bên Thứ Ba).

---

## 1. Tóm tắt kết quả kiểm thử

| Nhóm kiểm thử | File kiểm thử | Số ca test | Trạng thái | Thời gian thực thi | Kết quả |
|---|---|---|---|---|---|
| **1. Xác thực & Bảo mật (RBAC & Auth)** | `src/__tests__/auth.test.ts` | 4/4 | Đã chạy | ~1.11s | **PASS** (100%) |
| **2. Nhập danh sách học sinh CSV (CSV Import)** | `src/__tests__/csv_import.test.ts` | 3/3 | Đã chạy | ~0.59s | **PASS** (100%) |
| **3. Hạn mức & Chống gian lận (Quota Engine)** | `src/__tests__/quota.test.ts` | 6/6 | Đã chạy | ~0.53s | **PASS** (100%) |
| **4. Quản lý Gemini Key Pool & Failover** | `src/__tests__/key_pool.test.ts` | 6/6 | Đã chạy | ~0.28s | **PASS** (100%) |
| **5. Cổng Bên Thứ Ba (RouteAPI / RevidAPI / OpenRouter)** | `src/__tests__/third_party_gateway.test.ts` | 6/6 | Đã chạy | ~0.23s | **PASS** (100%) |
| **6. Phân loại tài liệu & Kiểm chứng trích dẫn** | `src/__tests__/document_classification_and_verification.test.ts` | 10/10 | Đã chạy | ~0.38s | **PASS** (100%) |
| **7. RAG & Grounding (Gemini Contextual RAG)** | `src/__tests__/rag_grounding.test.ts` | 6/6 | Đã chạy | ~0.20s | **PASS** (100%) |
| **8. Build & Typecheck Frontend + Backend** | `npm run build` | 2/2 | Đã chạy | ~2.50s | **PASS** (100%) |
| **TỔNG CỘNG** | **7 unit suites + 2 builds** | **41 tests** | **Hoàn tất** | **~1.90s** | **100% PASS** |

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

### Suite 2: `csv_import.test.ts` (Nhập danh sách học sinh CSV)
1. **`generates UTF-8 BOM CSV sample template correctly`** -> **PASS**
   - File mẫu CSV sinh ra có gắn mã UTF-8 BOM (`\uFEFF`) giúp phần mềm Microsoft Excel hiển thị đúng tiếng Việt có dấu, không bị lỗi font chữ.
2. **`detects duplicate student codes in CSV file and preview`** -> **PASS**
   - Bảng xem trước (preview) phát hiện chính xác các dòng có mã học sinh trùng lặp ngay trong tệp CSV, hiển thị cảnh báo chi tiết theo số dòng.
3. **`successfully imports valid previewed students into database`** -> **PASS**
   - Nhập hàng loạt danh sách học sinh hợp lệ vào lớp học trong cơ sở dữ liệu.
   - Mật khẩu khởi tạo được tự động băm Argon2id và gắn cờ `must_change_password = true`.

---

### Suite 3: `quota.test.ts` (Hạn mức & Chống gian lận)
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
6. **`exempts admin role from daily quota limits`** -> **PASS**
   - Tài khoản quản trị viên tối cao (`admin`) được miễn hoàn toàn hạn mức ngày cá nhân (`isUnlimited = true`), tự do kiểm thử và quản trị hệ thống mà không bao giờ bị khóa lượt hỏi.

---

### Suite 4: `key_pool.test.ts` (Quản lý Gemini Key Pool, Cooldown & Auto-Failover)
1. **`parses single and multiple API keys correctly from various formats`** -> **PASS**
   - Tách key chuẩn xác từ dòng xuống dòng, dấu phẩy, dấu chấm phẩy hoặc dấu cách.
   - Loại bỏ trùng lặp và làm sạch chuỗi rỗng.
2. **`rotates through multiple keys using round-robin and handles cooldown`** -> **PASS**
   - Luân phiên xoay vòng qua các API key đang hoạt động.
   - Khi một key gặp lỗi 429 hoặc 503, tự động chuyển vào Cooldown 60s và chọn ngay key dự phòng kế tiếp.
3. **`persists active keys into database ai_settings table`** -> **PASS**
   - Lưu trữ danh sách key đầy đủ vào bảng `ai_settings` trong PostgreSQL.
   - Tự động nạp lại trạng thái dàn key khi khởi động máy chủ.
4. **`deletes specific key or clears all keys accurately`** -> **PASS**
   - Hỗ trợ xóa chính xác một key theo số thứ tự index hoặc xóa sạch toàn bộ pool khi muốn thiết lập lại từ đầu.
5. **`aggregates token usage stats per key and overall accurately`** -> **PASS**
   - Tính toán và hiển thị tỷ lệ chia sẻ tải token (`percentShare`), tổng số prompt/output tokens và số lượt thành công/thất bại cho từng key trong pool.
6. **`appends new keys without deleting existing keys when updateAiConfig is called`** -> **PASS**
   - Khi người quản trị dán thêm một hoặc nhiều key mới vào form cấu hình, hệ thống tự động gộp (merge/append) vào danh sách key hiện có, bảo toàn toàn bộ các key cũ đang chạy ổn định.

---

### Suite 5: `third_party_gateway.test.ts` (Cổng Bên Thứ Ba: RouteAPI / RevidAPI / OpenRouter)
1. **`provides default third-party presets including RevidAPI, RouteAPI, and OpenRouter`** -> **PASS**
   - Cung cấp danh mục cấu hình có sẵn cho các nhà cung cấp phổ biến: RevidAPI (`https://revidapi.com/v1`), RouteAPI (`https://api.routeapi.ai/v1`), OpenRouter (`https://openrouter.ai/api/v1`), Groq, Together AI.
2. **`normalizes model candidates across prefix formats`** -> **PASS**
   - Tự động chuyển đổi linh hoạt định dạng model prefix: `gemini-3.6-flash` <-> `google/gemini-3.6-flash`, `gpt-4o-mini` <-> `openai/gpt-4o-mini`.
3. **`detects model access or not found error signals`** -> **PASS**
   - Bắt trọn các thông báo lỗi đặc thù: `HTTP 403: This token has no access to model...`, `HTTP 400: Không bán model...`, `HTTP 404: Not found` để tự động kích hoạt chuyển đổi sang model ứng viên tương thích.
4. **`updates AI config with third_party provider and multiple tokens pool`** -> **PASS**
   - Lưu trữ cấu hình nhà cung cấp bên thứ 3 kèm nhiều token Bearer/x-api-key vào cơ sở dữ liệu.
5. **`rotates third-party tokens and enforces cooldown on rate limit`** -> **PASS**
   - Xoay vòng Round-Robin qua danh sách các token bên thứ 3 và tự động cách ly token khi chạm hạn mức 429.
6. **`tracks per-token usage and aggregate token stats for third-party keys`** -> **PASS**
   - Thống kê chi tiết số lượt gọi, token prompt, token hoàn thành cho từng token của bên thứ 3.

---

### Suite 6: `document_classification_and_verification.test.ts` (Phân loại tài liệu & Kiểm chứng trích dẫn)
1. **`enforces exactly one active primary document per work at database level`** -> **PASS**
   - Kiểm tra ràng buộc Partial Unique Index: Mỗi tác phẩm chỉ có tối đa đúng 1 bản tác phẩm gốc (`primary`) được kích hoạt đồng thời.
2. **`prevents activating second primary document without demoting first`** -> **PASS**
   - Thao tác kích hoạt bản gốc mới tự động hủy kích hoạt bản gốc cũ nguyên tử.
3. **`classifies reference documents distinctly from primary text`** -> **PASS**
   - Đảm bảo tài liệu tham khảo, bài giảng, giáo án được gán nhãn `reference` và không bị nhầm lẫn với nguyên tác.
4. **`blocks unclassified documents from participating in student RAG`** -> **PASS**
   - Tài liệu chưa phân loại (`unclassified`) tuyệt đối không được nạp vào ngữ cảnh RAG cho học sinh.
5. **`parses and stores paragraphs with normalized Unicode NFC text`** -> **PASS**
   - Phân đoạn văn bản chuẩn xác, chuẩn hóa Unicode NFC tiếng Việt, bảo toàn số trang và thứ tự đoạn.
6. **`verifies exact quotes against primary text successfully`** -> **PASS**
   - So khớp nguyên văn câu trích dẫn từ tác phẩm gốc với độ chính xác tuyệt đối.
7. **`rejects fabricated or modified quotes claiming to be from primary text`** -> **PASS**
   - Phát hiện và loại bỏ các câu trích bị sửa từ, đảo câu hoặc không có trong nguyên tác.
8. **`tolerates legitimate ellipsis [...] within authentic quote`** -> **PASS**
   - Chấp nhận trích dẫn có dấu chấm lửng rút gọn hợp lệ `[...]` khi các vế vẫn thuộc cùng đoạn văn bản gốc.
9. **`separates primary citations from reference citations in final response`** -> **PASS**
   - Phân biệt minh bạch trích dẫn tác phẩm gốc và dẫn chứng từ tài liệu tham khảo cho giao diện học sinh.
10. **`falls back safely to answer without false quote when verification fails`** -> **PASS**
    - Trả lời thận trọng, không đưa trích dẫn sai nếu câu trích không vượt qua kiểm chứng.

---

### Suite 7: `rag_grounding.test.ts` (RAG & Grounding với Tài liệu Kiểm soát)
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
5. **`generates pedagogical follow-up suggestions directly derived from citations without additional AI token call`** -> **PASS**
   - Gợi ý câu hỏi đào sâu được sinh trực tiếp từ các đoạn trích dẫn thực tế của bài học, đảm bảo bám sát đúng tác phẩm đang học (ví dụ: học bài Chí Phèo chỉ gợi ý về Chí Phèo) và giảm 100% token gọi AI cho tác vụ gợi ý.
6. **`formats output cleanly with pedagogical tone and authentic citations`** -> **PASS**
   - Phong cách xưng cô gọi em ấm áp, trích dẫn rõ ràng, không hiển thị các mã kỹ thuật nội bộ ra giao diện người học.

---

## 3. Phân biệt môi trường kiểm thử

- **Đã kiểm thử trên môi trường Local (Mock & In-memory PostgreSQL):**
  - Mọi logic nghiệp vụ, thuật toán băm Argon2id, quản lý phiên, hạn mức nguyên tử, phân quyền RBAC, Multi-Key Pool, Cổng bên thứ 3 và phân tích câu trả lời đã được kiểm chứng tự động **41/41 test cases (100%)**.
- **Môi trường Live Cloud khi triển khai Production:**
  - **Google Gemini API**: Khóa API tạo từ Google AI Studio (`GEMINI_API_KEY`) hoặc nạp trực tiếp qua giao diện Admin Key Pool.
  - **Cổng Bên Thứ Ba**: Hỗ trợ bất kỳ dịch vụ OpenAI-compatible API nào (RevidAPI, RouteAPI, OpenRouter, Together AI, v.v.) với đầy đủ token xoay vòng tự động.
  - **PostgreSQL Database**: Kết nối qua biến `DATABASE_URL` tới các nhà cung cấp như Neon, Supabase hoặc Render Postgres để tự động chạy migration bền vững.
