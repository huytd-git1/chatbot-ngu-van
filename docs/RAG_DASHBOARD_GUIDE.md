# HƯỚNG DẪN QUẢN TRỊ VIÊN & GIÁO VIÊN: DASHBOARD KIỂM TRA & ĐÁNH GIÁ RAG
**Dự án:** Cô Dương dạy văn dễ thương  
**Đối tượng sử dụng:** Quản trị viên hệ thống (Admin) & Giáo viên phụ trách môn Ngữ văn  
**Cập nhật lần cuối:** 22/10/2026  

---

## 1. Giới thiệu chung về Dashboard RAG

Dashboard **"Kiểm tra & đánh giá RAG"** là trung tâm giám sát chất lượng phản hồi, kiểm soát ngân sách token và đánh giá tính xác thực của câu trả lời do trợ lý AI tạo ra.

Menu này nằm trong trang **Quản trị hệ thống (Admin Portal)** tại tab **"Kiểm tra & đánh giá RAG"**.

---

## 2. Hướng dẫn tính năng "↻ Tạo lại metadata" cho từng tài liệu

### Mục đích:
Tạo bản tóm tắt, trích xuất hệ thống chủ đề, nhân vật, chi tiết nghệ thuật, luận điểm phân tích và các câu hỏi-đáp mẫu từ tài liệu để hỗ trợ tìm kiếm và chọn đoạn (chunk).

### Các bước thực hiện:
1. Đăng nhập với tài khoản **Giáo viên** hoặc **Admin**, vào mục **"Tác phẩm & tài liệu RAG"**.
2. Chọn tác phẩm cần thao tác (ví dụ: *Vợ nhặt* hoặc *Lặng lẽ Sa Pa*).
3. Tại thẻ của bất kỳ tệp tài liệu nào (Bản gốc hoặc Tài liệu tham khảo), bấm nút **"Metadata"** (có biểu tượng ✨).
4. Cửa sổ **"Trích xuất & Quản lý Metadata RAG"** sẽ mở ra:
   - Nếu tài liệu chưa có metadata: Bấm **"⚡ Bắt đầu tạo Metadata"**.
   - Nếu tài liệu đã có metadata và muốn cập nhật: Bấm **"↻ Tạo lại metadata"**.
5. **Quy trình chạy ngầm:**
   - Hệ thống khởi tạo một tác vụ nền (`metadata_jobs`). Bạn có thể tải lại trang hoặc đóng tab, tiến trình vẫn tiếp tục chạy.
   - Khi hoàn tất, bản phân tích mới sẽ được lưu dưới dạng **Bản nháp (Draft - Chờ duyệt)**. Bản metadata đang sử dụng trước đó vẫn tiếp tục phục vụ hỏi đáp bình thường.
6. **Xem và Duyệt:**
   - Người quản lý có thể xem trước nội dung: Tóm tắt, Chủ đề, Nhân vật, Luận điểm, Câu hỏi trích từ tài liệu.
   - Bấm **"Chỉnh sửa nháp"** nếu muốn bổ sung hoặc sửa đổi các luận điểm.
   - Bấm **"✓ Phê duyệt & Kích hoạt bản này"** để áp dụng chính thức cho hệ thống truy xuất RAG.

> **Lưu ý an toàn:** Metadata do AI tạo ra chỉ nhằm mục đích hỗ trợ tìm kiếm và liên kết chunk; câu trả lời cuối cùng cho học sinh vẫn luôn căn cứ vào nội dung nguyên tác và tài liệu tham khảo chính thức.

---

## 3. Hướng dẫn phân hệ "Đoạn & Vị trí nguồn" (2 Cột Highlight)

### Mục đích:
Giúp giáo viên và admin kiểm tra trực quan thuật toán cắt đoạn (chunking), độ dài token ước lượng và vị trí chính xác của từng đoạn trên văn bản gốc.

### Các bước sử dụng:
1. Vào tab **"2. Đoạn & Vị trí nguồn"** trong Dashboard RAG.
2. Chọn **Tác phẩm** và chọn **Tài liệu** cần kiểm tra.
3. Màn hình chia làm 2 cột:
   - **Cột trái:** Văn bản nguồn đầy đủ của tác phẩm hoặc tài liệu tham khảo.
   - **Cột phải:** Danh sách các đoạn (chunks) đã được băm nhỏ kèm số token ước lượng và mã thứ tự (`#1, #2...`).
4. **Tương tác tô sáng:**
   - Bấm vào bất kỳ thẻ chunk nào ở cột phải.
   - Hệ thống sẽ **tô sáng màu vàng** đúng vị trí ký tự (`start_offset` đến `end_offset`) trên cột trái.
   - Giúp kiểm tra xem chunk có bị cắt ngang chừng câu thơ, hội thoại hoặc làm mất ngữ cảnh tác giả hay không.

---

## 4. Hướng dẫn sử dụng "Phòng thử nghiệm RAG" (Playground)

### Mục đích:
Cho phép Admin kiểm tra trực tiếp khả năng trả lời của hệ thống trước một câu hỏi cụ thể, xem xuyên suốt từ khâu truy xuất, dựng prompt đến kiểm chứng câu trích mà **không bị trừ lượt hỏi của học sinh**.

### Các bước thực hiện:
1. Vào tab **"3. Phòng thử nghiệm RAG"**.
2. Chọn **Tác phẩm** và **Chế độ học** (Hỏi đáp nhanh, Lập dàn ý, Phân tích nghệ thuật, Luyện viết).
3. Nhập câu hỏi kiểm tra (ví dụ: *"Ý nghĩa chi tiết bát cháo cám trong tác phẩm Vợ nhặt"*).
4. Bấm **"Chạy thử nghiệm RAG"**.
5. Xem kết quả qua 4 tab chi tiết:
   - **1. Câu trả lời & Kiểm chứng:** Xem câu trả lời của mô hình, nhãn kiểm chứng câu trích nguyên tác (Khớp / Lệch) và danh sách tài liệu tham khảo thực sự được trích dẫn.
   - **2. Đoạn truy xuất:** Danh sách các chunk tham khảo (`[R]`) và chunk nguyên tác (`[P]`) được hệ thống chọn lọc cùng điểm số phù hợp.
   - **3. Ngữ cảnh đã gửi vào LLM:** Xem chính xác toàn bộ chuỗi prompt đưa vào API mô hình.
   - **4. Token & Độ trễ:** Thống kê số token input/output thực tế của nhà cung cấp và thời gian phản hồi.

---

## 5. Hướng dẫn tra cứu Trace & Chấm điểm thủ công (Admin Rubric)

### Mục đích:
Rà soát lịch sử tương tác thực tế của học sinh và đánh giá chất lượng sư phạm của câu trả lời.

### Các bước thực hiện:
1. Vào tab **"4. Nhật ký Trace & Đánh giá"**.
2. Sử dụng bộ lọc theo phương thức (`Nội bộ`, `Google File Search`, `Dự phòng Offline`, `Cache`) hoặc tìm kiếm theo câu hỏi.
3. Bấm **"Xem chi tiết"** tại bất kỳ dòng trace nào.
4. Tại biểu mẫu **"Đánh giá chất lượng thủ công (Admin Rubric)"**:
   - **Điểm truy xuất:** Chấm từ 1 đến 5 sao theo mức độ đầy đủ của thông tin.
   - **Kiểm chứng câu trích nguyên tác:** Đánh giá là *Trích đúng từng chữ*, *Bị sửa từ*, hay *Tự bịa câu trích*.
   - **Cơ sở phân tích từ tài liệu tham khảo:** Đánh giá *Được hỗ trợ hoàn toàn*, *Hỗ trợ một phần*, hay *Suy diễn ngoài luồng*.
   - Đánh dấu các ô kiểm: *Thiếu bằng chứng*, *Đúng định dạng chế độ*.
   - Nhập ghi chú sư phạm và bấm **"Lưu đánh giá thủ công"**.
5. Kết quả đánh giá sẽ lập tức phản ánh vào điểm chất lượng trung bình trên trang Tổng quan.

---

## 6. Hướng dẫn tạo Bộ đề chuẩn & Chạy Benchmark

### Mục đích:
Thực hiện đánh giá hồi quy tự động khi thay đổi cấu hình mô hình, prompt hoặc thuật toán chia đoạn.

### Các bước thực hiện:
1. Vào tab **"5. Bộ đề chuẩn & Benchmark"**.
2. Tạo bộ đề mới tại ô **"Tạo bộ câu hỏi chuẩn"** (ví dụ: *Bộ đề luyện thi vào 10 - Truyện ngắn hiện đại*).
3. Bấm **"+ Thêm ca hỏi"** để tạo các ca kiểm thử:
   - Nhập câu hỏi mẫu.
   - Nhập các đoạn dẫn chứng nguyên tác kỳ vọng.
   - Nhập các luận điểm cần có.
   - Đánh dấu *"Ca này kỳ vọng hệ thống Từ chối / Báo thiếu nguồn"* nếu đây là câu hỏi gài bẫy kiến thức không có trong tài liệu.
4. Bấm **"Chạy Benchmark"**:
   - Hệ thống sẽ chạy tuần tự các ca hỏi đáp với cấu hình hiện tại.
   - Thống kê tỷ lệ chính xác, số token trung bình và độ trễ vào bảng **Lịch sử các lần chạy Benchmark & So sánh**.
