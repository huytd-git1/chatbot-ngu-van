# Hướng dẫn Vận hành Phân loại Tài liệu & Kiểm chứng Trích dẫn
### Dự án: Chatbot RAG “Cô Dương dạy văn dễ thương”
**Tác giả**: made by huytd

---

## 1. Giới thiệu tổng quan

Hệ thống bổ sung cơ chế **phân loại tài liệu đa tầng** và **kiểm chứng trích dẫn nguyên tác tại backend** nhằm đảm bảo:
1. **Chống bịa đặt trích dẫn:** Học sinh chỉ nhận được các câu trích thực sự tồn tại trong văn bản tác phẩm gốc do giáo viên kích hoạt.
2. **Phân định ranh giới nguồn:** Phân biệt rõ giữa *Văn bản tác phẩm gốc* (dùng để trích nguyên văn) và *Tài liệu tham khảo/phân tích/giáo án* (dùng để gợi ý luận điểm, bối cảnh, nghệ thuật, không trích làm lời tác giả).
3. **Bảo vệ an toàn kho RAG:** Mọi tài liệu mới tải lên chưa qua phân loại (`unclassified`) sẽ ở trạng thái chờ duyệt và **tuyệt đối không đưa vào RAG**.

---

## 2. Nguyên tắc và Vai trò nguồn tài liệu

| Vai trò tài liệu (`document_role`) | Trạng thái (`is_active`) | Được sử dụng để | Ràng buộc hệ thống |
|---|---|---|---|
| **Văn bản gốc** (`primary`) | `true` (Đang kích hoạt) | Xác định chi tiết tác phẩm, cung cấp câu trích nguyên văn `> "..."` có đối chiếu. | **Tối đa đúng 1 bản** duy nhất cho mỗi tác phẩm (ràng buộc DB cấp Partial Unique Index). |
| **Văn bản gốc** (`primary`) | `false` (Lưu trữ / Chờ duyệt) | Lưu trữ các phiên bản cũ hoặc bản scan OCR chờ giáo viên rà soát. | Không đưa vào RAG cho đến khi giáo viên nhấn "Kích hoạt thay thế". |
| **Tài liệu tham khảo** (`reference`) | `true` | Bổ trợ luận điểm, bối cảnh lịch sử, giáo án, định hướng trả lời. | Không trích nguyên văn; nếu có câu trích khác bản gốc, hệ thống ưu tiên bản gốc. |
| **Chưa phân loại** (`unclassified`) | `false` | Chờ giáo viên xem xét, duyệt nhãn. | **Tuyệt đối không đưa vào RAG**, học sinh không truy vấn được. |

---

## 3. Quy trình vận hành dành cho Giáo viên

### Bước 1: Quản lý tác phẩm và tải tài liệu
1. Đăng nhập tài khoản Giáo viên (`teacher`) hoặc Quản trị viên (`admin`).
2. Vào mục **Quản lý Tác phẩm & Tài liệu**.
3. Chọn tác phẩm cần cấu hình (ví dụ: *Lặng lẽ Sa Pa*).
4. Trong khung **Tải tài liệu mới & phân loại vai trò**:
   - Nhập **Tiêu đề tài liệu**.
   - Chọn vai trò:
     - `Tài liệu tham khảo / Phân tích`: chọn phân loại con (*Phân tích chuyên sâu*, *Giáo án giảng dạy*, *Bối cảnh lịch sử*, *Câu hỏi & đáp*, *Khác*).
     - `Đề xuất văn bản tác phẩm gốc (chờ duyệt)`: tải văn bản gốc mới (sẽ ở trạng thái chờ duyệt trước khi kích hoạt).
     - `Chưa phân loại`: tải tệp lên để duyệt sau.
   - Chọn tệp văn bản chuẩn UTF-8 định dạng `.txt` hoặc `.md` (bắt buộc `.txt` hoặc `.md` nhằm đảm bảo dữ liệu sạch, không rác OCR hay định dạng lỗi từ PDF/DOCX scan) và nhấn **Tải lên & Lưu kho**.
   - Nếu cần cập nhật lại chỉ mục hoặc làm mới nội dung tài liệu, giáo viên có thể nhấn nút **"Tải lại tài liệu"** (Reload / Re-index) ngay cạnh tài liệu trong danh sách.

### Bước 2: Kích hoạt bản gốc có hiệu lực (Atomic Switch)
1. Trong danh sách tài liệu, tìm tài liệu văn bản gốc bạn muốn sử dụng.
2. Nhấn nút **"Đặt làm bản gốc"** (hoặc **"Kích hoạt thay thế"**).
3. Hệ thống sẽ thực hiện giao dịch nguyên tử (`transaction`):
   - Ngừng kích hoạt bản gốc cũ (`is_active = false`).
   - Kích hoạt bản gốc mới (`is_active = true`, tăng số phiên bản `version`).
   - Trích xuất tự động văn bản thành các đoạn (`work_paragraphs`), nhận diện số trang `[Trang X]` nếu có.
   - Vô hiệu hóa cache cũ gắn với tác phẩm.
   - Ghi nhận người duyệt (`reviewed_by`) và thời điểm duyệt (`reviewed_at`).

### Bước 3: Xem trước đoạn trích xuất (OCR & Phân trang)
1. Nhấn nút **"Xem các đoạn (OCR)"** cạnh văn bản gốc.
2. Cửa sổ hiển thị danh sách tất cả các đoạn trích xuất kèm thứ tự đoạn và số trang tương ứng.
3. Giáo viên kiểm tra kỹ xem có lỗi OCR, mất dấu tiếng Việt hoặc sai trang không.
4. Có thể mở mục *Xem bản chuẩn hóa dùng cho so khớp trích dẫn* để biết chuỗi ký tự mà backend sẽ dùng để so khớp nguyên văn.

### Bước 4: Kiểm tra Báo cáo đối chiếu mâu thuẫn tài liệu (Diff Report)
1. Nhấn nút **"Đối chiếu tài liệu"** ở góc trên danh sách tài liệu.
2. Hệ thống tự động phân tích toàn bộ tài liệu tham khảo hiện có, trích xuất các câu trích dẫn và đối chiếu với bản gốc đang kích hoạt.
3. Nếu tài liệu tham khảo trích dẫn sai từ, đổi dấu hoặc trích câu không có trong bản gốc, hệ thống đánh dấu cảnh báo `⚠️ Câu trong tham khảo không khớp bản gốc`.
4. Giáo viên xem xét để điều chỉnh giáo án hoặc cập nhật tài liệu tham khảo nếu cần.

---

## 4. Cơ chế kiểm chứng trích dẫn Backend (Chống ảo giác)

Khi học sinh đặt câu hỏi:
1. **Kiểm tra điều kiện tiên quyết:**
   - Nếu tác phẩm chưa có bản gốc nào đang kích hoạt (`document_role = 'primary' AND is_active = true`), hệ thống phản hồi nhắc nhở học sinh liên hệ giáo viên kích hoạt văn bản gốc, **bảo toàn hạn mức 100%**.
2. **Dual-source Prompting:**
   - Đưa văn bản gốc vào khu vực riêng biệt: `[VĂN BẢN TÁC PHẨM GỐC DUY NHẤT ĐANG CÓ HIỆU LỰC]`.
   - Đưa tài liệu tham khảo vào khu vực: `[TÀI LIỆU THAM KHẢO & PHÂN TÍCH HỖ TRỢ]`.
   - Chỉ thị nghiêm ngặt cho mô hình: Chỉ trích dẫn nguyên văn trong khối `> "..."` từ văn bản gốc; không trích từ tài liệu tham khảo.
3. **Backend Quote Verification Engine (`verifyQuote`):**
   - Backend quét toàn bộ các khối trích dẫn trong câu trả lời do AI sinh ra.
   - Chuẩn hóa Unicode NFC, loại bỏ khoảng trắng thừa (giữ nguyên chữ hoa/thường và dấu tiếng Việt chuẩn).
   - Đối chiếu với kho `work_paragraphs` của bản gốc đang kích hoạt:
     - Khớp chính xác hoặc khớp dạng rút gọn `[...]`.
     - Nếu câu trích chỉ tìm thấy trong tài liệu tham khảo chứ không có trong bản gốc -> **Từ chối ngay lập tức**, gỡ bỏ khối trích dẫn giả khỏi câu trả lời của học sinh.
     - Nếu câu trích bị đổi chữ, sai dấu hoặc ID đoạn giả -> **Từ chối**, không gắn nhãn trích dẫn.
4. **Hiển thị phân tách trên giao diện học sinh:**
   - **Dẫn chứng từ tác phẩm gốc:** Khối xanh ngọc với huy hiệu `✓ Đã đối chiếu nguyên tác`, tên văn bản, số trang (nếu có), và nút "Xem ngữ cảnh đoạn".
   - **Nguồn hỗ trợ phân tích:** Khối riêng biệt liệt kê tài liệu tham khảo hỗ trợ lập luận và bối cảnh.

---

## 5. Danh mục các tệp đã cập nhật

| Tệp | Chức năng thực hiện |
|---|---|
| `backend/src/db/migrate.ts` | Thêm cột `document_role`, `reference_type`, `is_active`, `ocr_status`, `reviewed_by`, `reviewed_at`. Thêm partial unique index `idx_unique_active_primary_per_work`. Tạo bảng `work_paragraphs`. |
| `backend/src/services/paragraph.service.ts` | Service tách đoạn, phát hiện số trang `[Trang X]`, lưu trữ đoạn gốc & đoạn chuẩn hóa, engine so khớp `verifyQuote` (hỗ trợ `[...]`, giữ nguyên dấu tiếng Việt), `generateDocumentDiffReport`. |
| `backend/src/services/document.service.ts` | Bổ sung phân loại khi upload, atomic transaction `activatePrimaryDocument`, `updateDocumentClassification`, nạp lại tài liệu `reloadDocument`. |
| `backend/src/services/gemini.service.ts` | Dual-source grounding prompt, backend blockquote verification & strip unverified quotes, mock file search grounded in primary paragraphs, gợi ý câu hỏi thông minh từ trích dẫn. |
| `backend/src/controllers/teacher.controller.ts` | Endpoints kích hoạt bản gốc, đổi phân loại, xem paragraphs, xem báo cáo diff, reload document. |
| `backend/src/controllers/student.controller.ts` | Kiểm tra bắt buộc có bản gốc active, lọc bỏ tài liệu unclassified, trả về `primaryCitations` và `referenceCitations`. |
| `backend/src/db/seed.ts` | Seed dữ liệu mẫu văn bản gốc có đánh dấu trang `[Trang 1..3]` và tài liệu phân tích cho tác phẩm *Lặng lẽ Sa Pa*. |
| `backend/src/__tests__/document_classification_and_verification.test.ts` | 10 unit tests kiểm tra toàn diện: ràng buộc 1 bản gốc DB, trích xuất đoạn, so khớp trích dẫn, từ chối câu trích từ tham khảo, báo cáo diff, RAG dual citations. |
| `frontend/src/types.ts` | Bổ sung các interface: `DocumentItem` cập nhật, `PrimaryCitation`, `ReferenceCitation`, `ParagraphItem`, `DocumentDiffReport`, `DocumentDiffItem`. |
| `frontend/src/components/TeacherDashboard.tsx` | Giao diện quản lý 3 nhóm tài liệu (Bản gốc, Tham khảo, Chưa phân loại), cảnh báo thiếu bản gốc, nút tải lại tài liệu, modal xem trước đoạn trích xuất (OCR & Trang), modal Báo cáo đối chiếu tài liệu. |
| `frontend/src/components/StudentChat.tsx` | Giao diện hiển thị phân tách 2 nhóm nguồn dưới câu trả lời của AI: Dẫn chứng từ tác phẩm gốc (`✓ Đã đối chiếu nguyên tác`, số trang, xem ngữ cảnh đoạn) và Nguồn hỗ trợ phân tích. |
