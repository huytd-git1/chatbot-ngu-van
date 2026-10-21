# KIẾN TRÚC HỆ THỐNG: CÔ DƯƠNG DẠY VĂN DỄ THƯƠNG
**Tác giả**: made by huytd  
**Phiên bản**: Tháng 10/2026

## 1. Tổng quan hệ thống
Hệ thống là ứng dụng Web RAG (Retrieval-Augmented Generation) chuyên biệt cho bộ môn Ngữ văn cấp THCS/THPT, hỗ trợ cơ chế đa nhà cung cấp AI: **Google Gemini Official SDK** và **Cổng Bên Thứ Ba (Third-Party Gateway: RevidAPI, RouteAPI, OpenRouter)** kết hợp cùng bộ phân đoạn văn bản ngữ nghĩa (`ParagraphService`).

```
                           +-------------------------------------+
                           |            Trình duyệt              |
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
|  | - Argon2id hashing |  | - Asia/Ho_Chi_Minh   |  | - Format (.txt / .md)  |  |
|  | - Server sessions  |  | - Atomic reserve     |  | - Paragraph Chunker    |  |
|  | - TOTP 2FA         |  | - Key anti-duplicate |  | - Page marker parser   |  |
|  | - Unlimited Admin  |  | - Safe refund        |  | - Document re-indexer  |  |
|  +--------------------+  +----------------------+  +------------------------+  |
|                                                                                |
|  +--------------------------------------------------------------------------+  |
|  | RAG Orchestrator Engine                                                  |  |
|  |                                                                          |  |
|  | [Nhánh A: Google Official Gemini SDK]     [Nhánh B: Third-Party Gateway] |  |
|  | - @google/genai SDK v2.3.0+               - RevidAPI / RouteAPI / OpenR. |  |
|  | - Gemini File Search Store / Tool         - OpenAI-compatible chat API   |  |
|  | - Gemini Key Pool & Round-Robin           - Multi-token rotation         |  |
|  | - Cooldown 60s khi 429 / 503              - Auto-fallback model (403)    |  |
|  |                                                                          |  |
|  | [Bộ So Khớp & Kiểm Chứng Trích Dẫn]                                     |  |
|  | - Phân định: 1 Bản gốc (Primary) duy nhất vs Tài liệu tham khảo          |  |
|  | - So khớp nguyên văn câu trích với work_paragraphs (Unicode NFC)          |  |
|  | - Loại bỏ trích dẫn mạo danh; sinh câu hỏi gợi mở từ trích dẫn           |  |
|  +--------------------------------------------------------------------------+  |
+---------------------+-----------------------------------+----------------------+
                      |                                   |
                      v                                   v
+-------------------------------+       +----------------------------------------+
|      PostgreSQL Database      |       |        Gemini File Search Store        |
| - users, roles, sessions      |       | - Store embeddings (gemini-embedding-2)|
| - classes, teacher_assignments|       | - Chunks & indices cho tài liệu giáo   |
| - works, documents, index_jobs|       |   viên biên soạn                      |
| - work_paragraphs (NFC chunks)|       | - Semantic vector retrieval            |
| - ai_settings (Key pools, DB) |       | - File citations & grounding metadata  |
| - quota_settings, usage_logs  |       +----------------------------------------+
| - chat_history, audit_logs    |
+-------------------------------+
```

## 2. Phân tầng dữ liệu & Lưu trữ
1. **PostgreSQL Database:** Quản lý toàn bộ cấu trúc dữ liệu quan hệ gồm 17 bảng:
   - Tài khoản, vai trò và phân quyền (`users`, `sessions`, `teacher_assignments`).
   - Danh mục đào tạo (`classes`, `works`, `class_work_access`).
   - Quản lý tài liệu và phân đoạn ngữ văn (`documents`, `work_paragraphs`, `indexing_jobs`).
   - Cấu hình hạ tầng AI bền vững (`ai_settings` lưu trữ dàn key pool Google và token bên thứ ba, lựa chọn model tổng thể và model riêng cho từng key qua `key_models`, preset cổng chuyển mạch).
   - Kiểm soát hạn mức và nhật ký (`quota_settings`, `quota_overrides`, `quota_extra_grants`, `daily_usage`, `idempotency_keys`, `audit_logs`, `chat_sessions`, `chat_messages`).
2. **Gemini File Search Store:** Lưu trữ vector embeddings đám mây của Google (mô hình `models/gemini-embedding-2`), phục vụ truy xuất ngữ nghĩa (semantic search) cho nhánh Google Official.
3. **Local/Managed Upload Storage:** Thư mục lưu trữ tạm các tệp tài liệu `.txt` và `.md` trước khi băm nhỏ và nạp vào cơ sở dữ liệu.

## 3. Quy trình RAG 4 Tầng Tự Động Chuyển Đổi (4-Tier Fallback)
1. **Tầng 1 - Google Gemini Native File Search:** Sử dụng API chính thức của Google để truy xuất ngữ nghĩa từ các File Search Store gắn với tác phẩm.
2. **Tầng 2 - Cổng Bên Thứ Ba (Third-Party Gateway):** Kết nối tới các cổng tương thích OpenAI như RevidAPI, RouteAPI, OpenRouter. Sử dụng danh sách token xoay vòng tự động, tự động chuẩn hóa tiền tố model (ví dụ: `gemini-3.6-flash` <-> `google/gemini-3.6-flash`) và xử lý lỗi phân quyền 403.
3. **Tầng 3 - Direct Context Grounding (In-Prompt Chunked RAG):** Bơm trực tiếp các đoạn văn bản có cấu trúc từ bảng `work_paragraphs` vào ngữ cảnh prompt kèm phân định rõ ràng giữa Bản gốc (`primary`) và Tài liệu tham khảo (`reference`).
4. **Tầng 4 - Fallback Search Ngoại tuyến:** Khi không có kết nối internet hoặc toàn bộ key hết quota, hệ thống tự động tìm kiếm đối sánh từ khóa trên các trích đoạn văn bản cục bộ, đảm bảo câu trả lời luôn hiển thị và không làm gián đoạn việc học của học sinh.

## 4. Công nghệ & Thư viện sử dụng
- **Backend:** Node.js 24+, Express, TypeScript, `pg` (PostgreSQL), `argon2`, `otplib` (TOTP), `zod` (validation), `@google/genai` (SDK chính thức), `fetch` (OpenAI-compatible HTTP client).
- **Frontend:** React 19 / 18, Vite, TypeScript, Tailwind CSS, Lucide React, DOMPurify.
- **Bảo mật:** Helmet, CORS (cùng origin production), HttpOnly SameSite Strict cookies, CSRF Token Header, Session Regeneration, Account Lockout & Rate Limiting.
- **Chân trang nhận diện:** `Cô Dương dạy văn dễ thương © 2026 • made by huytd`.

## 5. Chiến lược Phục vụ RAG & Bảo toàn Băng thông AI
- **Loại bỏ ALCE Post-hoc Verifier:** Chuyển sang kiểm chứng trích dẫn bằng mã logic backend Deterministic (`verifyAndBuildRagResult`), giảm 50% độ trễ và triệt tiêu lỗi 503 Quota Spikes.
- **Trích xuất gợi ý câu hỏi thông minh:** Thay vì gọi thêm API AI tốn token để sinh gợi ý, hệ thống tự động trích xuất các ý tưởng đào sâu từ chính đoạn trích dẫn (citations) của bài học, đảm bảo đúng tác phẩm và tiết kiệm 100% token gợi ý.
- **Bảo toàn dàn Key (Key Merging):** Khi bổ sung API key mới, hệ thống tự động gộp vào danh sách hiện có mà không xóa key cũ, bảo vệ nguồn tài nguyên vận hành của nhà trường.
