# Frontend: Cô Dương dạy văn dễ thương
**Dự án**: Chatbot RAG Ngữ văn THCS & THPT  
**Công nghệ**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, DOMPurify  
**Tác giả**: made by huytd

---

## 1. Giới thiệu tổng quan
Giao diện ứng dụng web dành cho học sinh, giáo viên và quản trị viên trong hệ thống Trợ lý AI Ngữ Văn "Cô Dương dạy văn dễ thương". Giao diện được thiết kế theo phong cách trang nhã, ấm áp (tông màu kem ngà `#fbf9f4` kết hợp xanh đậm `#0f2942` và điểm nhấn hổ phách), tối ưu hóa trải nghiệm sư phạm và chuẩn hóa hiển thị trên mọi thiết bị máy tính, máy tính bảng và điện thoại di động.

---

## 2. Các phân hệ giao diện chính

### 1. Phân hệ Học sinh (`StudentChat.tsx`)
- **Khung chat tương tác**: Giao diện hội thoại ấm áp ("xưng cô - gọi em"), hỗ trợ 6 chế độ học tập (Hỏi đáp, Phân tích 4 bước, Gợi ý dàn ý, Luyện đọc hiểu, Góp ý bài viết, Chuẩn bị bài).
- **Trích dẫn minh bạch 2 nhóm**:
  - Dẫn chứng từ tác phẩm gốc (`✓ Đã đối chiếu nguyên tác`, số trang sách, nút xem ngữ cảnh đoạn).
  - Nguồn hỗ trợ phân tích (tài liệu tham khảo, bối cảnh, giáo án).
- **Huy hiệu mô hình AI thực tế**: Hiển thị chính xác mô hình đang cấu hình trong Quản trị (`✦ gemini-2.5-flash`, `✦ deepseek-v4-flash`, `✦ gemini-3.6-flash`,...).
- **Gợi ý câu hỏi đào sâu thông minh**: Nút bấm nhanh sinh trực tiếp từ các đoạn trích dẫn của bài học, bám sát tác phẩm và tiết kiệm tối đa token.
- **Thanh đo hạn mức (Daily Quota Bar)**: Hiển thị trực quan số lượt hỏi bài còn lại trong ngày (mặc định 20 câu/ngày).

### 2. Phân hệ Quản trị viên (`AdminDashboard.tsx`)
- **Cấu hình AI Đa Cổng**:
  - **Nhánh 1 - Google Gemini Official**: Quản lý dàn Key Pool, kiểm thử kết nối đa luồng, tỷ lệ chia sẻ tải token (`percentShare`), cách ly Cooldown 60s khi quá tải.
  - **Nhánh 2 - Cổng Bên Thứ Ba (Third-Party Gateway)**: Hỗ trợ cấu hình Base URL (RevidAPI, RouteAPI, OpenRouter...), nạp dàn Bearer Token / x-api-key xoay vòng, lựa chọn Target Model ID.
  - **Bảo toàn dàn Key**: Khi thêm API Key mới, hệ thống tự động gộp (merge) vào dàn key hiện có mà không làm mất các key cũ.
- **Quản lý Giáo viên & Phân công Lớp**: Tạo tài khoản, xóa tài khoản, modal phân công các lớp dạy cho giáo viên.
- **Quản lý Lớp & Học sinh Toàn trường**: Tạo lớp, xóa lớp, xem danh sách học sinh, đặt lại mật khẩu, xóa học sinh.
- **Quản lý Hạn mức & Kill-Switch**: Cấu hình trần hệ thống, giới hạn ngày, công tắc dừng khẩn cấp khi bảo trì.

### 3. Phân hệ Giáo viên (`TeacherDashboard.tsx`)
- **Quản lý Lớp học phụ trách**: Xem danh sách học sinh, cấp thêm lượt hỏi bài (`extra_granted`), khóa/mở khóa tài khoản học sinh, reset mật khẩu.
- **Nhập học sinh hàng loạt**: Tải file mẫu CSV chuẩn UTF-8 BOM, xem trước (preview) phát hiện trùng lặp mã học sinh, nhập danh sách vào lớp học.
- **Quản lý Tác phẩm & Tài liệu RAG**:
  - Đăng tải văn bản tác phẩm và tài liệu tham khảo (chuẩn hóa bắt buộc `.txt` hoặc `.md`).
  - Nút **"Tải lại tài liệu"** (Reload / Re-index) làm mới vector chỉ mục tức thì.
  - Kích hoạt bản gốc (`primary`) duy nhất, xem các đoạn phân trang OCR, xem Báo cáo đối chiếu mâu thuẫn tài liệu (Diff Report).
- **Bảo mật 2FA**: Cấu hình xác thực hai yếu tố TOTP qua ứng dụng Authenticator (Google Authenticator, Microsoft Authenticator) và mã khôi phục dự phòng.

---

## 3. Chạy môi trường Phát triển & Đóng gói

```bash
# Cài đặt thư viện
npm install

# Khởi chạy Vite dev server (Hot Module Replacement)
npm run dev

# Kiểm tra cú pháp và build bundle sản phẩm
npm run build
```

Bundle hoàn thành có dung lượng gzip ~139 kB, tối ưu tốc độ nạp trang dưới 0.5s.

---

## 4. Chân trang nhận diện
```html
Cô Dương dạy văn dễ thương © 2026 • made by huytd
```
