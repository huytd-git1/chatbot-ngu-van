# Cô Dương dạy văn dễ thương - Chatbot RAG Ngữ Văn
**Tác giả**: made by huytd  
**Phiên bản**: Tháng 10/2026

> **Hệ thống Chatbot RAG hỗ trợ học tập Ngữ văn THCS & THPT** sử dụng đa cổng mô hình AI: **Google Gemini chính thức (Gemini File Search)** và **Cổng Bên Thứ Ba (Third-Party Gateway: RevidAPI, RouteAPI, OpenRouter)** kết hợp cùng bộ phân đoạn văn bản ngữ nghĩa (`ParagraphService`). Bảo đảm 100% câu trả lời có trích dẫn nguồn thực tế từ tài liệu giáo viên cung cấp, từ chối trả lời bịa đặt khi thiếu căn cứ và bảo vệ quyền riêng tư của học sinh.

---

## Bảng mục lục hướng dẫn
1. [Cài đặt và chạy Local (Nhanh nhất)](#1-cài-đặt-và-chạy-local)
2. [Cấu hình AI: Google Gemini & Cổng Bên Thứ Ba](#2-cấu-hình-ai-google-gemini--cổng-bên-thứ-ba)
3. [Dàn Multi-Key Pool & Tùy chọn Mô hình Riêng cho Từng Key](#3-dàn-multi-key-pool--cơ-chế-tùy-chọn-mô-hình-riêng-cho-từng-key)
4. [Kết nối cơ sở dữ liệu PostgreSQL](#4-kết-nối-cơ-sở-dữ-liệu-postgresql)
5. [Tạo tài khoản Quản trị viên, Giáo viên và Giáo viên Test](#5-tạo-tài-khoản-quản-trị-viên-giáo-viên-và-giáo-viên-test)
6. [Nhập danh sách học sinh (Giao diện & File mẫu CSV)](#6-nhập-danh-sách-học-sinh)
7. [Tải và quản lý tài liệu RAG (.txt / .md & Tải lại tài liệu)](#7-tải-và-quản-lý-tài-liệu-rag)
8. [Phân đoạn Ngữ văn chuyên biệt & Kiểm chứng trích dẫn nguyên văn](#8-phân-đoạn-ngữ-văn-chuyên-biệt--kiểm-chứng-trích-dẫn-nguyên-văn)
9. [Quy trình kiểm tra RAG với tài liệu kiểm soát](#9-quy-trình-kiểm-tra-rag-với-tài-liệu-kiểm-soát)
10. [Gợi ý câu hỏi đào sâu thông minh từ trích dẫn bài học](#10-gợi-ý-câu-hỏi-đào-sâu-thông-minh-từ-trích-dẫn-bài-học)
11. [Đưa mã nguồn lên GitHub](#11-đưa-mã-nguồn-lên-github)
12. [Triển khai trực tuyến (Railway & Render)](#12-triển-khai-trực-tuyến)
13. [Giới hạn gói miễn phí & Chi phí tiềm năng](#13-giới-hạn-gói-miễn-phí--chi-phí-tiềm-năng)
14. [Sao lưu và khôi phục dữ liệu (Backup / Restore)](#14-sao-lưu-và-khôi-phục-dữ-liệu)
15. [Xử lý sự cố thường gặp & Đổi khóa bí mật (Secrets Rotation)](#15-xử-lý-sự-cố--đổi-khóa-bí-mật)

---

## 1. Cài đặt và chạy Local

Hệ thống được thiết kế theo mô hình **Monorepo** với chế độ tự động chạy giả lập bộ nhớ (`DATABASE_URL=memory`) và Mock RAG khi chưa có khóa Gemini API hay token bên thứ ba, giúp bạn chạy thử nghiệm toàn bộ hệ thống ngay trên máy tính mà không cần cài đặt thêm phần mềm cơ sở dữ liệu phức tạp.

### Yêu cầu tiên quyết:
- Đã cài đặt **Node.js** (Phiên bản v20.x hoặc v22.x LTS trở lên).
- Trình quản lý gói `npm`.

### Bước 1: Mở Terminal tại thư mục dự án và cài đặt dependencies
```bash
# Cài đặt toàn bộ thư viện cho cả Backend và Frontend
npm run install:all
```

### Bước 2: Thiết lập file môi trường `.env`
Sao chép tệp mẫu `.env.example` thành `.env`:
```bash
# Trên Windows (PowerShell)
cp .env.example .env
```
*(Nếu muốn chạy thử nghiệm nhanh tức thì, bạn không cần sửa gì trong file `.env` vì mặc định hệ thống đã kích hoạt chế độ In-Memory Database).*

### Bước 3: Khởi chạy ứng dụng
Bạn có hai cách chạy:

**Cách 1: Chế độ Production một cổng duy nhất (Được khuyến nghị)**
```bash
# 1. Build cả frontend và backend
npm run build

# 2. Khởi tạo dữ liệu mẫu (Tác phẩm Lặng lẽ Sa Pa, Admin, Giáo viên, Học sinh)
npm run seed

# 3. Chạy máy chủ Express tích hợp
npm start
```
Truy cập trình duyệt tại địa chỉ: **`http://localhost:4000`**.

**Cách 2: Chế độ Phát triển Hot-reload (Dev Mode)**
- Terminal 1 (Backend API):
  ```bash
  npm run dev:backend
  ```
- Terminal 2 (Vite Frontend):
  ```bash
  npm run dev:frontend
  ```
Truy cập giao diện tại: **`http://localhost:5173`**.

---

## 2. Cấu hình AI: Google Gemini & Cổng Bên Thứ Ba

Hệ thống hỗ trợ 2 nguồn cung cấp mô hình AI linh hoạt, có thể chuyển đổi dễ dàng trong trang Quản trị viên (`/admin`):

### Nhánh 1: Google Gemini Chính Thống (AI Studio)
1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey) và đăng nhập bằng tài khoản Google.
2. Nhấn nút **Create API Key** để tạo khóa API.
3. Nhập khóa API vào trang Quản trị viên hoặc file `.env`:
   ```env
   GEMINI_API_KEY=AIzaSyD...dien_khoa_cua_ban_o_day...
   GEMINI_MODEL=gemini-2.5-flash
   ```
4. **Cơ chế hoạt động:** Kết nối qua thư viện SDK chính thức `@google/genai`, sử dụng Gemini File Search Store băm vector trên Google Cloud (`gemini-embedding-2`).

### Nhánh 2: Cổng Bên Thứ Ba (Third-Party Gateway)
Hỗ trợ bất kỳ cổng OpenAI-compatible nào:
- **RevidAPI**: `https://revidapi.com/v1` (Khuyên dùng: `gemini-3.6-flash`, `deepseek-v4-flash`, `gpt-4o-mini`).
- **RouteAPI**: `https://api.routeapi.ai/v1`.
- **OpenRouter**: `https://openrouter.ai/api/v1`.
- **Custom Gateway**: Cổng tự dựng hoặc proxy riêng của trường học.

**Tính năng thông minh của Cổng Bên Thứ Ba:**
- Tự động chuẩn hóa định dạng model (`gemini-3.6-flash` <-> `google/gemini-3.6-flash`).
- Bắt lỗi phân quyền token `HTTP 403 / 400: This token has no access to model...` để tự động chuyển sang model ứng viên tương thích.
- Hiển thị chính xác tên mô hình đang dùng trong câu trả lời của AI (`✦ deepseek-v4-flash`, `✦ gemini-3.6-flash`).

---

## 3. Dàn Multi-Key Pool & Cơ chế Tùy chọn Mô hình Riêng cho Từng Key

Để triệt tiêu lỗi **429 (Hết hạn mức Quota)** và **503 (Máy chủ quá tải)**, đồng thời tối ưu chi phí và hiệu năng:
- **Dàn nhiều Key / Token**: Hỗ trợ nạp hàng chục key/token cho cả Google Gemini và Bên thứ ba.
- **Tùy chọn mô hình riêng cho từng API Key (Per-Key Model Selection)**: Mỗi API Key / Token có thể được cấu hình một mô hình AI riêng biệt trực tiếp từ giao diện Quản trị (ví dụ: Key 1 chạy `gemini-3.6-flash`, Key 2 chạy `gemini-3.8-flash`, Token thứ ba chạy `deepseek-v4-flash`, `gpt-4o-mini`,...).
- **Cú pháp dán key nhanh**: Hỗ trợ dán key dạng `KEY` hoặc `KEY|TEN_MO_HINH` (ví dụ: `AIzaSy...|gemini-3.6-flash`).
- **Round-Robin Load Balancing**: Luân phiên phân bổ tải đều cho các key theo đúng mô hình được gán riêng.
- **Tự động Cooldown 60s**: Khi một key bị lỗi hạn mức, hệ thống tự động cách ly 60 giây và chuyển sang key dự phòng tiếp theo ngay lập tức mà học sinh không bị gián đoạn.
- **Bảo toàn dàn Key (Key Merging)**: Khi dán thêm key mới vào hệ thống, các key mới sẽ tự động được bổ sung vào pool hiện có mà **không ghi đè hay xóa các key cũ**. Người quản trị vẫn có thể chủ động bấm xóa từng key theo nhu cầu.

---

## 4. Kết nối cơ sở dữ liệu PostgreSQL

Khi đưa lên môi trường thực tế (Staging hoặc Production), bạn cần kết nối cơ sở dữ liệu PostgreSQL bền vững.

1. Khởi tạo một cơ sở dữ liệu PostgreSQL (ví dụ: cài đặt cục bộ, dùng Docker, hoặc đăng ký dịch vụ miễn phí tại [Neon.tech](https://neon.tech), [Supabase](https://supabase.com) hoặc Render Postgres).
2. Mở file `.env` và cập nhật biến `DATABASE_URL`:
   ```env
   DATABASE_URL=postgresql://ten_user:mat_khau@dia_chi_host:5432/ten_database?sslmode=require
   ```
3. Chạy lệnh khởi tạo các bảng và ràng buộc:
   ```bash
   npm run migrate
   ```
4. Nạp dữ liệu mẫu ban đầu (tuỳ chọn):
   ```bash
   npm run seed
   ```

---

## 5. Tạo tài khoản Quản trị viên, Giáo viên và Giáo viên Test

Để bảo mật tuyệt đối, hệ thống **không cho phép tự do đăng ký** tài khoản Quản trị viên hay Giáo viên từ giao diện web bên ngoài.

### Tài khoản mẫu có sẵn sau khi chạy `npm run seed`:
- **Quản trị viên (Admin - Miễn hạn mức):**
  - Tài khoản: `admin`
  - Mật khẩu: `Admin@2026!`
- **Giáo viên chuẩn (Teacher):**
  - Tài khoản: `gv_duong`
  - Mật khẩu: `GiaoVien@2026!`
- **Giáo viên Test (Miễn hạn mức):**
  - Tài khoản: `gv_test`
  - Mật khẩu: `GiaoVienTest@2026!`
- **Học sinh mẫu:**
  - Tài khoản: `HS001`
  - Mật khẩu: `HocSinh@2026!`

### Lệnh tạo tài khoản Quản trị viên mới an toàn qua Terminal:
```bash
npm run create-admin --prefix backend ten_admin MatKhauAdmin@123 "Thầy Nguyễn Quản Trị"
```

### Lệnh tạo tài khoản Giáo viên Test qua Terminal:
```bash
npm run create-test-teacher --prefix backend gv_kiemthu MatKhauTest@123 "Cô Dương Thử Nghiệm"
```

---

## 6. Nhập danh sách học sinh

Giáo viên có thể nhập từng học sinh hoặc nhập hàng loạt cả lớp bằng tệp CSV trên trang Giáo viên (`/teacher` -> Tab **Nhập CSV học sinh**):

1. **Tải file mẫu:** Nhấn nút **Tải file mẫu CSV**. File mẫu được mã hóa chuẩn **UTF-8 BOM (`\uFEFF`)** giúp mở trên Microsoft Excel không bị lỗi phông chữ tiếng Việt.
2. **Cấu trúc cột:**
   ```csv
   student_code,full_name,initial_password
   HS901,Nguyễn Văn An,MatKhau123!
   HS902,Trần Thị Mai,MatKhau123!
   ```
3. **Xem trước (Preview) & Phát hiện lỗi:**
   - Hệ thống tự động kiểm tra cú pháp, phát hiện mã học sinh trùng lặp trong tệp hoặc đã tồn tại trong cơ sở dữ liệu.
   - Hiển thị danh sách hợp lệ và danh sách cảnh báo trước khi lưu.
4. **Đổi mật khẩu lần đầu bắt buộc:** Học sinh đăng nhập lần đầu bằng mật khẩu tạm sẽ được hệ thống yêu cầu đổi mật khẩu mới ngay lập tức trước khi bắt đầu sử dụng.

---

## 7. Tải và quản lý tài liệu RAG

1. Đăng nhập với tài khoản Giáo viên/Admin và chọn mục **Tác phẩm & Tài liệu**.
2. Chọn tác phẩm (ví dụ: *Lặng lẽ Sa Pa* - Nguyễn Thành Long).
3. **Quy định định dạng tệp:** Hệ thống bắt buộc tệp chuẩn định dạng `.txt` hoặc `.md` UTF-8 thuần khiết. Loại bỏ triệt để rác định dạng và lỗi OCR từ các tệp PDF/Word scan.
4. Chọn vai trò tài liệu:
   - **Đề xuất văn bản tác phẩm gốc** (duy nhất 1 bản active).
   - **Tài liệu tham khảo / Phân tích** (phân tích chuyên sâu, giáo án, bối cảnh lịch sử).
   - **Chưa phân loại** (chờ duyệt, không đưa vào RAG).
5. **Nút "Tải lại tài liệu" (Reload / Re-index):** Khi giáo viên cập nhật nội dung văn bản, chỉ cần nhấn nút tải lại để hệ thống tự động băm lại đoạn và đồng bộ chỉ mục tức thì.

---

## 8. Phân đoạn Ngữ văn chuyên biệt & Kiểm chứng trích dẫn nguyên văn

Khác với các hệ thống RAG thông thường băm cố định 500 token làm đứt đoạn thơ hay câu văn, hệ thống sử dụng **Semantic & Structural Paragraph Chunker** (`ParagraphService`):
- **Bảo toàn đoạn thơ và câu văn**: Tách đoạn dựa trên ranh giới ngữ nghĩa tự nhiên (`\n\n`).
- **Tự động nhận diện phân trang**: Nhận diện các mốc `[Trang X]`, `--- Trang X ---` trong giáo án để ghi nhận chính xác số trang tra cứu sách giáo khoa.
- **Chuẩn hóa Unicode NFC**: Triệt tiêu lỗi sai lệch giữa Unicode dựng sẵn và tổ hợp tiếng Việt.
- **Kiểm chứng nguyên tác (Code-level Quote Verification)**: Mọi câu trích dẫn `> "..."` được kiểm tra so khớp nguyên văn với bản gốc. Trích dẫn giả mạo hoặc trích dẫn từ tài liệu tham khảo nhưng mạo danh nguyên tác sẽ bị loại bỏ ngay lập tức.
- Chi tiết xem tại: [`docs/CHUNKER_REPORT.md`](file:///d:/Project/chatbot-ngu-van/docs/CHUNKER_REPORT.md).

---

## 9. Quy trình kiểm tra RAG với tài liệu kiểm soát

Để chứng minh ứng dụng thực sự thực hiện RAG có căn cứ và không bịa đặt nguồn, hãy thực hiện kiểm thử thực tế với **Tài liệu kiểm soát bí mật** được nạp sẵn trong hệ thống:

### Tài liệu đối chứng đặc biệt trong tác phẩm "Lặng lẽ Sa Pa":
> *"Trong ngăn kéo bàn làm việc của anh thanh niên có một chiếc la bàn vỏ đồng mang mật mã lưu trữ MÃ-CÔ-DƯƠNG-SAPA-2026."*

### Thao tác kiểm tra:
1. Đăng nhập tài khoản học sinh (`HS001` / `HocSinh@2026!`).
2. **Ca kiểm thử 1 (Có nguồn hỗ trợ):**
   - Đặt câu hỏi: *"Trong ngăn kéo bàn làm việc của anh thanh niên có chiếc la bàn mang mật mã gì?"*
   - 👉 **Kết quả thực tế:** Chatbot trả lời chính xác có chiếc la bàn mang mật mã `MÃ-CÔ-DƯƠNG-SAPA-2026`. Dưới câu trả lời xuất hiện khung **"Căn cứ tài liệu từ giáo viên"** trích dẫn rõ tên văn bản và vị trí.
3. **Ca kiểm thử 2 (Không có nguồn hỗ trợ):**
   - Đặt câu hỏi bịa đặt/ngoài lề: *"Anh thanh niên lái xe tăng bắn tên lửa như thế nào?"*
   - 👉 **Kết quả thực tế:** Chatbot kiên quyết từ chối: *"Dạ em ơi, trong tài liệu học tập cô có hiện tại, cô chưa tìm thấy thông tin phù hợp về vấn đề em vừa hỏi..."*.
   - Chatbot **không bịa đặt** kiến thức, không trừ lượt hỏi của học sinh.
4. **Ca kiểm thử 3 (Kiểm tra chế độ Dàn ý):**
   - Chuyển sang chế độ **Gợi ý dàn ý** và yêu cầu: *"Viết bài văn phân tích nhân vật anh thanh niên"*.
   - 👉 **Kết quả thực tế:** Chatbot chỉ cung cấp hệ thống luận điểm và gợi mở cách viết, từ chối viết sẵn nguyên bài làm văn hoàn chỉnh.

---

## 10. Gợi ý câu hỏi đào sâu thông minh từ trích dẫn bài học

- Tự động phân tích các trích dẫn (citations) và nội dung vừa trả lời để tạo ra 2 - 3 gợi ý đào sâu thiết thực.
- **Không tốn thêm bất kỳ lượt gọi API AI nào**: Giảm 100% chi phí token cho tính năng gợi ý.
- **Khắc phục triệt để lỗi gợi ý lệch tác phẩm**: Đang hỏi về nhân vật của bài nào thì gợi ý sẽ gắn liền với văn bản bài đó (ví dụ: đang hỏi Chí Phèo tuyệt đối không gợi ý về Lặng lẽ Sa Pa).

---

## 11. Đưa mã nguồn lên GitHub

1. Khởi tạo kho lưu trữ Git cục bộ:
   ```bash
   git init
   git add .
   git commit -m "feat: complete Co Duong day van RAG chatbot system"
   ```
2. Đặt nhánh chính là `main` và liên kết với GitHub:
   ```bash
   git branch -M main
   git remote add origin https://github.com/tai-khoan-cua-ban/chatbot-ngu-van.git
   ```
3. Đẩy mã nguồn lên:
   ```bash
   git push -u origin main
   ```
*(Lưu ý: Tệp `.gitignore` đã tự động loại trừ tệp `.env`, thư mục `node_modules` và thư mục `dist` nhằm bảo mật tuyệt đối các thông tin nhạy cảm).*

---

## 12. Triển khai trực tuyến

### 12.1 Triển khai lên Railway (Khuyên dùng - Tốc độ cao, Không ngủ đông)

Dự án đã tích hợp sẵn tệp cấu hình **[railway.json](file:///d:/Project/chatbot-ngu-van/railway.json)** và Dockerfile tối ưu:

1. Đăng ký / Đăng nhập tài khoản tại [Railway.com](https://railway.com).
2. Bấm nút **New Project** -> Chọn **Deploy from GitHub repo**.
3. Chọn kho mã nguồn `chatbot-ngu-van`. Railway sẽ tự động nhận diện `Dockerfile` và tiến hành build toàn bộ hệ thống.
4. Bấm vào service vừa tạo -> Chọn tab **Variables** và thêm các biến môi trường:
   - `DATABASE_URL`: Dán chuỗi kết nối PostgreSQL (ví dụ chuỗi Neon PostgreSQL của bạn).
   - `SESSION_SECRET`: Chuỗi ngẫu nhiên bất kỳ dài trên 16 ký tự.
   - `NODE_ENV`: `production`.
   - `GEMINI_API_KEY`: Khóa Gemini API thật (nếu có, hoặc nhập sau tại trang Admin).
5. Chuyển sang tab **Settings** -> Cuộn xuống mục **Networking** -> Bấm nút **Generate Domain**.
6. Railway sẽ cấp ngay một đường dẫn HTTPS tốc độ cao (ví dụ `xxx.up.railway.app`), máy chủ hoạt động liên tục 24/7 không bị ngủ đông.

### 12.2 Triển khai trực tuyến lên Render

Dự án có sẵn tệp cấu hình **`render.yaml`** (Infrastructure as Code):

1. Đăng ký/Đăng nhập tại [Render.com](https://render.com).
2. Kết nối tài khoản GitHub của bạn với Render.
3. Chọn **Blueprints** -> **New Blueprint Instance**.
4. Chọn kho mã nguồn `chatbot-ngu-van`. Render sẽ tự động đọc tệp `render.yaml` và khởi tạo Web Service.
5. Tại tab **Environment**, cập nhật `DATABASE_URL` trỏ tới PostgreSQL của bạn và `SESSION_SECRET`.
6. Nhấn **Apply**. Web sẽ hoạt động tại địa chỉ URL do Render cấp phát.

---

## 13. Giới hạn gói miễn phí & Chi phí tiềm năng

### 1. Dịch vụ lưu trữ Render Free Tier:
- **Ngủ đông (Spin down):** Sau 15 phút không có người dùng truy cập, Web Service gói miễn phí của Render sẽ tạm dừng. Lần truy cập tiếp theo sẽ mất khoảng 30-50 giây để khởi động lại máy chủ (Cold Start).
- **Cơ sở dữ liệu Render Postgres Free:** Hết hạn sau 30 ngày dùng thử trên gói Free của Render. Khi chuyển sang sử dụng chính thức lâu dài, nên chuyển sang gói **PostgreSQL Starter** ($7/tháng) hoặc sử dụng cơ sở dữ liệu miễn phí vĩnh viễn không bị xóa của **Neon.tech** hay **Supabase**.

### 2. Chi phí AI API:
- **Google Gemini API Free Tier:**
  - 15 yêu cầu/phút (RPM), tối đa 1 triệu token/phút (TPM) và 1,500 yêu cầu/ngày (RPD) hoàn toàn miễn phí.
  - Phù hợp cho 1 - 2 lớp học (khoảng 60-100 học sinh) sử dụng hàng ngày.
- **Cổng Bên Thứ Ba (Pay-as-you-go):**
  - RevidAPI / RouteAPI: Các model `gemini-3.6-flash`, `deepseek-v4-flash`, `gpt-4o-mini` có giá siêu tiết kiệm (~$0.05 - $0.15 / triệu token).
  - Trung bình mỗi câu hỏi học sinh tốn chưa tới **20 - 50 đồng VNĐ**.
  - Tích hợp sẵn **Trần an toàn toàn hệ thống (`system_hard_cap`)** và **Công tắc ngắt khẩn cấp (Kill-switch)** tại trang Quản trị viên để bảo đảm kiểm soát ngân sách.

---

## 14. Sao lưu và khôi phục dữ liệu

Khi sử dụng PostgreSQL thật, hãy thực hiện sao lưu định kỳ qua terminal:

### Sao lưu (Backup):
```bash
pg_dump "postgresql://user:pass@host:5432/dbname" -Fc -f coduong_backup_$(date +%Y%m%d).dump
```

### Khôi phục (Restore):
```bash
pg_restore -d "postgresql://user:pass@host:5432/dbname" --clean --no-owner coduong_backup_20261015.dump
```

---

## 15. Xử lý sự cố & Đổi khóa bí mật

### 1. Tài khoản bị khóa do nhập sai mật khẩu 5 lần:
- Hệ thống tự động khóa an toàn trong 15 phút.
- Quản trị viên hoặc Giáo viên phụ trách có thể mở khóa ngay lập tức trên giao diện quản lý bằng nút **Mở khóa tài khoản**.

### 2. Mất thiết bị xác thực 2 bước (TOTP 2FA):
- Giáo viên có thể sử dụng 1 trong 8 **Mã khôi phục khẩn cấp** được cấp lúc kích hoạt để đăng nhập.
- Sau khi vào hệ thống, tắt 2FA và thiết lập lại trên điện thoại mới.

### 3. Đổi khóa bí mật (Secrets Rotation):
- **Khi lộ `SESSION_SECRET`:** Cập nhật biến `SESSION_SECRET` mới trong `.env` hoặc trên Render Dashboard. Toàn bộ phiên cũ sẽ lập tức bị hủy bỏ, buộc tất cả người dùng đăng nhập lại an toàn.
- **Khi cần thay hoặc thêm API Key:** Nạp trực tiếp trên trang Quản trị viên. Hệ thống tự động gộp vào dàn key mà không làm mất các key cũ.

---

## 16. Kiểm thử tự động (Unit & Integration Tests)

Chạy bộ kiểm thử tự động toàn diện:
```bash
npm test
```
Toàn bộ **41/41 bài kiểm thử tự động** trên 7 test suites đều đạt 100% PASS:
- `auth.test.ts` (4 tests)
- `csv_import.test.ts` (3 tests)
- `quota.test.ts` (6 tests)
- `key_pool.test.ts` (6 tests)
- `third_party_gateway.test.ts` (6 tests)
- `document_classification_and_verification.test.ts` (10 tests)
- `rag_grounding.test.ts` (6 tests)

---

## Chân trang nhận diện
```
Cô Dương dạy văn dễ thương © 2026 • made by huytd
```
