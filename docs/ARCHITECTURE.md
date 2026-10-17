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

## 5. Kiến trúc Kiểm chứng Câu trả lời RAG theo ý tưởng ALCE
Lấy cảm hứng từ bài báo *Enabling Large Language Models to Generate Text with Citations* (EMNLP 2023 - Princeton NLP), hệ thống bổ sung tầng kiểm chứng 2 lớp trước khi phát hành câu trả lời cho học sinh:

1. **Chuẩn hóa & Băm đoạn nguồn (`document_passages`)**:
   - Khi tài liệu được nạp vào hệ thống, các đoạn văn được chuẩn hóa Unicode NFC, băm SHA256 và định danh duy nhất (`passage_id = ${document_id}_p${index}`).
   - Phân loại rõ `source_type`: `text_primary` (văn bản nguyên tác), `analysis` (tài liệu phân tích), `lesson_plan` (giáo án), `qa_guide` (hướng dẫn hỏi đáp).
2. **Tầng 1 - Kiểm tra xác định bằng mã (Deterministic Code Checks)**:
   - **Quyền tài liệu**: Kiểm tra tác phẩm và lớp học còn hiệu lực trong `class_work_access`.
   - **Khớp nguyên văn**: Đối chiếu từng ký tự Unicode NFC chuẩn hóa, cấm tuyệt đối bỏ dấu tiếng Việt hoặc fuzzy matching. Trạng thái: `matched` | `mismatched` | `insufficient_data`.
   - **Loại nguồn**: Ngăn chặn trích dẫn lời phân tích của giáo viên nhưng lại gán là lời văn của tác giả.
3. **Tầng 2 - Kiểm chứng ngữ nghĩa gộp (Single Batched Semantic Verifier)**:
   - Gộp toàn bộ nhận định (claims) và phần phân tích (explanations) cùng các đoạn chứng cứ vào **duy nhất 1 request Gemini**.
   - Kiểm chứng tính kéo theo (entailment): `supported`, `partial`, `insufficient`, `contradicted`.
   - Đối với cảm thụ văn học (interpretive), đánh giá tính mạch lạc lập luận – dẫn chứng, không ép buộc phải xuất hiện nguyên văn.
   - Cơ chế phòng thủ Prompt Injection: Coi văn bản tài liệu là dữ liệu cần đánh giá, không tuân thủ chỉ dẫn nội bộ trong tài liệu.
4. **Answer Release Policy & PostgreSQL Cache**:
   - Chỉ phát hành khẳng định khi đạt `supported`. Các nhận định chưa đủ căn cứ được gắn cảnh báo rõ ràng.
   - Cache chính xác `verified_answer_cache` với TTL 24 giờ, tái kiểm tra quyền truy cập của học sinh khi đọc cache.

