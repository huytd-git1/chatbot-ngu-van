# Cô Dương dạy văn dễ thương - Chatbot RAG Ngữ Văn

> **Hệ thống Chatbot RAG hỗ trợ học tập Ngữ văn THCS & THPT** sử dụng mô hình Google Gemini chính thức qua cơ chế **Gemini File Search**, bảo đảm 100% câu trả lời có trích dẫn nguồn thực tế từ tài liệu giáo viên cung cấp, từ chối trả lời bịa đặt khi thiếu căn cứ và bảo vệ quyền riêng tư của học sinh.

---

## Bảng mục lục hướng dẫn
1. [Cài đặt và chạy Local (Nhanh nhất)](#1-cài-đặt-và-chạy-local)
2. [Cấu hình Google Gemini & File Search](#2-cấu-hình-google-gemini--file-search)
3. [Kết nối cơ sở dữ liệu PostgreSQL](#3-kết-nối-cơ-sở-dữ-liệu-postgresql)
4. [Tạo tài khoản Quản trị viên, Giáo viên và Giáo viên Test](#4-tạo-tài-khoản-quản-trị-viên-giáo-viên-và-giáo-viên-test)
5. [Nhập danh sách học sinh (Giao diện & File mẫu CSV)](#5-nhập-danh-sách-học-sinh)
6. [Tải và quản lý tài liệu RAG](#6-tải-và-quản-lý-tài-liệu-rag)
7. [Quy trình kiểm tra RAG với tài liệu kiểm soát](#7-quy-trình-kiểm-tra-rag-với-tài-liệu-kiểm-soát)
8. [Đưa mã nguồn lên GitHub](#8-đưa-mã-nguồn-lên-github)
9. [Triển khai trực tuyến lên Render (Hosting miễn phí)](#9-triển-khai-trực-tuyến-lên-render)
10. [Giới hạn gói miễn phí & Chi phí tiềm năng](#10-giới-hạn-gói-miễn-phí--chi-phí-tiềm-năng)
11. [Sao lưu và khôi phục dữ liệu (Backup / Restore)](#11-sao-lưu-và-khôi-phục-dữ-liệu)
12. [Xử lý sự cố thường gặp & Đổi khóa bí mật (Secrets Rotation)](#12-xử-lý-sự-cố--đổi-khóa-bí-mật)

---

## 1. Cài đặt và chạy Local

Hệ thống được thiết kế theo mô hình **Monorepo** với chế độ tự động chạy giả lập bộ nhớ (`DATABASE_URL=memory`) và Mock RAG khi chưa có khóa Gemini API, giúp bạn chạy thử nghiệm toàn bộ hệ thống ngay trên máy tính mà không cần cài đặt thêm phần mềm cơ sở dữ liệu phức tạp.

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

## 2. Cấu hình Google Gemini & File Search

Để chuyển từ chế độ giả lập cục bộ sang gọi trực tiếp **Google Gemini API** và sử dụng tính năng **Gemini File Search**:

1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey) và đăng nhập bằng tài khoản Google.
2. Nhấn nút **Create API Key** để tạo một khóa API mới.
3. Mở file `.env` trong thư mục dự án và dán khóa API vào:
   ```env
   GEMINI_API_KEY=AIzaSyD...dien_khoa_cua_ban_o_day...
   GEMINI_MODEL=gemini-3.8-flash
   ```
4. **Cơ chế hoạt động:**
   - Khi có `GEMINI_API_KEY`, ứng dụng tự động kết nối qua thư viện SDK chính thức `@google/genai`.
   - Mỗi tác phẩm khi được tạo sẽ có một **File Search Store** độc lập trên Google Cloud.
   - Tài liệu giáo viên tải lên (`.pdf`, `.txt`, `.docx`, `.md`) sẽ được tải lên Google File API và gắn vào Store tương ứng.
   - Khi học sinh đặt câu hỏi, backend chỉ chỉ định Store thuộc tác phẩm mà lớp của học sinh được phân quyền (`file_search_store_names`).
   - Kết quả phản hồi của Gemini chứa trích dẫn grounding (`file_citation`), backend kiểm tra và bóc tách đoạn trích dẫn thực tế để hiển thị minh bạch cho học sinh.

---

## 3. Kết nối cơ sở dữ liệu PostgreSQL

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

## 4. Tạo tài khoản Quản trị viên, Giáo viên và Giáo viên Test

Để bảo mật tuyệt đối, hệ thống **không cho phép tự do đăng ký** tài khoản Quản trị viên hay Giáo viên từ giao diện web bên ngoài.

### Tài khoản mẫu có sẵn sau khi chạy `npm run seed`:
- **Quản trị viên (Admin):**
  - Tài khoản: `admin`
  - Mật khẩu: `Admin@2026!`
- **Giáo viên chuẩn (Teacher):**
  - Tài khoản: `gv_duong`
  - Mật khẩu: `GiaoVien@2026!`
- **Giáo viên Test (Miễn giới hạn lượt hỏi ngày):**
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

## 5. Nhập danh sách học sinh

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

## 6. Tải và quản lý tài liệu RAG

1. Đăng nhập với tài khoản Giáo viên và chọn tab **Tác phẩm & Tài liệu**.
2. Chọn tác phẩm (ví dụ: *Lặng lẽ Sa Pa* - Nguyễn Thành Long).
3. Giáo viên chọn loại tài liệu:
   - **Văn bản tác phẩm** (Đoạn trích nguyên văn).
   - **Phân tích** (Bài phân tích nghệ thuật, nhân vật).
   - **Giáo án** (Kế hoạch bài dạy trọng tâm).
   - **Câu hỏi & Hướng dẫn trả lời** (Hệ thống câu hỏi đọc hiểu).
4. Tải file lên (`.txt`, `.pdf`, `.docx`, `.md`). Hệ thống kiểm tra dung lượng tối đa 20MB.
5. Tiến trình lập chỉ mục được lưu trong bảng `indexing_jobs`. Khi trạng thái chuyển sang **Sẵn sàng (ready)**, tài liệu sẽ chính thức có hiệu lực trong các câu hỏi của học sinh.

---

## 7. Quy trình kiểm tra RAG với tài liệu kiểm soát

Để chứng minh ứng dụng thực sự thực hiện RAG 2 bước và không bịa đặt nguồn, hãy thực hiện kiểm thử thực tế với **Tài liệu kiểm soát bí mật** được nạp sẵn trong hệ thống:

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

## 8. Đưa mã nguồn lên GitHub

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

## 9. Triển khai trực tuyến lên Render

Dự án đã có sẵn tệp cấu hình **`render.yaml`** (Infrastructure as Code) giúp triển khai chỉ với vài cú nhấp chuột:

1. Đăng ký/Đăng nhập tại [Render.com](https://render.com).
2. Kết nối tài khoản GitHub của bạn với Render.
3. Chọn **Blueprints** -> **New Blueprint Instance**.
4. Chọn kho mã nguồn `chatbot-ngu-van`. Render sẽ tự động đọc tệp `render.yaml` và tạo:
   - 01 Web Service chạy Node.js (tự động build frontend và backend).
   - 01 Database PostgreSQL miễn phí được liên kết sẵn.
5. Tại trang cấu hình Environment Variables trên Render, nhập giá trị bí mật:
   - `GEMINI_API_KEY`: Dán khóa Gemini API thật lấy từ Google AI Studio.
6. Nhấn **Apply**. Sau khoảng 3-5 phút, ứng dụng của bạn sẽ hoạt động trực tiếp tại địa chỉ URL do Render cấp phát (ví dụ: `https://co-duong-day-van.onrender.com`).

---

## 10. Giới hạn gói miễn phí & Chi phí tiềm năng

### 1. Dịch vụ lưu trữ Render Free Tier:
- **Ngủ đông (Spin down):** Sau 15 phút không có người dùng truy cập, Web Service gói miễn phí của Render sẽ tạm dừng. Lần truy cập tiếp theo sẽ mất khoảng 30-50 giây để khởi động lại máy chủ (Cold Start).
- **Cơ sở dữ liệu Render Postgres Free:** Hết hạn sau 30 ngày dùng thử trên gói Free của Render. Khi chuyển sang sử dụng chính thức lâu dài, nên chuyển sang gói **PostgreSQL Starter** ($7/tháng) hoặc sử dụng cơ sở dữ liệu miễn phí vĩnh viễn không bị xóa của **Neon.tech** hay **Supabase**.

### 2. Chi phí Google Gemini API:
- **Gói Miễn phí (Free Tier):**
  - Giới hạn: 15 yêu cầu/phút (RPM), tối đa 1 triệu token/phút (TPM) và 1,500 yêu cầu/ngày (RPD).
  - Hoàn toàn đủ cho 1 đến 2 lớp học (khoảng 60-100 học sinh) sử dụng hàng ngày mà không mất phí.
- **Gói Trả theo dung lượng (Pay-as-you-go):**
  - Chi phí mô hình `gemini-3.8-flash`: Khoảng $0.075 / 1 triệu token đầu vào và $0.30 / 1 triệu token đầu ra.
  - Trung bình mỗi câu hỏi học sinh tốn chưa tới **50 - 100 đồng VNĐ**.
  - Ứng dụng đã tích hợp sẵn **Trần an toàn toàn hệ thống (`system_hard_cap`)** và **Công tắc ngắt khẩn cấp (Kill-switch)** tại trang Quản trị viên để ngăn chặn tình trạng vượt ngân sách ngoài ý muốn.

---

## 11. Sao lưu và khôi phục dữ liệu

Khi sử dụng PostgreSQL thật, hãy thực hiện sao lưu định kỳ qua terminal:

### Sao lưu (Backup):
```bash
# Thay thế chuỗi kết nối thực tế của bạn
pg_dump "postgresql://user:pass@host:5432/dbname" -Fc -f coduong_backup_$(date +%Y%m%d).dump
```

### Khôi phục (Restore):
```bash
pg_restore -d "postgresql://user:pass@host:5432/dbname" --clean --no-owner coduong_backup_20261015.dump
```

---

## 12. Xử lý sự cố & Đổi khóa bí mật

### 1. Tài khoản bị khóa do nhập sai mật khẩu 5 lần:
- Hệ thống tự động khóa an toàn trong 15 phút.
- Quản trị viên hoặc Giáo viên phụ trách có thể mở khóa ngay lập tức trên giao diện quản lý bằng nút **Mở khóa tài khoản**.

### 2. Mất thiết bị xác thực 2 bước (TOTP 2FA):
- Giáo viên có thể sử dụng 1 trong 8 **Mã khôi phục khẩn cấp** được cấp lúc kích hoạt để đăng nhập.
- Sau khi vào hệ thống, tắt 2FA và thiết lập lại trên điện thoại mới.

### 3. Đổi khóa bí mật (Secrets Rotation):
- **Khi lộ `SESSION_SECRET`:** Cập nhật biến `SESSION_SECRET` mới trong `.env` hoặc trên Render Dashboard. Toàn bộ phiên cũ sẽ lập tức bị hủy bỏ, buộc tất cả người dùng đăng nhập lại an toàn.
- **Khi cần thay `GEMINI_API_KEY`:** Cập nhật khóa mới trong `.env`. Máy chủ tự động nhận khóa mới mà không làm mất dữ liệu học sinh trong cơ sở dữ liệu PostgreSQL.

---

## 13. Cơ chế Grounding & Trích dẫn Tài liệu RAG

Hệ thống triển khai cơ chế Grounding trực tiếp từ tài liệu giáo viên đã phê duyệt thông qua Gemini File Search Tool / Vector Store với System Instruction chuẩn mực Sư phạm Ngữ văn:
- **Nguyên tắc Sư phạm:** AI không bịa đặt nguồn, không trích dẫn sai văn bản gốc, bắt buộc từ chối khi không có tài liệu được cấp phép.
- **Trích dẫn dẫn chứng trực quan:** Dẫn chứng văn học được đặt trong khối trích dẫn `> "..."` kèm xuất xứ tài liệu, hiển thị danh mục căn cứ rõ ràng trên giao diện học sinh.
- **Tối ưu hiệu năng:** Trả lời trực tiếp từ kết quả RAG, không thực hiện các vòng lặp kiểm chứng trùng lặp gây nghẽn 503 và đảm bảo thời gian phản hồi nhanh nhất.

### Chạy kiểm thử tự động:
```bash
# Chạy toàn bộ 20 unit & RAG grounding test cases
npm test
```


---

*Hệ thống được phát triển với tinh thần giáo dục tận tâm, nghiêm túc và bảo mật cao.*

