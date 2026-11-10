// Nội dung tĩnh bám theo kế hoạch: chân dung khách hàng, hành trình QR, câu hỏi thường gặp
export const PERSONAS = [
  { id: 'van-phong', ico: '💼', label: 'Dân văn phòng', who: 'Minh, 26 tuổi · Hà Nội', quote: 'Đói giữa giờ mà không muốn ăn bánh kẹo.',
    needs: ['Ăn vặt ít đường, no lâu, tiện mang', 'Gói nhỏ để thử trước', 'Mua nhanh qua TikTok Shop, Shopee'] },
  { id: 'me-be', ico: '👩‍👧', label: 'Mẹ bỉm sữa', who: 'Chị Lan, 32 tuổi · TP.HCM', quote: 'Đồ ăn vặt cho con phải biết rõ trồng ở đâu.',
    needs: ['Không đường thêm, không phẩm màu', 'Quét QR thấy vườn và phiếu kiểm nghiệm', 'Cả nhà cùng ăn được'] },
  { id: 'duong-huyet', ico: '🌿', label: 'Lo đường huyết', who: 'Cô Hạnh, 56 tuổi · Buôn Ma Thuột', quote: 'Bác sĩ dặn bớt tinh bột, mà ăn gì cho no?',
    needs: ['Thay một phần tinh bột trong bữa', 'Không đường, thành phần ngắn', 'Con cái mua hộ được online'] },
  { id: 'qua-tang', ico: '🎁', label: 'Mua quà biếu', who: 'Anh Tuấn, 40 tuổi · Đà Nẵng', quote: 'Quà phải có câu chuyện, không đụng hàng.',
    needs: ['Hộp đẹp, câu chuyện vùng trồng', 'Xuất hoá đơn, in thiệp doanh nghiệp', 'Giao tận nơi trước Tết'] },
  { id: 'quan-tra', ico: '🧋', label: 'Chủ quán trà', who: 'Quán trà, cà phê · Tây Nguyên, Nam Trung Bộ', quote: 'Cần vị chanh leo đều tay mỗi ly, giá ổn định.',
    needs: ['Cốt 100% không đường, quán tự cân vị', 'Giá sỉ theo thùng, giao gần', 'Hồ sơ nguồn gốc cho chuỗi'] },
];

export const JOURNEY = [
  { ico: '🌱', title: 'Vườn Tây Nguyên', text: 'Mã số vùng trồng, nhật ký canh tác ghi trên FarmBase ngay từ lúc thu mua.' },
  { ico: '🧪', title: 'Kiểm nghiệm lô', text: 'Lấy mẫu từng lô: dư lượng thuốc, kim loại nặng, hàm lượng tinh bột kháng.' },
  { ico: '🏭', title: 'Nhà máy chế biến', text: 'Sấy thăng hoa, sấy dẻo, ép cốt trên dây chuyền đạt chuẩn an toàn thực phẩm.' },
  { ico: '📦', title: 'Đóng gói có QR', text: 'Mỗi gói in QR lô hàng ở mặt trước, không giấu sau bao bì.' },
  { ico: '📱', title: 'Bạn quét, thấy vườn', text: 'Tên vườn, nông dân, ngày thu hái, phiếu kiểm nghiệm và video vườn.' },
];

export const FAQS = [
  ['Sản phẩm DaLa có thêm đường hay chất bảo quản không?', 'Không. Chanh leo sấy thăng hoa, bột chuối xanh, cốt chanh leo và khoai lang sấy dẻo đều không thêm đường, không chất bảo quản. Thành phần ghi rõ trên nhãn và trang sản phẩm.'],
  ['Quét QR trên bao bì sẽ thấy gì?', 'Mã QR ở mặt trước mỗi gói dẫn tới trang lô hàng: vườn trồng, nông hộ, ngày thu hái, ngày chế biến, hạn dùng và tóm tắt phiếu kiểm nghiệm. Bạn cũng có thể nhập mã lô ở trang Quét QR.'],
  ['Tôi có thể thanh toán bằng cách nào?', 'Hai cách: chuyển khoản qua mã VietQR (hệ thống tự xác nhận trong vài giây khi tiền về) hoặc trả tiền mặt khi nhận hàng (COD).'],
  ['Phí giao hàng tính thế nào?', 'Phí được tính tự động theo địa chỉ, khối lượng và kích thước kiện hàng qua các hãng vận chuyển trên Goship. Đơn có hàng dễ vỡ (chai cốt, hộp quà, trái tươi) được đóng gói chống sốc. Đơn đạt ngưỡng sẽ được miễn phí giao hàng.'],
  ['Khoai lang sấy dẻo sao không mua riêng được?', 'Khoai lang sấy dẻo là món bán kèm: bạn thêm vào bất kỳ đơn nào hoặc chọn combo để có giá tốt nhất.'],
  ['Bột chuối xanh dùng thế nào?', 'Pha 1–2 thìa (khoảng 15g) với nước ấm, sữa hoặc xay cùng sinh tố; có thể thay một phần bột khi làm bánh. Đây là thực phẩm, không thay thế thuốc hay chỉ định của bác sĩ.'],
  ['Làm cộng tác viên DaLa có mất phí không?', 'Không mất phí. Đăng ký xong bạn có ngay link và mã giới thiệu riêng, hoa hồng 15–25% trên đơn trực tiếp, thêm hoa hồng gián tiếp từ đội nhóm bạn tuyển, rút tiền về ngân hàng định kỳ.'],
];

export const LINE_LABEL = { chuoi: 'Bột chuối xanh', chanhleo: 'Chanh leo', khoailang: 'Khoai lang', qua: 'Hộp quà', tuoi: 'Trái tươi', combo: 'Combo' };
