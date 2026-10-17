import { query } from './pool.js';
import { runMigrations } from './migrate.js';
import { AuthService } from '../services/auth.service.js';
import { ParagraphService } from '../services/paragraph.service.js';

export async function seedDatabase() {
  await runMigrations();
  console.log('[Seed] Seeding sample data...');

  // 1. Create Admin
  const adminHash = await AuthService.hashPassword('Admin@2026!');
  const adminRes = await query<{ id: string }>(
    `INSERT INTO users (username, role, password_hash, full_name, is_active, must_change_password)
     VALUES ('admin', 'admin', $1, 'Quản trị viên Hệ thống', TRUE, FALSE)
     ON CONFLICT (username) DO UPDATE SET password_hash = $1
     RETURNING id`,
    [adminHash]
  );
  const adminId = adminRes.rows[0].id;

  // 2. Create Teacher "coduong"
  const teacherHash = await AuthService.hashPassword('CoDuong@123');
  const teacherRes = await query<{ id: string }>(
    `INSERT INTO users (username, role, password_hash, full_name, is_active, must_change_password)
     VALUES ('coduong', 'teacher', $1, 'Cô Dương (Giáo viên Ngữ văn)', TRUE, FALSE)
     ON CONFLICT (username) DO UPDATE SET password_hash = $1
     RETURNING id`,
    [teacherHash]
  );
  const teacherId = teacherRes.rows[0].id;

  // 3. Create Test Teacher "giaovientest" (teacher_test, quota exempt)
  const testTeacherHash = await AuthService.hashPassword('TestTeacher@123');
  await query(
    `INSERT INTO users (username, role, is_test_teacher, password_hash, full_name, is_active, must_change_password)
     VALUES ('giaovientest', 'teacher', TRUE, $1, 'Giáo viên Test RAG (Không giới hạn lượt)', TRUE, FALSE)
     ON CONFLICT (username) DO UPDATE SET password_hash = $1, is_test_teacher = TRUE`,
    [testTeacherHash]
  );

  // 4. Create Class "Lớp 9A1"
  const classRes = await query<{ id: string }>(
    `INSERT INTO classes (name, grade, academic_year)
     VALUES ('Lớp 9A1', 9, '2026-2027')
     RETURNING id`
  );
  const classId = classRes.rows[0].id;

  // Assign class to Teacher
  await query(
    `INSERT INTO teacher_assignments (teacher_id, class_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [teacherId, classId]
  );

  // 5. Create Student "HS2026001"
  const studentHash = await AuthService.hashPassword('HocSinh@123');
  const studentUserRes = await query<{ id: string }>(
    `INSERT INTO users (username, role, password_hash, full_name, is_active, must_change_password)
     VALUES ('HS2026001', 'student', $1, 'Nguyễn Văn An', TRUE, FALSE)
     ON CONFLICT (username) DO UPDATE SET password_hash = $1
     RETURNING id`,
    [studentHash]
  );
  const studentUserId = studentUserRes.rows[0].id;

  await query(
    `INSERT INTO students (user_id, student_code, class_id, notes)
     VALUES ($1, 'HS2026001', $2, 'Học sinh chuyên chăm chỉ môn Ngữ văn')
     ON CONFLICT (student_code) DO NOTHING`,
    [studentUserId, classId]
  );

  // 6. Create Work: "Lặng lẽ Sa Pa"
  const workRes = await query<{ id: string }>(
    `INSERT INTO works (title, author, grade, description, created_by)
     VALUES ('Lặng lẽ Sa Pa', 'Nguyễn Thành Long', 9, 'Truyện ngắn ca ngợi những con người lao động thầm lặng cống hiến cho quê hương đất nước trên đỉnh Yên Sơn.', $1)
     RETURNING id`,
    [teacherId]
  );
  const workId = workRes.rows[0].id;

  // Assign Work to Class 9A1
  await query(
    `INSERT INTO class_work_access (class_id, work_id, granted_by)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [classId, workId, teacherId]
  );

  // 7. Create Controlled Sample RAG Document for "Lặng lẽ Sa Pa"
  const sampleDocText = `
TÀI LIỆU HỌC TẬP VÀ PHÂN TÍCH TÁC PHẨM: LẶNG LẼ SA PA
Tác giả: Nguyễn Thành Long | Biên soạn: Cô Dương

1. HOÀN CẢNH SÁNG TÁC VÀ Ý NGHĨA NHAN ĐỀ:
- Truyện ngắn "Lặng lẽ Sa Pa" được viết vào mùa hè năm 1970, trong chuyến đi thực tế Lào Cai của nhà văn.
- Nhan đề đảo từ "Lặng lẽ" lên đầu câu nhấn mạnh vẻ đẹp êm đềm, thơ mộng của thiên nhiên Sa Pa, nhưng đằng sau sự tĩnh lặng ấy là nhịp sống lao động sôi nổi, nhiệt huyết của những con người cống hiến thầm lặng cho Tổ quốc.

2. HÌNH TƯỢNG ANH THANH NIÊN TRÊN ĐỈNH YÊN SƠN:
- Hoàn cảnh sống và làm việc: Sống một mình trên đỉnh Yên Sơn cao 2600m, quanh năm làm bạn với mây mù và cây cỏ. Công việc: đo gió, đo mưa, đo nắng, tính mây, dự báo thời tiết phục vụ sản xuất và chiến đấu.
- Phẩm chất nổi bật:
  + Tinh thần trách nhiệm cao: Luôn lấy ốp đúng giờ dù nửa đêm mưa tuyết, coi công việc là lẽ sống ("Khi ta làm việc, ta với công việc là đôi, sao gọi là một mình được?").
  + Tình yêu đời và sự ngăn nắp: Tự trồng hoa cúc, nuôi gà, đọc sách mở rộng tri thức.
  + Sự hiếu khách và chân thành: Tặng củ tam thất cho vợ bác lái xe, tặng hoa cho cô kỹ sư, tặng giỏ trứng gà cho ông họa sĩ.
  + Đức tính khiêm tốn: Từ chối để ông họa sĩ vẽ mình vì tự thấy những đóng góp của mình còn nhỏ bé so với ông kỹ sư vườn rau hay anh cán bộ nghiên cứu bản đồ sét.

3. CHI TIẾT KIỂM THỬ XÁC THỰC RAG (GROUNDING VERIFICATION):
- Ký hiệu kiểm chứng tài liệu: MÃ-CÔ-DƯƠNG-SAPA-2026.
- Chi tiết đặc biệt trong tài liệu giáo viên: Chiếc máy đo gió của anh thanh niên được bọc bằng túi nỉ nhung màu xanh lá đậm có thêu chữ "Sa Pa 2600m" do chính người chị gái gửi tặng từ hậu phương.

4. CÂU HỎI VÀ ĐỊNH HƯỚNG ÔN TẬP:
- Luận điểm 1: Vẻ đẹp lý tưởng sống cống hiến thầm lặng.
- Luận điểm 2: Vẻ đẹp tâm hồn trong sáng, nếp sống văn minh và sự ấm áp tình người.
`;

  // 7. Seed Primary Original Text Document (Văn bản tác phẩm gốc)
  const primaryDocText = `VĂN BẢN TÁC PHẨM GỐC: LẶNG LẼ SA PA
Tác giả: Nguyễn Thành Long

[Trang 1]
Bác lái xe bóp còi một hồi dài rồi dừng xe lại bên đường. Bác quay lại bảo với ông họa sĩ và cô kĩ sư:
- Tôi sắp giới thiệu với bác một người cô độc nhất thế gian. Thế nào bác cũng thích vẽ hắn.
Chiếc xe dừng lại trước một trạm khí tượng trên đỉnh Yên Sơn cao hai nghìn sáu trăm mét. Một chàng trai tầm hai mươi bảy tuổi, tầm vóc nhỏ bé, nét mặt rạng rỡ từ trong nhà chạy ra.

[Trang 2]
Anh thanh niên niềm nở đón khách và sôi nổi kể về công việc của mình:
- Khi ta làm việc, ta với công việc là đôi, sao gọi là một mình được? Huống chi việc của cháu gắn liền với việc của bao anh em, đồng chí dưới kia. Gian khổ nhất là lần ghi và báo về lúc một giờ sáng. Nửa đêm đang nằm trong chăn, nghe chuông đồng hồ reo, chỉ muốn trùm chăn ngủ tiếp. Nhưng nghĩ đến nhiệm vụ phục vụ sản xuất, phục vụ chiến đấu thì lại vùng dậy xách đèn ra vườn khí tượng.

[Trang 3]
Khi ông họa sĩ ngỏ ý muốn vẽ chân dung anh, anh thanh niên bối rối từ chối và giới thiệu những người khác đáng vẽ hơn:
- Không, bác đừng vẽ cháu! Để cháu giới thiệu với bác những người khác xứng đáng hơn nhiều. Bác hãy vẽ ông kĩ sư ở vườn rau Sa Pa, ngày này qua ngày khác ngồi rình xem con ong thụ phấn cho hoa su hào ra sao để nâng cao năng suất giống. Hay bác hãy vẽ đồng chí cán bộ nghiên cứu bản đồ sét, mười một năm không rời cơ quan, luôn túc trực nửa đêm trèo lên cột thu lôi để tìm quy luật của sét giúp ích cho đất nước.`;

  const primaryDocRes = await query<{ id: string }>(
    `INSERT INTO documents (
       work_id, title, doc_type, document_role, reference_type, is_active, ocr_status,
       file_name, file_search_store_name, file_size_bytes, mime_type, status, version, raw_content, created_by
     )
     VALUES (
       $1, 'Văn bản tác phẩm: Lặng lẽ Sa Pa (Nguyên tác)', 'text_primary', 'primary', null, true, 'none',
       'van_ban_goc_lang_le_sa_pa.txt', 'fileSearchStores/work_lang_le_sa_pa', $2, 'text/plain', 'ready', 1, $3, $4
     )
     RETURNING id`,
    [workId, Buffer.byteLength(primaryDocText), primaryDocText, teacherId]
  );
  const primaryDocId = primaryDocRes.rows[0].id;

  // Extract paragraphs for primary text
  await ParagraphService.extractAndSaveParagraphs({
    documentId: primaryDocId,
    workId,
    version: 1,
    rawText: primaryDocText,
  });

  // Reference Document
  await query(
    `INSERT INTO documents (
       work_id, title, doc_type, document_role, reference_type, is_active, ocr_status,
       file_name, file_search_store_name, file_size_bytes, mime_type, status, version, raw_content, created_by
     )
     VALUES (
       $1, 'Tài liệu hướng dẫn đọc hiểu Lặng lẽ Sa Pa', 'analysis', 'reference', 'analysis', true, 'none',
       'tai_lieu_lang_le_sa_pa.txt', 'fileSearchStores/work_lang_le_sa_pa', $2, 'text/plain', 'ready', 1, $3, $4
     )`,
    [workId, Buffer.byteLength(sampleDocText), sampleDocText, teacherId]
  );

  // 8. Learning Settings
  await query(
    `INSERT INTO learning_settings (class_id, work_id, prep_questions, review_questions, learning_goals)
     VALUES ($1, $2,
      '["Tìm những chi tiết miêu tả hoàn cảnh sống của anh thanh niên trên đỉnh Yên Sơn?", "Tại sao anh thanh niên lại nói ta với công việc là đôi?"]',
      '["Phân tích ý nghĩa nhan đề Lặng lẽ Sa Pa?", "Nêu cảm nhận của em về sự khiêm tốn của nhân vật anh thanh niên?"]',
      'Hiểu được vẻ đẹp người lao động mới trong công cuộc xây dựng chủ nghĩa xã hội ở miền Bắc.')
     ON CONFLICT (class_id, work_id) DO NOTHING`,
    [classId, workId]
  );

  console.log('[Seed] Database seeded successfully!');
  console.log('--- TÀI KHOẢN MẪU KHỞI TẠO ---');
  console.log('1. Quản trị viên: admin / Admin@2026!');
  console.log('2. Giáo viên: coduong / CoDuong@123');
  console.log('3. Giáo viên test: giaovientest / TestTeacher@123 (Miễn hạn mức)');
  console.log('4. Học sinh: HS2026001 / HocSinh@123 (Lớp 9A1, hạn mức 20 lượt)');
}

if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
