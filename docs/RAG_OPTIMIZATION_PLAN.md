# KẾ HOẠCH TỐI ƯU HÓA HỆ THỐNG RAG & BỘ CÔNG CỤ QUẢN TRỊ
## Dự án: "Cô Dương dạy văn dễ thương"
**Phiên bản:** 2.0 (Toàn diện: RAG Pipeline, Token Budgeting, Metadata Service & Admin Evaluation Dashboard)  
**Ngày lập:** 22/10/2026  
**Người thực hiện:** Kỹ sư Full-Stack phụ trách RAG & AI Cost Optimization  

---

## I. KHẢO SÁT HIỆN TRẠNG & ĐỐI CHIẾU MÃ NGUỒN

Qua quá trình đối chiếu toàn diện giữa tài liệu thiết kế (`ARCHITECTURE.md`, `RAG_REPORT.md`, `CHUNKER_REPORT.md`, `ANSWER_VERIFICATION_REPORT.md`, `DOCUMENT_CLASSIFICATION_AND_VERIFICATION_GUIDE.md`) với mã nguồn thực tế tại `backend/src/services/gemini.service.ts`, `backend/src/controllers/student.controller.ts`, `backend/src/services/paragraph.service.ts`, `backend/src/services/document.service.ts`, chúng tôi xác nhận 5 vấn đề cốt lõi sau:

### 1. Nhánh ghép toàn văn bản gốc và toàn bộ tài liệu tham khảo vào Prompt
- **Vị trí mã nguồn:**
  - `backend/src/controllers/student.controller.ts` (dòng 220–225): Truy vấn tài liệu nguyên tác `primaryDoc` và danh sách toàn bộ `referenceDocs` từ bảng `documents`.
  - `backend/src/services/gemini.service.ts` (dòng 2226–2244 và 2431–2442 trong hàm `executeRagQuery`): Cả hai nhánh Third-party và Google Direct Context đều lặp qua toàn bộ `referenceDocs` và chèn trực tiếp toàn bộ `rawContent` (`doc.rawContent`) cùng toàn văn tác phẩm gốc `primaryDoc.rawContent` vào prompt.
- **Hiện trạng:** Đã kiểm chứng (VERIFIED IN CODE). Một tác phẩm dài (ví dụ *Tây Tiến*, *Vợ chồng A Phủ*, *Người lái đò Sông Đà*) kết hợp cùng 3–5 giáo án/tài liệu tham khảo khiến prompt input phình to lên tới 25.000–60.000 tokens mỗi lượt hỏi thông thường, gây lãng phí chi phí LLM nghiêm trọng và vượt ngưỡng ngữ cảnh tối ưu của mô hình.

### 2. Chia đoạn (Chunking) chưa được dùng để truy xuất trước khi gọi LLM
- **Vị trí mã nguồn:**
  - `backend/src/services/paragraph.service.ts`: Cung cấp hàm `splitIntoParagraphs` và lưu vào bảng `work_paragraphs`.
  - `backend/src/controllers/student.controller.ts`: Không hề có bước truy xuất đoạn văn liên quan (`retrieveChunks` hay `searchParagraphs`) trước khi gọi `executeRagQuery`. Bảng `work_paragraphs` chỉ được dùng sau khi LLM đã sinh xong câu trả lời để kiểm chứng câu trích (`verifyQuote` tại dòng 248–265).
- **Hiện trạng:** Đã kiểm chứng (VERIFIED IN CODE). Chunking hiện tại là post-verification chứ không phải RAG pre-retrieval.

### 3. Tự động liệt kê toàn bộ tài liệu tham khảo thành nguồn trích dẫn (Citations)
- **Vị trí mã nguồn:**
  - `backend/src/services/gemini.service.ts` (dòng 2057–2061):
    ```typescript
    const referenceCitations = referenceDocs.map((doc, idx) => ({
      documentId: doc.id,
      documentTitle: doc.title,
      sourceType: 'reference',
      ...
    }));
    ```
- **Hiện trạng:** Đã kiểm chứng (VERIFIED IN CODE). Dù LLM chỉ sử dụng ý từ 1 tài liệu tham khảo (hoặc không dùng tài liệu nào), hệ thống vẫn tự động gán toàn bộ `referenceDocs` vào trường `citations` trả về cho học sinh, gây ngộ nhận về căn cứ học liệu.

### 4. Gắn cờ sai lệch "đã dùng File Search" ở nhánh gửi ngữ cảnh trực tiếp
- **Vị trí mã nguồn:**
  - `backend/src/services/gemini.service.ts` (dòng 2298 và 2511): Đặt cờ `toolActuallyUsed = true` bất kể việc gọi LLM chỉ truyền text thông qua system prompt context mà không kích hoạt công cụ tìm kiếm tệp nào của API.
- **Hiện trạng:** Đã kiểm chứng (VERIFIED IN CODE). Dashboard và log hiểu nhầm là query đã qua Gemini File Search Tool.

### 5. Chuyển sang Mock khi API thật gặp lỗi mà vẫn trừ hạn mức học sinh
- **Vị trí mã nguồn:**
  - `backend/src/services/gemini.service.ts` (dòng 2301–2317, 2588–2608 trong `fallbackToMockResponse`).
  - `backend/src/controllers/student.controller.ts` (dòng 288–296): Khi `executeRagQuery` trả về `isMock: true`, controller vẫn gọi `QuotaService.recordSuccess(...)` trừ lượt hỏi của học sinh như một câu trả lời thực thụ từ AI.
- **Hiện trạng:** Đã kiểm chứng (VERIFIED IN CODE). Học sinh bị mất lượt khi hệ thống gặp sự cố mạng hoặc lỗi nhà cung cấp.

---

## II. NGUYÊN TẮC RAG MỚI & THIẾT KẾ KIẾN TRÚC TOÀN DIỆN

### 1. Phân định vai trò tài liệu (Document Roles)
- **Tài liệu tham khảo (Reference Docs):** Là nguồn chính để truy xuất kiến thức:
  - Hướng dẫn trả lời, câu hỏi - đáp án.
  - Luận điểm, luận cứ, kiến thức bối cảnh, giáo án giảng dạy.
  - Phân tích nhân vật, chi tiết nghệ thuật.
  - Ký hiệu mã hóa trong prompt: `[R1]`, `[R2]`, ...
- **Văn bản nguyên tác (Primary Doc):** Duy nhất 1 bản active cho mỗi tác phẩm. Dùng để:
  - Cung cấp dẫn chứng nguyên văn chính xác.
  - Đối chiếu câu trích (Quote Verification) tại backend.
  - Ký hiệu mã hóa trong prompt: `[P1]`, `[P2]`, ...
- **Nguyên tắc "Căn cứ đến đâu trả lời đến đó":**
  - Thiếu nguồn phân tích: Thông báo rõ ràng chưa có hướng dẫn phân tích tương ứng.
  - Thiếu dẫn chứng nguyên văn: Nghiêm cấm LLM tự bịa câu trích; backend loại bỏ câu trích không khớp với `[P]`.
  - Nguồn mâu thuẫn: Ghi nhận flag cảnh báo vào trace để giáo viên/quản trị viên xem xét.

---

## III. THIẾT KẾ HỆ THỐNG MỚI (TO-BE ARCHITECTURE)

```
[Học sinh / Admin Lab]
        │
        ▼ (Question + History + WorkId)
[StudentController / RagEvalController]
        │
        ├──► 1. Permission & Active Document Check (WorkId)
        │
        ├──► 2. Pre-Retrieval (RetrievalService)
        │        ├── Truy xuất top-k Chunks Tham khảo (BM25 / Trigram / Keywords + Metadata)
        │        ├── Truy xuất top-m Chunks Nguyên tác (Hỗ trợ câu hỏi & dẫn chứng liên quan)
        │        └── Lọc bỏ trùng lặp & Xếp hạng (Relevance Reranking)
        │
        ├──► 3. Prompt Builder & Token Budget Manager
        │        ├── System Prompt (~1.5k)
        │        ├── History Context (~1k, trích lọc theo câu hỏi)
        │        ├── Reference Chunks Context (~4k, gắn mã [R1], [R2]...)
        │        ├── Primary Chunks Context (~3k, gắn mã [P1], [P2]...)
        │        └── Ngân sách Input: 9.000 – 12.000 tokens (Dành dư địa Output ~2k–4k)
        │
        ├──► 4. LLM Execution (Gemini / Provider API)
        │        └── Ghi nhận Token thật (UsageMetadata) & Model Info
        │
        ├──► 5. Post-Processing & Backend Quote Verification
        │        ├── Parse mã nguồn [Rx], [Px] được LLM sử dụng thực tế
        │        ├── Backend Quote Matcher: Kiểm tra câu trích [Px] khớp nguyên bản
        │        └── Chỉ giữ lại Citations cho các tài liệu THỰC SỰ hỗ trợ câu trả lời
        │
        └──► 6. Persistent Trace Logging (rag_traces & rag_trace_steps)
                 └── Lưu đầy đủ metadata, chunks, token, latencies, verification cho Dashboard
```

---

## IV. TÍNH NĂNG BỔ SUNG: "↻ TẠO LẠI METADATA" CHO TỪNG TÀI LIỆU RAG

Mỗi tài liệu trong "Tác phẩm & tài liệu RAG" có nút **"↻ Tạo lại metadata"**:
1. **Mục đích:** Phân tích nội dung văn bản để trích xuất các trường siêu dữ liệu hỗ trợ truy xuất và chọn chunk chính xác, không làm thay đổi nội dung nguyên tác hay quyền tài liệu.
2. **Schema Metadata:**
   - `summary`: Tóm tắt ngắn gọn.
   - `themes`: Danh sách các chủ đề chính.
   - `characters`: Các nhân vật xuất hiện.
   - `literary_details`: Các sự kiện, chi tiết, hình ảnh nghệ thuật nổi bật.
   - `analysis_points`: Các luận điểm phân tích quan trọng.
   - `qa_pairs`: Các câu hỏi - câu trả lời có trong tài liệu (phân biệt rõ câu hỏi trích từ tài liệu vs gợi ý).
   - `keywords`: Từ khóa và cách diễn đạt tương đương phục vụ tìm kiếm.
   - `chunk_links`: Ánh xạ các mục trên với ID chunk tương ứng.
3. **Quy trình hoạt động (Asynchronous Persistent Job):**
   - Bấm nút ➔ Tạo bản ghi trong `metadata_jobs` (trạng thái: `pending` ➔ `processing`).
   - Xử lý nền phân tích nội dung theo từng lô nhỏ (không gửi toàn văn vô hạn), sinh cấu trúc JSON.
   - Lưu bản nháp vào `document_metadata` với trạng thái `draft`.
   - Giáo viên/Admin xem trước (Preview), chỉnh sửa nếu cần và bấm **"Duyệt & Kích hoạt"** (`approved`).
   - Sau khi kích hoạt thành công, bản metadata mới chuyển sang `active`, bản cũ lưu lại lịch sử.

---

## V. DASHBOARD "KIỂM TRA & ĐÁNH GIÁ RAG" CHO QUẢN TRỊ VIÊN

Tích hợp vào `AdminDashboard` với 6 phân hệ cốt lõi:
1. **Tổng quan (Overview):**
   - Biểu đồ số lượt theo phương thức xử lý (Internal Retrieval, File Search, Direct Context).
   - Phân bố Input Token (System, History, Reference, Primary) và Output Token.
   - Độ trễ p50, p95; tỷ lệ retry/fallback; tỷ lệ thiếu nguồn; tỷ lệ câu trích khớp nguyên bản.
   - 100% dữ liệu truy vấn trực tiếp từ bảng `rag_traces`, không dùng mock hay số liệu giả.
2. **Kiểm tra Tài liệu & Chunks (Document & Chunk Inspector):**
   - Hiển thị 2 cột: Cột trái là văn bản gốc đầy đủ, cột phải là danh sách các chunk đã phân đoạn.
   - Bấm vào một chunk ➔ Tô sáng (highlight) chính xác vị trí của đoạn đó trên văn bản gốc dựa vào `startOffset` và `endOffset`.
   - Xem metadata, số token ước tính, mã băm (hash).
3. **Phòng thử nghiệm RAG (Playground / Testing Lab):**
   - Admin chọn Tác phẩm, Chế độ học (Phân tích, Hỏi nhanh, Dàn ý...), nhập Câu hỏi thử nghiệm.
   - Hiển thị xuyên suốt toàn bộ vòng đời RAG:
     - Chunks tìm được (kèm điểm relevance, lý do chọn/loại).
     - Ngữ cảnh thực tế đưa vào prompt cùng token count.
     - Raw output từ LLM, kết quả kiểm chứng trích dẫn của Backend, và câu trả lời hoàn thiện.
   - Không trừ hạn mức học sinh.
4. **Danh sách Trace (Traces Explorer):**
   - Tìm kiếm, lọc theo ngày, theo tác phẩm, trạng thái kiểm chứng.
   - Xem chi tiết từng step của query: input, output, tokens, latencies, lỗi sanitized.
5. **Đánh giá thủ công (Human Evaluation):**
   - Cho phép giáo viên/admin chấm điểm từng trace:
     - Truy xuất đúng hay sai.
     - Có thiếu bằng chứng không.
     - Câu trích có chuẩn xác nguyên văn không.
     - Lập luận có căn cứ hay suy diễn vô căn cứ.
     - Nhận xét và lưu người chấm.
6. **Bộ đề chuẩn & So sánh cấu hình (Benchmarks & Configuration Comparison):**
   - Quản lý tập câu hỏi vàng (Golden Datasets) kèm tiêu chuẩn chấp nhận.
   - Chạy batch so sánh giữa các phiên bản Prompt/Retriever/Model.
   - Đo lường Token trung bình, Latency, Tỷ lệ trích đúng.

---

## VI. KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN

| Giai đoạn | Nội dung công việc | Bàn giao & Kiểm tra |
|---|---|---|
| **Giai đoạn 1** | Khảo sát, lập kế hoạch chi tiết, cập nhật `docs/RAG_OPTIMIZATION_PLAN.md` | Báo cáo hiện trạng, mã nguồn đối chiếu xác minh |
| **Giai đoạn 2** | Database Migrations: Tạo bảng `document_chunks`, `document_metadata`, `metadata_jobs`, `rag_traces`, `rag_eval_testsets`, `rag_eval_runs` | Chạy migration trên PostgreSQL thật, kiểm tra ràng buộc |
| **Giai đoạn 3** | Cải tiến Chunking Service & Xây dựng Metadata Service (API + Background Worker) | API tạo/duyệt metadata, phân đoạn có offset chính xác, unit test |
| **Giai đoạn 4** | Xây dựng Pre-Retrieval Service & Token Budget Prompt Builder (9k–12k tokens) | Tách biệt nguồn `[R]` và `[P]`, tích hợp vào `GeminiService.executeRagQuery` |
| **Giai đoạn 5** | Refactor trích dẫn & kiểm chứng câu trích backend, loại bỏ mock trừ quota | Không trừ quota khi lỗi/mock, kiểm tra quote khớp chặt chẽ |
| **Giai đoạn 6** | Phát triển UI Dashboard "Kiểm tra & đánh giá RAG" và nút "↻ Tạo lại metadata" | Giao diện React hoàn chỉnh, dữ liệu thật, highlight 2 cột |
| **Giai đoạn 7** | Kiểm thử hồi quy, Benchmark trước/sau, tài liệu hướng dẫn và báo cáo hoàn thành | `RAG_OPTIMIZATION_REPORT.md`, `RAG_DASHBOARD_GUIDE.md`, pass toàn bộ test |
