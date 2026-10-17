# KIẾN TRÚC HỆ THỐNG: CÔ DƯƠNG DẠY VĂN DỄ THƯƠNG

## 1. Tổng quan hệ thống
Hệ thống là ứng dụng Web RAG (Retrieval-Augmented Generation) hỗ trợ học tập môn Ngữ văn cấp THCS/THPT, kết hợp AI Gemini 3.8 Flash và kho truy xuất Gemini File Search để trả lời có căn cứ từ tài liệu giáo viên cung cấp.

```
                           +-------------------------------------+
                           |            Trình duyệt             |
                           |  (React + TypeScript + Tailwind)    |
                           +------------------+------------------+
                                              | HTTPS (Cookie, CSRF)
                                              v
+--------------------------------------------------------------------------------+
|                             Express Server (Node.js)                           |
|                                                                                |
|  [Security Middlewares] Helmet, Rate Limiter, CSRF Guard, Session Validator   |
|  [Static Files Handler] Phục vụ Frontend Vite build (cùng origin production)   |
|                                                                                |
|  +--------------------+  +----------------------+  +------------------------+  |
|  | Auth & RBAC        |  | Quota & Idempotency  |  | Doc Indexing Manager   |  |
|  | - Argon2id hashing |  | - Asia/Ho_Chi_Minh   |  | - Upload validation    |  |
|  | - Server sessions  |  | - Atomic reserve     |  | - Async Poller / State |  |
|  | - TOTP 2FA         |  | - Key anti-duplication| - Safe replace/delete  |  |
|  +--------------------+  +----------------------+  +------------------------+  |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | RAG Orchestrator (@google/genai SDK v2.3.0+)                             |  |
|  | - Xác thực quyền truy cập tác phẩm / tài liệu                            |  |
|  | - Tạo payload truy xuất file_search gắn đúng store IDs                    |  |
|  | - Gọi Gemini 3.8 Flash qua Interactions API                              |  |
|  | - Kiểm tra & bóc tách file_citation grounding metadata                   |  |
|  | - Từ chối trả lời nếu thiếu nguồn hoặc trích dẫn ngoài phạm vi            |  |
|  +--------------------------------------------------------------------------+  |
+---------------------+-----------------------------------+----------------------+
                      |                                   |
                      v                                   v
+-------------------------------+       +----------------------------------------+
|      PostgreSQL Database      |       |        Gemini File Search Store        |
| - users, roles, sessions      |       | - Store embeddings (gemini-embedding-2)|
| - classes, teacher_assignments|       | - Chunks & indices cho tài liệu giáo   |
| - works, documents, index_jobs|       |   viên biên soạn                      |
| - quota_settings, usage_logs  |       | - Semantic vector retrieval            |
| - chat_requests, audit_logs   |       | - File citations & grounding metadata  |
+-------------------------------+       +----------------------------------------+
```

## 2. Phân biệt ba tầng dữ liệu
1. **PostgreSQL Database:** Quản lý toàn bộ cấu trúc dữ liệu quan hệ, tài khoản, phiên làm việc máy chủ (server-side session), phân công lớp, tác phẩm, metadata tài liệu, trạng thái tác vụ lập chỉ mục (`indexing_jobs`), hạn mức sử dụng cá nhân & hệ thống, khóa chống lặp (`idempotency_keys`), và nhật ký kiểm toán (`audit_logs`).
2. **Gemini File Search Store:** Dịch vụ RAG được quản lý bởi Google Gemini. Lưu trữ vector embeddings (sử dụng model `models/gemini-embedding-2`), chỉ mục semantic search và trả về trích dẫn (`file_citation`) gắn với từng câu trả lời.
3. **Local/Managed Upload Storage:** Lưu trữ tạm file giáo viên tải lên trong quá trình upload và xử lý trước khi đẩy vào Gemini File Search Store.

## 3. Quy trình RAG 2 bước thực sự
1. **Bước 1 - Lập phạm vi truy xuất & Gọi công cụ:** Backend lấy danh sách các `file_search_store_names` mà học sinh được phép truy cập dựa trên lớp học và tác phẩm đang chọn. Backend cấu hình công cụ `file_search` chỉ chứa các store được phép này.
2. **Bước 2 - Phân tích Grounding & Quyết định phát hành:**
   - Khi Gemini trả về phản hồi qua Interactions API (`interaction.steps`), backend duyệt qua `model_output` steps và các annotations `file_citation`.
   - Nếu phản hồi có trích dẫn hợp lệ từ tài liệu trong phạm vi: hiển thị câu trả lời kèm tên tài liệu và đoạn trích dẫn thực tế.
   - Nếu không có trích dẫn hoặc thông tin không đủ căn cứ: hệ thống trả về thông báo từ chối "chưa đủ thông tin dựa trên tài liệu được cấp", **không tính lượt hỏi** vào quota hàng ngày của học sinh, và **tuyệt đối không bịa đặt nguồn**.

## 4. Công nghệ & Thư viện sử dụng
- **Backend:** Node.js 24+, Express, TypeScript, `pg` (PostgreSQL), `argon2`, `otplib` (TOTP), `zod` (validation), `@google/genai` (SDK chính thức).
- **Frontend:** React 19 / 18, Vite, TypeScript, Tailwind CSS, Lucide React, DOMPurify.
- **Bảo mật:** Helmet, CORS (cùng origin production), HttpOnly SameSite Strict cookies, CSRF Token Header, Session Regeneration, Account Lockout & Rate Limiting.

## 5. Chiến lược Phục vụ RAG & Bảo toàn Băng thông AI
Để tối ưu hóa trải nghiệm tương tác của học sinh, triệt tiêu độ trễ kép và tránh tình trạng nghẽn API (lỗi 503 Overloaded do gọi lặp nhiều lần cho một câu hỏi):
- **Kiến trúc Contextual RAG trực tiếp:** Chatbot Cô Dương sử dụng grounding trực tiếp từ tài liệu giáo viên đã phê duyệt thông qua Gemini File Search Tool / Vector Store với System Instruction chuẩn mực Sư phạm Ngữ văn.
- **Trích dẫn dẫn chứng nguyên văn:** Yêu cầu mô hình trích dẫn dẫn chứng trong thẻ trích dẫn `> "..."` kèm tên tài liệu bài giảng/nguyên tác ngay trong câu trả lời.
- **Tối ưu hạn mức & độ tin cậy:** Loại bỏ tầng kiểm chứng hậu kỳ phức tạp (ALCE verifier call kép) để giảm 50% số lượng request lên Gemini API, bảo đảm câu trả lời mượt mà, đầy đủ cảm xúc văn học và không bị gián đoạn hay chèn các cảnh báo lỗi kết nối kỹ thuật.


