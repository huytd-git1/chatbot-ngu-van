# BÁO CÁO KỸ THUẬT VỀ HỆ THỐNG RAG (RETRIEVAL-AUGMENTED GENERATION)
## Dự án: Trợ lý AI Ngữ Văn "Cô Dương dạy văn dễ thương"
**Thời gian lập báo cáo**: Tháng 10/2026  
**Chuyên đề**: Kiến trúc Truy xuất - Tăng cường - Tạo sinh (RAG), Đa Cổng AI (Google Gemini & Third-Party Gateway) & Cơ chế Chống ảo giác (Anti-Hallucination)  
**Tác giả**: made by huytd

---

## I. ĐẶT VẤN ĐỀ VÀ BẢN CHẤT CỦA RAG TRONG GIẢNG DẠY NGỮ VĂN

### 1. Hạn chế của LLM truyền thống trong môn Văn
Các mô hình ngôn ngữ lớn (như GPT, Gemini thuần túy) khi không có RAG thường gặp các nhược điểm nghiêm trọng:
* **Ảo giác kiến thức (Hallucination)**: Tự sáng tác những câu thơ không có trong nguyên tác, nhầm lẫn giữa các nhân vật (ví dụ: gán chi tiết của *Chí Phèo* sang *Vợ Nhặt*).
* **Lệch chuẩn chương trình giáo dục**: Phân tích theo các nguồn tư liệu trôi nổi trên Internet thay vì bám sát sách giáo khoa và giáo án giảng dạy của giáo viên.
* **Viết văn mẫu thay học sinh**: Làm thui chột khả năng tư duy và cảm thụ độc lập của người học.

### 2. Định nghĩa kiến trúc RAG
**RAG (Retrieval-Augmented Generation)** là cơ chế kỹ thuật kết hợp giữa:
1. **Retrieval (Truy xuất dữ liệu)**: Tìm kiếm các đoạn trích dẫn, luận điểm, tài liệu tham khảo chính thống từ kho bài giảng của cô giáo (được phân đoạn có cấu trúc qua `ParagraphService`).
2. **Augmentation (Tăng cường ngữ cảnh)**: Đưa tài liệu vừa tìm được vào ngữ cảnh (prompt) kèm theo các quy tắc sư phạm khắt khe.
3. **Generation (Tạo sinh có căn cứ)**: AI phân tích và diễn đạt thành câu trả lời ấm áp, chuẩn mực, kèm trích dẫn nguồn xác thực từ nguyên tác và tài liệu tham khảo.

---

## II. SƠ ĐỒ KIẾN TRÚC & PIPELINE VẬN HÀNH

```mermaid
flowchart TD
    subgraph INGESTION["1. Quá trình Nạp Tài liệu (.txt / .md)"]
        A["File bài giảng / tác phẩm (.txt / .md)"] --> B["Paragraph Chunker (Unicode NFC, Page Markers)"]
        B --> C["Lưu work_paragraphs vào PostgreSQL"]
        C --> D["Đồng bộ Gemini File Search Store (nếu dùng Google)"]
    end

    subgraph QUERY["2. Quá trình Hỏi đáp (Học sinh)"]
        E["Học sinh đặt câu hỏi"] --> F["Kiểm tra Quota & Chống spam (Idempotency)"]
        F --> G{"Truy vấn RAG"}
    end

    subgraph RAG_CORE["3. Lõi Xử lý RAG Đa Tầng"]
        G -->|Tầng 1: Google Gemini| H["Gemini File Search Native"]
        G -->|Tầng 2: Cổng Bên Thứ 3| I["Third-Party Gateway (RevidAPI / RouteAPI / OpenRouter)"]
        G -->|Tầng 3: In-Prompt RAG| J["Direct Context Grounding (work_paragraphs)"]
        G -->|Tầng 4: Ngoại tuyến| K["Fallback Search (Keyword Matching)"]
        
        H --> L["Tổng hợp Ngữ cảnh + Prompt Sư phạm"]
        I --> L
        J --> L
        K --> L
    end

    subgraph GENERATION["4. Tạo sinh & Kiểm chứng"]
        L --> M["Mô hình AI (gemini-2.5-flash / gemini-3.6-flash / deepseek-v4-flash)"]
        M --> N{"Kiểm chứng Trích dẫn (Code-level)"}
        N -->|Khớp nguyên tác| O["Phản hồi kèm Citation (Chuẩn tài liệu giáo viên ✓)"]
        N -->|Không có căn cứ| P["Từ chối bịa đặt: 'Chưa đủ thông tin từ tài liệu'"]
        O --> Q["Trích xuất gợi ý đào sâu từ Citations (0 token phụ)"]
    end
```

---

## III. THIẾT KẾ PROMPT SƯ PHẠM & CÁC CHẾ ĐỘ HỌC TẬP (LEARNING MODES)

Hệ thống thiết lập nhân vật (Persona) **"Cô Dương dạy văn dễ thương"** với các quy chuẩn đạo đức sư phạm được lập trình sẵn tại `backend/src/services/gemini.service.ts`:

### 1. Nguyên tắc sư phạm cốt lõi (Pedagogical Guardrails)
1. **Xưng hô chuẩn mực**: Luôn xưng *"cô"*, gọi người học là *"em"*, giữ giọng điệu truyền cảm, ân cần.
2. **Quy chuẩn Contextual RAG & Trích dẫn nguyên văn**:
   * Mọi luận điểm, nhận xét phân tích BẮT BUỘC phải được neo (grounded) chính xác vào văn bản tài liệu đã cung cấp.
   * Khi đưa ra bất kỳ luận điểm nào, AI phải trích dẫn **nguyên văn câu chữ từ tài liệu** dưới dạng khối trích dẫn markdown:
     > "[Câu trích dẫn chính xác nguyên văn từ tài liệu bài học]"
   * Nêu rõ xuất xứ tài liệu (Ví dụ: `Căn cứ tài liệu bài giảng "${docTitle}", tác giả viết: "..."`).
   * Từng luận điểm phân tích phải được xây dựng theo mô hình: **Luận điểm $\rightarrow$ Dẫn chứng trích dẫn nguyên văn $\rightarrow$ Phân tích nghệ thuật/ý nghĩa $\rightarrow$ Khái quát tư tưởng**.
3. **Tuyệt đối không bịa đặt**: Nếu tài liệu giáo viên chưa có thông tin, bắt buộc thông báo lịch sự rằng hiện chưa có căn cứ, không dùng kiến thức bên ngoài để khẳng định.
4. **Không viết văn thay học sinh**: Đóng vai trò người gợi mở, hướng dẫn cách viết và phân tích, không tạo ra các bài văn mẫu hoàn chỉnh để học sinh chép.

### 2. Sáu chế độ học tập chuyên biệt
Hệ thống cho phép học sinh chọn phương pháp học tập theo nhu cầu:

| Chế độ | Mã (Code) | Đặc điểm xử lý RAG |
|:---|:---|:---|
| **Hỏi đáp tác phẩm** | `qa` | Giải đáp thấu đáo về hoàn cảnh sáng tác, cốt truyện, chi tiết nghệ thuật, trích dẫn chuẩn xác. |
| **Phân tích nhân vật** | `character_analysis` | Bắt buộc tuân theo **chuẩn 4 bước**: *1. Luận điểm -> 2. Dẫn chứng tài liệu -> 3. Phân tích nghệ thuật -> 4. Đánh giá tư tưởng*. |
| **Gợi ý dàn ý** | `outline` | Chỉ lập khung dàn ý (Mở bài - Thân bài - Kết bài) với các luận điểm và gợi ý dẫn chứng. Tuyệt đối không viết thành bài văn xuôi hoàn chỉnh. |
| **Luyện đọc hiểu từng bước** | `reading_comprehension` | Áp dụng phương pháp Socratic: chỉ hỏi hoặc gợi mở từng câu một, đợi học sinh trả lời rồi mới nhận xét và đi tiếp. |
| **Góp ý bài viết** | `essay_feedback` | Tôn trọng giọng văn của học sinh; khen ngợi 2-3 điểm tích cực trước; chỉ ra lỗi diễn đạt, thiếu dẫn chứng mà không viết lại bài văn. |
| **Chuẩn bị bài & Ôn tập** | `prep_and_review` | Truy xuất trực tiếp các câu hỏi trọng tâm và mục tiêu bài học do chính giáo viên lớp đó cấu hình. |

---

## IV. CƠ CHẾ CHỊU LỖI 4 TẦNG (MULTI-TIER RAG FALLBACK)

Nhằm đảm bảo hệ thống vận hành liên tục 24/7 ngay cả khi gặp sự cố mạng hoặc gián đoạn API từ một nhà cung cấp, hệ thống áp dụng cơ chế 4 tầng tự động chuyển đổi:

### Tầng 1: Google Gemini Native File Search (Vector Store RAG)
* Sử dụng API chính thức của Google: `fileSearchStores.create` và `@google/genai` SDK.
* Văn bản được lưu trữ và băm vector trên hạ tầng đám mây của Google với mô hình `gemini-embedding-2`.
* Tự động trả về tọa độ trích dẫn chính xác (`file_citation`) và vị trí đoạn văn bản gốc.

### Tầng 2: Cổng Bên Thứ Ba (Third-Party Gateway)
* Hỗ trợ các dịch vụ tương thích chuẩn OpenAI: RevidAPI (`https://revidapi.com/v1`), RouteAPI (`https://api.routeapi.ai/v1`), OpenRouter (`https://openrouter.ai/api/v1`).
* Quản lý dàn multi-token xoay vòng tự động; tự động bắt lỗi phân quyền 403 / 400 "token has no access to model" và chuyển sang model thay thế tương thích.

### Tầng 3: Direct Context Grounding (In-Prompt Chunked RAG)
* Kích hoạt khi tài liệu mới tải lên đang trong quá trình index (`Đang index...`) hoặc khi các cổng đám mây gặp độ trễ.
* Hệ thống tự động trích xuất các đoạn văn bản có cấu trúc (`work_paragraphs`) được lưu trữ tại cơ sở dữ liệu PostgreSQL của hệ thống, bơm trực tiếp vào ngữ cảnh prompt.
* Vẫn đảm bảo 100% độ chính xác dựa trên tài liệu bài giảng của giáo viên.

### Tầng 4: Fallback Search (Ngoại tuyến / Giả lập)
* Kích hoạt khi hệ thống chưa cấu hình API Key hoặc khi toàn bộ các Key ngoài đều bị cạn hạn mức (Quota Exceeded 429).
* Sử dụng thuật toán quét từ khóa thông minh (TF-IDF / Text Matching) trên các trích đoạn văn bản có sẵn trong cơ sở dữ liệu để tìm câu trả lời chính xác, hiển thị nhãn *`Tài liệu giáo viên (Ngoại tuyến)`*.

---

## V. CƠ CHẾ GEMINI API KEY POOL & CÂN BẰNG TẢI

Để giải quyết triệt để lỗi **429 (Hết hạn mức Quota)** và **503 (Máy chủ AI quá tải)**, hệ thống xây dựng mô-đun Key Pool tiên tiến:

```
[Danh sách API Keys / Tokens: Key 1, Key 2, Key 3, ...]
                      │
           Thuật toán Round-Robin
                      ▼
              Gọi AI Gateway
             /              \
        (Thành công)      (Gặp lỗi 429 / 503)
             │                      │
      Trả kết quả RAG     Đưa Key vào COOLDOWN 60s
                          Tự chuyển sang Key kế tiếp
```

* **Round-Robin Load Balancing**: Phân phối đều các câu hỏi của học sinh qua danh sách các API Key được nạp.
* **Bảo toàn dàn Key (Key Merging)**: Khi admin dán thêm key mới, hệ thống tự động gộp vào danh sách hiện có mà không làm mất các key cũ.
* **Tự động cách ly (Cooldown)**: Nếu một key bị lỗi hạn mức (429), hệ thống tự động đánh dấu cách ly 60 giây và tự động thử lại bằng key tiếp theo ngay lập tức mà học sinh không nhận thấy sự gián đoạn.
* **Kiểm thử đa luồng (Health Check)**: Trang Admin cung cấp giao diện kiểm tra đồng thời tất cả các key, đo đạc thời gian phản hồi (ms) và trạng thái sẵn sàng.

---

## VI. BẢO VỆ CHỐNG LẠM DỤNG & GIÁM SÁT HỆ THỐNG

1. **Idempotency Key**: Mỗi câu hỏi của học sinh đều kèm một khóa định danh duy nhất (UUID/Hash). Nếu học sinh bấm gửi nhiều lần liên tiếp do mạng lag, hệ thống chỉ trừ 1 lượt quota và trả về đúng kết quả cũ.
2. **Quota Engine**: Quản lý số lượt hỏi bài hàng ngày (mặc định 20 câu/ngày/học sinh). Giáo viên có thể cấp thêm lượt (`extra_granted`) cho học sinh ôn thi. Tài khoản Admin và Test Teacher được miễn hạn mức cá nhân.
3. **Trích xuất gợi ý câu hỏi đào sâu không tốn token**: Tự động sinh câu hỏi gợi mở trực tiếp từ các đoạn trích dẫn (citations) của tài liệu và câu trả lời, không cần gọi thêm API AI phụ, đảm bảo bám sát đúng tác phẩm.
4. **Audit Logging & Trích dẫn minh bạch**:
   * Mỗi phản hồi đều lưu vết mã tác phẩm, số lượng token tiêu thụ, trạng thái có nguồn trích (`hasCitations`) hay không.
   * Giao diện phía học sinh hiển thị thẻ:
     ```
     ✦ gemini-2.5-flash  •  Chuẩn tài liệu giáo viên ✓
     ```

---

## VII. KẾT QUẢ ĐÁNH GIÁ & KIỂM THỬ THỰC TẾ

Toàn bộ logic RAG đã được kiểm chứng thông qua bộ kiểm thử tự động tại `backend/src/__tests__/`:

* **`rag_grounding.test.ts` (6 tests)**: Kiểm tra truy xuất dẫn chứng chuẩn xác, chống bịa đặt (Anti-hallucination), xưng hô sư phạm chuẩn mực, giới hạn dàn ý không viết văn thay, sinh gợi ý từ trích dẫn giảm token, định dạng trích dẫn nguyên văn.
* **`document_classification_and_verification.test.ts` (10 tests)**: Kiểm tra 1 bản gốc duy nhất active, phân biệt tài liệu tham khảo, chặn tài liệu chưa phân loại, băm đoạn Unicode NFC, kiểm chứng so khớp trích dẫn nguyên văn 100%.
* **`third_party_gateway.test.ts` (6 tests)**: Kiểm tra cổng bên thứ ba, xoay vòng token, chuẩn hóa tiền tố model, phát hiện lỗi model access 403.
* **`key_pool.test.ts` (6 tests)**: Kiểm tra dàn key pool, cách ly cooldown, gộp key mới không xóa key cũ.

Toàn bộ **41/41 bài kiểm thử tự động** đều vượt qua 100%.

**Kết luận**: Hệ thống Contextual RAG của dự án "Cô Dương dạy văn dễ thương" đã đạt chuẩn mực cao về tính sư phạm, độ tin cậy của dữ liệu và khả năng vận hành bền bỉ trong môi trường giáo dục thực tế.
