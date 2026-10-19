import type { Work, LearningMode } from '../types.js';

interface WorkKnowledge {
  aliases: string[];
  qa: string[];
  character_analysis: string[];
  outline: string[];
  reading_comprehension: string[];
  essay_feedback: string[];
  prep_and_review: string[];
}

// Ngân hàng gợi ý chuẩn theo chương trình Ngữ văn
const WORK_KNOWLEDGE_BASE: Record<string, WorkKnowledge> = {
  'lang_le_sa_pa': {
    aliases: ['lặng lẽ sa pa', 'lang le sa pa', 'sa pa'],
    qa: [
      'Ý nghĩa nhan đề "Lặng lẽ Sa Pa" và hoàn cảnh sáng tác năm 1970',
      'Chiếc máy đo gió của anh thanh niên được bọc bằng gì trong tài liệu?',
      'Tại sao anh thanh niên lại nói "Khi ta làm việc, ta với công việc là đôi"?',
      'Chất trữ tình và nét thơ mộng trong truyện ngắn Lặng lẽ Sa Pa',
    ],
    character_analysis: [
      'Phân tích vẻ đẹp nhân vật anh thanh niên qua 4 bước chuẩn',
      'Nêu cảm nhận về đức tính khiêm tốn của anh thanh niên trên đỉnh Yên Sơn',
      'Phân tích nhân vật ông họa sĩ già và cô kỹ sư trẻ',
      'Ý nghĩa của những nhân vật không xuất hiện trực tiếp (bác kỹ sư rau, anh bản đồ sét)',
    ],
    outline: [
      'Gợi ý dàn ý 3 phần phân tích vẻ đẹp lý tưởng sống của anh thanh niên',
      'Dàn ý phân tích bức tranh thiên nhiên Sa Pa và con người lao động mới',
      'Dàn ý bài văn nghị luận xã hội về trách nhiệm cống hiến của tuổi trẻ từ tác phẩm',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu đoạn trích cuộc trò chuyện 30 phút giữa anh thanh niên và ông họa sĩ',
      'Đọc hiểu chi tiết anh thanh niên biếu củ tam thất cho vợ bác lái xe',
    ],
    essay_feedback: [
      'Cô nhận xét giúp em đoạn mở bài phân tích nhân vật anh thanh niên',
      'Góp ý đoạn văn phân tích tinh thần trách nhiệm của anh thanh niên',
    ],
    prep_and_review: [
      'Soạn bài: Tìm các chi tiết miêu tả hoàn cảnh sống và công việc của anh thanh niên',
      'Ôn tập: Các luận điểm trọng tâm khi phân tích tác phẩm Lặng lẽ Sa Pa',
    ],
  },
  'dong_chi': {
    aliases: ['đồng chí', 'dong chi'],
    qa: [
      'Cơ sở hình thành tình đồng chí, đồng đội keo sơn gắn bó',
      'Ý nghĩa hình ảnh biểu tượng "Đầu súng trăng treo" ở cuối bài thơ',
      'Hiện thực gian khổ, thiếu thốn của người lính trong những năm đầu kháng chiến',
      'Ý nghĩa của câu thơ đặc biệt chỉ có hai chữ "Đồng chí!"',
    ],
    character_analysis: [
      'Phân tích vẻ đẹp mộc mạc, giản dị của người lính nông dân trong "Đồng chí"',
      'Phân tích sức mạnh của tình đồng đội giúp người lính vượt qua gian lao',
    ],
    outline: [
      'Gợi ý dàn ý 3 phần phân tích bài thơ "Đồng chí" của Chính Hữu',
      'Dàn ý phân tích 3 câu thơ cuối: bức tranh tráng lệ về tình đồng chí',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu 7 câu thơ đầu: Cơ sở hình thành tình đồng chí',
      'Luyện đọc hiểu khổ thơ tái hiện những gian khó: "Áo anh rách vai, quần tôi có vài mảnh vá"',
    ],
    essay_feedback: [
      'Góp ý đoạn văn cảm nhận về hình ảnh "Đầu súng trăng treo"',
      'Nhận xét giúp em luận điểm về vẻ đẹp người lính thời chống Pháp',
    ],
    prep_and_review: [
      'Soạn bài: Tìm các chi tiết nói về xuất thân và hoàn cảnh người lính',
      'Ôn tập: Khái quát nội dung và đặc sắc nghệ thuật bài thơ Đồng chí',
    ],
  },
  'chiec_luoc_nga': {
    aliases: ['chiếc lược ngà', 'chiec luoc nga'],
    qa: [
      'Ý nghĩa nhan đề "Chiếc lược ngà" và tình huống truyện éo le',
      'Chi tiết vết thẹo trên má ông Sáu có vai trò thắt nút và mở nút thế nào?',
      'Tại sao đến tận lúc chia tay bé Thu mới cất tiếng gọi "Ba... a... a... ba!"?',
      'Tình phụ tử thiêng liêng và bất tử trong hoàn cảnh chiến tranh ác liệt',
    ],
    character_analysis: [
      'Phân tích diễn biến tâm lý và tình cảm của bé Thu dành cho ba',
      'Phân tích tình cảm sâu nặng và nỗi ân hận của ông Sáu đối với con',
      'Nhận xét vẻ đẹp tính cách hồn nhiên nhưng cá tính mạnh mẽ của bé Thu',
    ],
    outline: [
      'Gợi ý dàn ý 4 bước phân tích tình cảm cha con ông Sáu và bé Thu',
      'Dàn ý phân tích nhân vật bé Thu trong truyện ngắn Chiếc lược ngà',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu cảnh chia tay xúc động nghẹn ngào giữa hai cha con',
      'Đọc hiểu chi tiết ông Sáu dồn hết tâm huyết mài từng chiếc răng lược ở chiến khu',
    ],
    essay_feedback: [
      'Nhận xét đoạn văn phân tích tiếng gọi "Ba" nghẹn ngào của bé Thu',
      'Góp ý kết bài mở rộng liên hệ về giá trị hòa bình từ "Chiếc lược ngà"',
    ],
    prep_and_review: [
      'Soạn bài: Diễn biến tâm trạng của bé Thu qua hai giai đoạn trước và khi nhận ba',
      'Ôn tập: Ý nghĩa biểu tượng của kỷ vật chiếc lược ngà',
    ],
  },
  'mua_xuan_nho_nho': {
    aliases: ['mùa xuân nho nhỏ', 'mua xuan nho nho'],
    qa: [
      'Cảm xúc của Thanh Hải trước mùa xuân thiên nhiên đất trời xứ Huế',
      'Ý nghĩa của hình ảnh "mùa xuân nho nhỏ" - một sáng tạo độc đáo của thi nhân',
      'Hoàn cảnh sáng tác đặc biệt trên giường bệnh của nhà thơ Thanh Hải',
      'Ý nghĩa điệp từ "ta làm" và khát vọng dâng hiến thầm lặng cho đời',
    ],
    character_analysis: [
      'Phân tích vẻ đẹp tâm hồn lạc quan, yêu đời và khát vọng cống hiến của tác giả',
      'Phân tích hình tượng con người lao động trong mùa xuân đất nước',
    ],
    outline: [
      'Gợi ý dàn ý 3 phần phân tích trọn vẹn bài thơ Mùa xuân nho nhỏ',
      'Dàn ý phân tích khát vọng hòa nhập và dâng hiến ở hai khổ thơ 4 và 5',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu khổ thơ đầu: Bức tranh mùa xuân thiên nhiên tươi tắn',
      'Luyện đọc hiểu khổ 4 và 5: Lời nguyện ước chân thành, khiêm nhường',
    ],
    essay_feedback: [
      'Góp ý mở bài phân tích quan niệm nhân sinh cao đẹp trong Mùa xuân nho nhỏ',
      'Nhận xét đoạn văn bình giảng hình ảnh "Một nốt trầm xao xuyến"',
    ],
    prep_and_review: [
      'Soạn bài: Mạch cảm xúc của bài thơ được phát triển như thế nào?',
      'Ôn tập: Phân tích nghệ thuật ẩn dụ và nhạc điệu trong bài thơ',
    ],
  },
  'vieng_lang_bac': {
    aliases: ['viếng lăng bác', 'vieng lang bac'],
    qa: [
      'Cảm xúc nghẹn ngào của nhà thơ con miền Nam lần đầu ra thăm lăng Bác',
      'Phân tích nghệ thuật ẩn dụ qua các hình ảnh: mặt trời, tràng hoa, vầng trăng, trời xanh',
      'Ý nghĩa ước nguyện chân thành muốn hóa thân ở khổ thơ cuối cùng',
      'Giọng điệu trang nghiêm, sâu lắng và thành kính của bài thơ',
    ],
    character_analysis: [
      'Cảm nhận về lòng biết ơn vô hạn của nhân dân miền Nam đối với Bác Hồ',
      'Phân tích hình tượng Bác Hồ vĩ đại mà vô cùng gần gũi trong tâm tưởng tác giả',
    ],
    outline: [
      'Dàn ý 3 phần phân tích mạch cảm xúc bài thơ Viếng lăng Bác của Viễn Phương',
      'Dàn ý phân tích khổ thơ thứ hai: "Ngày ngày mặt trời đi qua trên lăng..."',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu hình ảnh hàng tre bát ngát ở khổ đầu và cây tre trung hiếu ở khổ cuối',
      'Đọc hiểu cảm xúc khi đứng trước di hài Bác ở khổ thơ thứ ba',
    ],
    essay_feedback: [
      'Góp ý đoạn văn phân tích nghệ thuật ẩn dụ sóng đôi: mặt trời tự nhiên và mặt trời Bác Hồ',
    ],
    prep_and_review: [
      'Soạn bài: Trình tự chuyến viếng lăng Bác được tái hiện như thế nào?',
      'Ôn tập: Các biện pháp tu từ tiêu biểu trong bài thơ Viếng lăng Bác',
    ],
  },
  'bep_lua': {
    aliases: ['bếp lửa', 'bep lua'],
    qa: [
      'Hình ảnh bếp lửa gắn liền với hình tượng người bà tần tảo, giàu đức hy sinh',
      'Ý nghĩa điệp khúc "lận đận đời bà biết mấy nắng mưa" và ngọn lửa bà nhen',
      'Nỗi nhớ thương và lòng biết ơn của người cháu nơi xứ người hướng về bà',
      'Sự chuyển hóa kỳ diệu từ "bếp lửa" thực tế thành "ngọn lửa" niềm tin',
    ],
    character_analysis: [
      'Phân tích hình tượng người bà giàu đức hy sinh và tình thương cháu bao la',
      'Phân tích tâm hồn hiếu thảo, sâu nặng nghĩa tình của người cháu',
    ],
    outline: [
      'Dàn ý phân tích sự kết hợp giữa tự sự, miêu tả và biểu cảm trong "Bếp lửa"',
      'Dàn ý 4 bước phân tích hình tượng người bà trong bài thơ Bếp lửa',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu khổ thơ đầu: Bếp lửa chờn vờn sương sớm',
      'Luyện đọc hiểu câu thơ triết lý: "Ôi kỳ lạ và thiêng liêng - bếp lửa!"',
    ],
    essay_feedback: [
      'Nhận xét đoạn văn cảm thụ câu thơ: "Nhóm dậy cả tâm tình tuổi nhỏ"',
    ],
    prep_and_review: [
      'Soạn bài: Kỷ niệm những năm tháng tuổi thơ bên bà được kể lại ra sao?',
      'Ôn tập: Ý nghĩa triết lý nhân sinh từ hình tượng ngọn lửa của bà',
    ],
  },
  'anh_trang': {
    aliases: ['ánh trăng', 'anh trang'],
    qa: [
      'Ý nghĩa biểu tượng của hình tượng vầng trăng từ quá khứ đến hiện tại',
      'Nguyên nhân và ý nghĩa của cái "giật mình" thức tỉnh lương tâm ở khổ thơ cuối',
      'Đạo lý "Uống nước nhớ nguồn" và sự ân nghĩa thủy chung được gợi nhắc ra sao?',
      'Sự đối lập giữa ánh đèn điện phố phường và vầng trăng tròn vành vạnh',
    ],
    character_analysis: [
      'Phân tích tâm sự và sự thức tỉnh của nhân vật trữ tình khi đối diện vầng trăng',
    ],
    outline: [
      'Dàn ý 3 phần phân tích bài thơ Ánh trăng của Nguyễn Duy',
      'Dàn ý phân tích khổ thơ cuối: Ánh trăng im phăng phắc như một lời nhắc nhở',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu tình huống mất điện đột ngột và cuộc gặp gỡ bất ngờ với trăng',
    ],
    essay_feedback: [
      'Góp ý đoạn bình luận về cái giật mình đầy trách nhiệm của người lính thời bình',
    ],
    prep_and_review: [
      'Soạn bài: Vầng trăng gắn bó với con người trong những giai đoạn nào?',
      'Ôn tập: Giá trị tư tưởng và bài học làm người từ bài thơ Ánh trăng',
    ],
  },
  'sang_thu': {
    aliases: ['sang thu'],
    qa: [
      'Những tín hiệu giao mùa tinh tế từ hạ sang thu: hương ổi, gió se, sương chùng chình',
      'Sự vận động của không gian: sông dềnh dàng, chim vội vã, đám mây vắt nửa mình',
      'Ý nghĩa triết lý nhân sinh ẩn sau hình ảnh "Sấm cũng bớt bất ngờ / Trên hàng cây đứng tuổi"',
    ],
    character_analysis: [
      'Cảm nhận về tâm hồn nhạy cảm, tinh tế và từng trải của nhà thơ Hữu Thỉnh',
    ],
    outline: [
      'Dàn ý 3 phần cảm nhận bức tranh thiên nhiên lúc sang thu của Hữu Thỉnh',
      'Dàn ý phân tích khổ thơ thứ hai: Phút chuyển giao giữa hai mùa',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu khổ 1: Sự ngỡ ngàng trước những tín hiệu đầu tiên của mùa thu',
    ],
    essay_feedback: [
      'Nhận xét đoạn bình giảng câu thơ: "Có đám mây mùa hạ / Vắt nửa mình sang thu"',
    ],
    prep_and_review: [
      'Soạn bài: Tác giả nhận ra mùa thu bằng những giác quan nào?',
      'Ôn tập: Nét độc đáo của bức tranh mùa thu trong Sang thu so với thơ cổ',
    ],
  },
  'chuyen_nguoi_con_gai_nam_xuong': {
    aliases: ['chuyện người con gái nam xương', 'người con gái nam xương', 'vũ nương'],
    qa: [
      'Phân tích ý nghĩa chi tiết cái bóng trên vách trong bi kịch của Vũ Nương',
      'Giá trị hiện thực và nhân đạo sâu sắc của tác phẩm đối với người phụ nữ xưa',
      'Tính chất bi kịch và ý nghĩa màn hội ngộ kỳ ảo dưới thủy cung',
    ],
    character_analysis: [
      'Phân tích 4 bước vẻ đẹp phẩm chất và số phận bi kịch của nàng Vũ Nương',
      'Phân tích nhân vật Trương Sinh - hiện thân của chế độ nam quyền phong kiến',
    ],
    outline: [
      'Dàn ý 4 bước phân tích hình tượng nhân vật Vũ Nương (Nguyễn Dữ)',
      'Dàn ý nghị luận xã hội về số phận người phụ nữ trong xã hội phong kiến',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu lời thề nguyền thanh minh của Vũ Nương trước bến Hoàng Giang',
    ],
    essay_feedback: [
      'Góp ý đoạn văn phân tích phẩm chất hiếu thảo, thủy chung của Vũ Nương',
    ],
    prep_and_review: [
      'Soạn bài: Những nguyên nhân nào dẫn đến cái chết oan khuất của Vũ Nương?',
      'Ôn tập: Nghệ thuật thắt nút, mở nút và yếu tố kỳ ảo trong tác phẩm',
    ],
  },
  'tay_tien': {
    aliases: ['tây tiến', 'tay tien'],
    qa: [
      'Bức tranh thiên nhiên miền Tây vừa hùng vĩ, dữ dội vừa thơ mộng, trữ tình',
      'Vẻ đẹp hào hoa, bi tráng và lý tưởng xả thân của đoàn binh Tây Tiến',
      'Bút pháp lãng mạn kết hợp cảm hứng bi tráng đặc sắc của Quang Dũng',
      'Nghệ thuật sử dụng từ ngữ Hán Việt và địa danh gợi cảm giác thiêng liêng',
    ],
    character_analysis: [
      'Phân tích hình tượng người lính Tây Tiến qua 4 bước: hào hoa, kiên cường, bi tráng',
      'Phân tích vẻ đẹp tâm hồn lãng mạn nhớ về "dáng kiều thơm" của người lính Hà thành',
    ],
    outline: [
      'Dàn ý 3 phần phân tích bài thơ Tây Tiến của nhà thơ Quang Dũng',
      'Dàn ý phân tích đoạn 3: "Tây Tiến đoàn binh không mọc tóc..."',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu đêm liên hoan rực rỡ sắc màu: "Doanh trại bừng lên hội đuốc hoa"',
      'Đọc hiểu 8 câu thơ mở đầu: Tiếng gọi nỗi nhớ "Tây Tiến ơi!"',
    ],
    essay_feedback: [
      'Góp ý đoạn văn phân tích chất bi tráng: "Chiến trường đi chẳng tiếc đời xanh"',
    ],
    prep_and_review: [
      'Soạn bài: Thiên nhiên Tây Bắc được gợi tả qua những hình ảnh nào?',
      'Ôn tập: So sánh hình tượng người lính Tây Tiến với người lính Đồng chí',
    ],
  },
  'viet_bac': {
    aliases: ['việt bắc', 'viet bac'],
    qa: [
      'Bức tranh tứ bình thiên nhiên và con người lao động bốn mùa ở chiến khu',
      'Nghệ thuật đối đáp mình - ta đậm đà tính dân tộc trong trường ca Việt Bắc',
      'Ý nghĩa của Việt Bắc - cái nôi của cách mạng, nguồn cội ân tình',
    ],
    character_analysis: [
      'Phân tích vẻ đẹp nghĩa tình thủy chung của đồng bào các dân tộc Việt Bắc',
      'Cảm nhận về người cán bộ kháng chiến trong giờ phút chia tay bịn rịn',
    ],
    outline: [
      'Dàn ý phân tích bức tranh tứ bình bốn mùa tuyệt đẹp trong bài thơ Việt Bắc',
      'Dàn ý phân tích tính dân tộc đậm đà trong phong cách thơ Tố Hữu qua Việt Bắc',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu nỗi nhớ thiên nhiên và con người: "Rừng xanh hoa chuối đỏ tươi"',
    ],
    essay_feedback: [
      'Nhận xét đoạn bình luận về cặp đại từ xưng hô "mình - ta" trong ca dao truyền thống',
    ],
    prep_and_review: [
      'Soạn bài: Hoàn cảnh lịch sử ra đời đặc biệt của bài thơ Việt Bắc năm 1954',
      'Ôn tập: Khái quát những giá trị nội dung và nghệ thuật của bài thơ Việt Bắc',
    ],
  },
  'vo_chong_a_phu': {
    aliases: ['vợ chồng a phủ', 'vo chong a phu', 'mị', 'a phủ'],
    qa: [
      'Sức sống tiềm tàng và khát vọng tự do mãnh liệt của Mị trong đêm tình mùa xuân',
      'Diễn biến tâm trạng và hành động cởi trói cứu A Phủ của Mị trong đêm đông',
      'Giá trị nhân đạo sâu sắc và cái nhìn thấu hiểu đồng cảm của nhà văn Tô Hoài',
      'Tội ác áp bức bóc lột bằng thần quyền và cường quyền của nhà thống lý Pá Tra',
    ],
    character_analysis: [
      'Phân tích 4 bước sức sống tiềm tàng của nhân vật Mị trong đêm tình mùa xuân',
      'Phân tích hành động cởi trói cứu A Phủ và tự giải phóng cuộc đời mình của Mị',
      'Phân tích nhân vật A Phủ: tính cách gan góc, yêu tự do, khát khao sống',
    ],
    outline: [
      'Dàn ý phân tích nhân vật Mị từ kiếp nô lệ đến con đường tự giải phóng',
      'Dàn ý phân tích diễn biến tâm lý Mị trong đêm mùa đông cởi trói cho A Phủ',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu chi tiết tiếng sáo gọi bạn tình tác động đến tâm hồn Mị',
      'Đọc hiểu chi tiết giọt nước mắt lăn trên má A Phủ đánh thức lòng trắc ẩn của Mị',
    ],
    essay_feedback: [
      'Nhận xét đoạn văn phân tích hành động Mị "lấy nắm lá ngón định ăn cho chết"',
    ],
    prep_and_review: [
      'Soạn bài: Hoàn cảnh xuất thân và số phận làm dâu gạt nợ của Mị',
      'Ôn tập: Giá trị hiện thực và giá trị nhân đạo của tác phẩm Vợ chồng A Phủ',
    ],
  },
  'vo_nhat': {
    aliases: ['vợ nhặt', 'vo nhat', 'tràng', 'bà cụ tứ'],
    qa: [
      'Tình huống truyện độc đáo, éo le: "nhặt" được vợ giữa nạn đói khủng khiếp năm 1945',
      'Vẻ đẹp tình mẫu tử bao la và niềm tin vào tương lai của bà cụ Tứ',
      'Ý nghĩa chi tiết nồi cháo cám (chè khoán) và hình ảnh lá cờ đỏ sao vàng ở cuối truyện',
      'Sự thay đổi kỳ diệu trong tâm lý nhân vật Tràng sau buổi sáng có vợ',
    ],
    character_analysis: [
      'Phân tích nhân vật bà cụ Tứ qua 4 bước: tấm lòng người mẹ thương con nghẹn ngào',
      'Phân tích nhân vật Tràng: người lao động nghèo giàu tình thương và trách nhiệm',
      'Phân tích nhân vật người vợ nhặt: từ chao chát đến người phụ nữ hiền hậu, đúng mực',
    ],
    outline: [
      'Dàn ý phân tích tình huống truyện đặc sắc trong tác phẩm "Vợ nhặt" của Kim Lân',
      'Dàn ý 4 bước phân tích diễn biến tâm trạng của bà cụ Tứ khi biết con trai có vợ',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu tâm trạng Tràng khi dắt người vợ nhặt về xóm ngụ cư',
      'Đọc hiểu lời dặn dò đầy hy vọng của bà cụ Tứ dành cho hai con',
    ],
    essay_feedback: [
      'Góp ý đoạn văn cảm thụ câu nói của bà cụ Tứ: "Ai giàu ba họ, ai khó ba đời"',
    ],
    prep_and_review: [
      'Soạn bài: Bối cảnh nạn đói năm 1945 được Kim Lân tái hiện như thế nào?',
      'Ôn tập: Thông điệp nhân văn về tình người và niềm khát khao hạnh phúc trong Vợ nhặt',
    ],
  },
  'chi_pheo': {
    aliases: ['chí phèo', 'chi pheo', 'nam cao', 'bá kiến', 'thị nở', 'làng vũ đại'],
    qa: [
      'Ý nghĩa tiếng chửi của Chí Phèo ở phần mở đầu tác phẩm',
      'Ý nghĩa hình tượng "Bát cháo hành" của Thị Nở và sự thức tỉnh của Chí Phèo',
      'Quá trình tha hóa của Chí Phèo từ nông dân lương thiện thành con quỷ dữ làng Vũ Đại',
      'Bi kịch bị cự tuyệt quyền làm người và cái chết đầy bế tắc của Chí Phèo',
    ],
    character_analysis: [
      'Phân tích nhân vật Chí Phèo qua 4 bước: lương thiện - tha hóa - thức tỉnh - bi kịch',
      'Phân tích nhân vật Bá Kiến - điển hình sắc sảo cho giai cấp thống trị phong kiến',
      'Phân tích nhân vật Thị Nở và vai trò cầu nối tình người đánh thức lương tri Chí Phèo',
      'Nhận xét bi kịch tinh thần và nỗi đau đớn tột cùng khi bị từ chối làm người lương thiện',
    ],
    outline: [
      'Gợi ý dàn ý 3 phần phân tích bi kịch tha hóa và cái chết của Chí Phèo',
      'Dàn ý phân tích giá trị hiện thực và giá trị nhân đạo mới mẻ trong truyện ngắn Chí Phèo',
      'Dàn ý bài văn nghị luận xã hội về khát vọng sống lương thiện từ tác phẩm Chí Phèo',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu đoạn trích tâm trạng Chí Phèo buổi sáng sau đêm gặp Thị Nở',
      'Đọc hiểu câu hỏi day dứt cuối cùng của Chí Phèo: "Ai cho tao lương thiện?"',
      'Luyện đọc hiểu tiếng chửi có thứ tự đặc biệt của Chí Phèo ở phần mở đầu',
    ],
    essay_feedback: [
      'Góp ý đoạn văn phân tích giọt nước mắt và tiếng khóc ăn năn của Chí Phèo',
      'Nhận xét đoạn bình luận về câu hỏi nhức nhối: "Ai cho tao lương thiện?"',
    ],
    prep_and_review: [
      'Soạn bài: Tóm tắt các mốc thời gian và bước ngoặt cuộc đời của nhân vật Chí Phèo',
      'Ôn tập: Đặc sắc nghệ thuật miêu tả tâm lý và ngôn ngữ trần thuật đa thanh của Nam Cao',
    ],
  },
  'song': {
    aliases: ['sóng', 'song', 'xuân quỳnh'],
    qa: [
      'Sự tương đồng và đối chiếu giữa hình tượng "Sóng" và tâm hồn "Em" trong tình yêu',
      'Nỗi nhớ thương da diết vượt qua không gian, thời gian và cả trong tiềm thức (khổ 5)',
      'Khát vọng tình yêu thủy chung, bất tử trước dòng chảy hữu hạn của cuộc đời',
      'Nét độc đáo, nữ tính và chân thành trong thơ tình Xuân Quỳnh',
    ],
    character_analysis: [
      'Phân tích hình tượng nhân vật trữ tình "Em" - người phụ nữ đang yêu nồng nàn',
    ],
    outline: [
      'Dàn ý 3 phần phân tích bài thơ Sóng của Xuân Quỳnh',
      'Dàn ý phân tích khổ 5 và khổ 6: Nỗi nhớ và sự thủy chung son sắt',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu 2 khổ thơ đầu: Các trạng thái đối cực của sóng và tình yêu',
    ],
    essay_feedback: [
      'Góp ý đoạn bình giảng câu thơ: "Lòng em nhớ đến anh / Cả trong mơ còn thức"',
    ],
    prep_and_review: [
      'Soạn bài: Âm điệu của bài thơ có điểm gì tương đồng với nhịp sóng biển?',
      'Ôn tập: Vẻ đẹp truyền thống kết hợp hiện đại của người phụ nữ trong thơ Sóng',
    ],
  },
  'chiec_thuyen_ngoai_xa': {
    aliases: ['chiếc thuyền ngoài xa', 'chiec thuyen ngoai xa'],
    qa: [
      'Hai phát hiện đầy nghịch lý của nghệ sĩ Phùng ở bờ biển miền Trung',
      'Ý nghĩa bức ảnh được chọn trong bộ lịch: chiếc thuyền mờ sương và người đàn bà',
      'Mối quan hệ giữa nghệ thuật và hiện thực cuộc sống theo quan niệm Nguyễn Minh Châu',
      'Ý nghĩa câu chuyện về cuộc đời người đàn bà hàng chài ở tòa án huyện',
    ],
    character_analysis: [
      'Phân tích nhân vật người đàn bà hàng chài qua 4 bước: thấu hiểu lẽ đời và giàu đức hy sinh',
      'Phân tích sự thức tỉnh và chiêm nghiệm của nhân vật nghệ sĩ Phùng',
      'Phân tích nhân vật Đẩu - vị thẩm phán có lòng tốt nhưng còn thiếu cái nhìn thực tế',
    ],
    outline: [
      'Dàn ý phân tích người đàn bà hàng chài - biểu tượng cho sự hy sinh thầm lặng',
      'Dàn ý phân tích thông điệp nghệ thuật gắn liền với đời sống trong tác phẩm',
    ],
    reading_comprehension: [
      'Luyện đọc hiểu lời trần tình của người đàn bà hàng chài ở tòa án huyện',
    ],
    essay_feedback: [
      'Góp ý đoạn văn phân tích chi tiết người đàn bà van xin đừng bắt chị bỏ chồng',
    ],
    prep_and_review: [
      'Soạn bài: Tìm các chi tiết miêu tả vẻ đẹp của chiếc thuyền khi ở ngoài xa',
      'Ôn tập: Bài học về cách nhìn nhận con người và cuộc đời đa diện, nhiều chiều',
    ],
  },
};

/**
 * Tìm kiếm gợi ý định sẵn hoặc tự sinh thông minh cho bất kỳ tác phẩm nào
 */
export function getWorkSuggestions(work?: Work, mode: LearningMode = 'qa'): string[] {
  if (!work) {
    return [
      'Ý nghĩa nhan đề và hoàn cảnh sáng tác tác phẩm',
      'Phân tích hình tượng nhân vật trung tâm qua 4 bước chuẩn',
      'Gợi ý dàn ý 3 phần (Mở - Thân - Kết) phân tích tác phẩm',
      'Những biện pháp nghệ thuật và thông điệp triết lý đặc sắc',
    ];
  }

  const titleLower = (work.title || '').toLowerCase().trim();
  const authorLower = (work.author || '').toLowerCase().trim();

  // 1. Kiểm tra trong kho tri thức chuẩn
  for (const [, data] of Object.entries(WORK_KNOWLEDGE_BASE)) {
    const matched = data.aliases.some(
      alias => titleLower.includes(alias) || alias.includes(titleLower)
    );
    if (matched) {
      const modeSuggestions = data[mode] || [];
      if (modeSuggestions.length > 0) {
        return modeSuggestions;
      }
      // Nếu mode đó ít câu, gom qa và character_analysis
      return [...data.qa.slice(0, 2), ...data.character_analysis.slice(0, 2)];
    }
  }

  // 2. Tự sinh gợi ý thông minh linh hoạt cho TẤT CẢ các tác phẩm tùy chỉnh khác
  const title = work.title;
  const author = work.author ? `của ${work.author}` : '';
  const gradeStr = work.grade ? ` (Lớp ${work.grade})` : '';

  switch (mode) {
    case 'character_analysis':
      return [
        `Phân tích hình tượng nhân vật trung tâm trong tác phẩm "${title}" qua 4 bước`,
        `4 bước phân tích diễn biến tâm lý và hành động của nhân vật chính trong "${title}"`,
        `Đánh giá vẻ đẹp phẩm chất, tính cách nhân vật chính ${author}`,
        `Ý nghĩa biểu tượng và bài học nhân sinh qua số phận nhân vật trong "${title}"`,
      ];

    case 'outline':
      return [
        `Gợi ý dàn ý 3 phần (Mở - Thân - Kết) bài văn phân tích tác phẩm "${title}"${gradeStr}`,
        `Dàn ý phân tích giá trị hiện thực và giá trị nhân đạo sâu sắc của "${title}"`,
        `Dàn ý bài văn nghị luận xã hội liên hệ thực tế từ thông điệp của "${title}"`,
        `Dàn ý phân tích các nét đặc sắc về nghệ thuật và bút pháp ${author}`,
      ];

    case 'reading_comprehension':
      return [
        `Hướng dẫn cô trò luyện đọc hiểu các câu hỏi trọng tâm của "${title}"`,
        `Phân tích các biện pháp tu từ tiêu biểu xuất hiện trong tác phẩm "${title}"`,
        `Ý nghĩa của các chi tiết nghệ thuật đắt giá nhất trong văn bản "${title}"`,
        `Giải thích các từ ngữ, hình ảnh biểu tượng then chốt trong "${title}"`,
      ];

    case 'essay_feedback':
      return [
        `Cô nhận xét giúp em đoạn mở bài phân tích tác phẩm "${title}"`,
        `Góp ý cách triển khai luận điểm và dẫn chứng trong thân bài về "${title}"`,
        `Nhận xét đoạn kết bài mở rộng và nêu cảm nghĩ sâu sắc về "${title}"`,
        `Cách nâng cao chất văn và diễn đạt mượt mà hơn khi viết về "${title}"`,
      ];

    case 'prep_and_review':
      return [
        `Soạn bài: Tìm hiểu hoàn cảnh sáng tác, xuất xứ và thể loại của "${title}"`,
        `Soạn bài: Trả lời hệ thống câu hỏi đọc hiểu văn bản trong sách giáo khoa`,
        `Ôn tập: Tóm tắt 3 luận điểm kiến thức trọng tâm cần nhớ về "${title}"`,
        `Ôn tập: Sơ đồ tư duy kiến thức bài học "${title}" ${author}`,
      ];

    case 'qa':
    default:
      return [
        `Ý nghĩa nhan đề, xuất xứ và hoàn cảnh sáng tác tác phẩm "${title}"`,
        `Phân tích nội dung tư tưởng chủ đạo mà tác giả ${author} gửi gắm qua "${title}"`,
        `Những chi tiết nghệ thuật tiêu biểu và biện pháp tu từ đặc sắc trong "${title}"`,
        `Gợi ý dàn ý 3 phần và các luận điểm trọng tâm khi phân tích "${title}"`,
      ];
  }
}
