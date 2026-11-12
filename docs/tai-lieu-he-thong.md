# Tài liệu hệ thống DaLa: website bán hàng, cộng tác viên và trang quản trị

Tài liệu này mô tả đầy đủ tính năng của website DaLa và trang quản trị, viết để người mới, chatbot hoặc hệ thống bên thứ ba đọc hiểu được cách hệ thống vận hành. Số liệu như giá, tồn kho, mức hoa hồng, phí giao hàng có thể đổi trong trang quản trị; khi cần con số hiện hành, đọc từ API công khai (mục 11) thay vì dùng ví dụ trong tài liệu.

## 1. Tổng quan

- **Thương hiệu**: DaLa, thuộc HTX Nông nghiệp Công nghệ cao DaLa (Buôn Ma Thuột, Đắk Lắk). Khẩu hiệu: "Nắng cao nguyên, quét QR thấy vườn".
- **Sản phẩm**: trái cây Tây Nguyên chế biến lành mạnh, không đường thêm. Các dòng chính: bột chuối xanh (kháng tinh bột), chanh leo sấy thăng hoa, cốt chanh leo nguyên chất, khoai lang sấy dẻo, chanh leo tím tươi, hộp quà và combo.
- **Điểm khác biệt**: mỗi lô hàng có mã QR truy xuất (vườn trồng, ngày chế biến, phiếu kiểm nghiệm).
- **Kênh bán**: website, cộng tác viên (CTV, affiliate 3 tầng), TikTok Shop, Shopee, Zalo, B2B. Mọi đơn đều quản lý tập trung trong trang quản trị.
- **Công nghệ**: Astro 7 (render phía máy chủ) chạy trên Cloudflare Workers, cơ sở dữ liệu Cloudflare D1 (SQLite). Không có máy chủ riêng.
- **Thanh toán**: chuyển khoản VietQR (SePay đối soát tự động) hoặc COD.
- **Giao hàng**: Goship (GHN, GHTK, Viettel Post, J&T, Best Express…), phí tính theo khối lượng, kích thước, hàng dễ vỡ.
- **Xác thực số điện thoại**: OTP qua Zalo ZNS hoặc SMS (eSMS).
- **Tích hợp**: SePay, Goship và eSMS đều đi qua một hệ thống trung gian là **Thu-Chi**; website không kết nối trực tiếp tới các dịch vụ này (mục 9).

## 2. Các trang công khai

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang chủ: hero chuyển động, câu chuyện từng dòng sản phẩm, gợi ý sản phẩm theo chân dung khách (văn phòng, mẹ và bé, kiểm soát đường huyết, quà tặng…), hành trình QR, combo, Flash Sale. |
| `/san-pham` | Danh sách sản phẩm, lọc theo dòng. |
| `/san-pham/{slug}` | Chi tiết sản phẩm: ảnh, giá, giá gạch, lợi ích, cách dùng, thành phần, khối lượng, nhãn, link TikTok Shop/Shopee, sản phẩm gợi ý, dữ liệu có cấu trúc (JSON-LD Product). |
| `/flash-sale` | Chương trình Flash Sale đang chạy, đếm ngược, số suất còn lại. |
| `/thanh-toan` | Thanh toán một trang (mục 3). |
| `/don-hang/{mã}?t={chữ ký}` | Trang theo dõi đơn hàng. Link có chữ ký nên chỉ người có link mới xem được. |
| `/tai-khoan` | Tài khoản khách hàng (mục 4). |
| `/ctv` | Trang cộng tác viên: giới thiệu, đăng ký, bảng điều khiển CTV (mục 5). |
| `/truy-xuat` và `/lo/{mã lô}` | Tra cứu lô hàng bằng mã QR: vườn, ngày thu hoạch, ngày chế biến, kiểm nghiệm. Mỗi lượt quét được ghi nhận vào analytics. |
| `/cau-chuyen` | Câu chuyện thương hiệu. |
| `/blog`, `/blog/{slug}` | Bài viết. |
| `/chinh-sach` | Chính sách giao hàng, đổi trả, thanh toán, cộng tác viên, bảo mật. Nội dung CTV tự cập nhật theo cài đặt. |
| `/lien-he` | Form liên hệ. Mỗi lần gửi tạo một phiếu hỗ trợ trong quản trị; chủ đề khiếu nại và đổi trả được ưu tiên cao. |
| `/sitemap.xml`, `/robots.txt` | SEO. |

Giỏ hàng là ngăn trượt dùng chung trên mọi trang, lưu trong trình duyệt. Link giới thiệu CTV dạng `?ref={mã CTV}` được ghi nhớ trong cookie (mặc định 30 ngày).

## 3. Mua hàng và thanh toán

### Quy trình đặt hàng
1. Khách thêm sản phẩm vào giỏ (sản phẩm thường, combo, hàng Flash Sale; loại "chỉ bán kèm" chỉ mua được cùng sản phẩm khác).
2. Tại `/thanh-toan`: nhập họ tên, số điện thoại, địa chỉ (tỉnh/thành, quận/huyện, phường/xã lấy từ danh mục Goship), ghi chú. Khách đã đăng nhập được điền sẵn.
3. Hệ thống báo giá trực tiếp: tạm tính, giảm giá Flash Sale, mã giảm giá, giảm giá mã CTV, điểm tích luỹ, phí giao hàng.
4. Khách chọn hãng vận chuyển. Mỗi lựa chọn có phí và **ngày giao dự kiến**.
5. Khách chọn phương thức thanh toán: chuyển khoản QR hoặc COD (COD có giới hạn giá trị đơn, mặc định 3.000.000đ).
6. Đặt hàng: hệ thống trừ kho, giữ suất Flash Sale, trừ điểm đã đổi, tạo mã đơn dạng `DL` + 6 số và chuyển tới trang đơn.

### Giảm giá
- **Flash Sale**: giá riêng theo sản phẩm, giới hạn tổng suất và số lượng tối đa mỗi đơn, có thời gian bắt đầu/kết thúc.
- **Mã giảm giá**: loại phần trăm, số tiền cố định hoặc miễn phí giao hàng; có đơn tối thiểu, mức giảm tối đa, số lượt dùng, chỉ áp dụng đơn đầu, thời hạn. Mã có thể bật "hiện trong tài khoản khách".
- **Mã/link CTV**: khách mua qua CTV được giảm thêm theo cài đặt (mặc định 5%).
- **Điểm tích luỹ**: khách đăng nhập đổi điểm trừ tiền hàng (mục 4).
- **Miễn phí giao hàng** khi tiền hàng đạt ngưỡng (mặc định 300.000đ).

### Thanh toán chuyển khoản (VietQR qua SePay)
- Trang đơn hiển thị mã VietQR với số tiền và nội dung chuyển khoản đúng mã yêu cầu thu.
- Tiền về tài khoản ngân hàng, SePay báo cho hệ thống Thu-Chi; website hỏi trạng thái mỗi 4 giây khi khách đang mở trang đơn và mỗi 5 phút bằng tác vụ định kỳ. Khi đủ tiền, đơn tự chuyển sang "Đã thanh toán" và "Đã xác nhận".
- Hỗ trợ thanh toán thiếu (trạng thái "Thanh toán một phần").
- Đơn chuyển khoản chưa trả sau thời gian giữ chỗ (mặc định 1440 phút) tự huỷ, hoàn kho và hoàn suất Flash Sale.
- Khi chưa kết nối Thu-Chi, website dùng VietQR thủ công theo tài khoản dự phòng và quản trị xác nhận tay.

### Giao hàng và ngày dự kiến
- Phí giao hàng lấy từ Goship theo địa chỉ nhận, khối lượng (cộng khối lượng bao bì), kích thước kiện và cờ hàng dễ vỡ (có phụ phí đóng gói, mặc định 10.000đ). Khi Goship không phản hồi, dùng bảng phí dự phòng theo khối lượng.
- Ngày giao dự kiến = ngày gửi hàng + thời gian giao của hãng. Ngày gửi hàng là hôm nay nếu đặt trước giờ chốt đơn (mặc định 15 giờ, giờ Việt Nam), không gửi Chủ nhật, cộng số ngày chuẩn bị. Nếu hãng không báo thời gian, dùng mặc định 2–4 ngày.
- Ngày dự kiến được lưu vào đơn và hiện ở bước chọn vận chuyển, tóm tắt đơn, trang đơn và tài khoản khách. Quản trị có thể sửa cho từng đơn.

### Trang theo dõi đơn hàng
- Trạng thái đơn, trạng thái thanh toán, mã QR (nếu chưa trả), danh sách hàng, tổng tiền, địa chỉ (số điện thoại được che một phần).
- Hãng vận chuyển, mã vận đơn, link tra cứu, trạng thái mới nhất từ hãng.
- **Lịch sử đơn hàng** dạng dòng thời gian: đặt hàng, thanh toán, xác nhận, bàn giao vận chuyển, các mốc từ Goship (kèm vị trí, ghi chú), hoàn tất, cũng như các cập nhật quản trị gửi cho khách.
- Trạng thái vận đơn tự đồng bộ mỗi 5 phút; khi khách mở trang và lần cập nhật cuối đã quá 10 phút, hệ thống hỏi lại ngay.

### Trạng thái đơn hàng
| Mã | Tên | Ý nghĩa |
|---|---|---|
| `new` | Mới | Vừa đặt, chưa xác nhận. |
| `confirmed` | Đã xác nhận | Đã thanh toán hoặc đã duyệt COD, đang chuẩn bị hàng. |
| `shipping` | Đang giao | Đã bàn giao cho hãng vận chuyển. |
| `completed` | Hoàn tất | Khách đã nhận hàng. Lúc này mới cộng điểm, tạo việc chăm sóc và bắt đầu tính thời gian giữ hoa hồng. |
| `cancelled` | Đã huỷ | Hoàn kho, hoàn suất Flash Sale, hoàn điểm đã đổi, huỷ hoa hồng. |
| `returned` | Hoàn hàng | Thu hồi điểm đã cộng, huỷ hoa hồng. |

Trạng thái thanh toán: chưa thanh toán, thanh toán một phần, đã thanh toán, đã hoàn tiền. Phương thức: chuyển khoản QR (SePay), COD, chuyển khoản thủ công, sàn thu hộ.

## 4. Tài khoản khách hàng (`/tai-khoan`)

- Đặt hàng không bắt buộc đăng nhập.
- Đăng ký bằng số điện thoại và mật khẩu. Có thể bắt buộc xác thực số điện thoại bằng OTP (bật trong quản trị).
- Tạo tài khoản bằng số điện thoại đã từng mua sẽ thấy lại các đơn cũ cùng số. Số chưa xác thực OTP chỉ xem tóm tắt đơn, ẩn địa chỉ.
- Quên mật khẩu: đặt lại bằng mã OTP.
- Trang tài khoản gồm: danh sách đơn kèm ngày giao dự kiến và lịch sử từng đơn, hồ sơ và địa chỉ, điểm tích luỹ và lịch sử điểm, mục Khuyến mãi (mã giảm giá công khai, Flash Sale đang chạy), lối vào đăng ký/bảng điều khiển CTV.

### Điểm tích luỹ
- Tính theo số điện thoại, kể cả khách chưa có tài khoản. Đơn từ TikTok Shop và Shopee không được cộng điểm.
- Cộng khi đơn hoàn tất: mặc định mỗi 10.000đ tiền hàng (sau giảm giá) = 1 điểm. Thu hồi khi đơn hoàn hàng.
- Đổi điểm khi thanh toán (cần đăng nhập): mặc định 1 điểm = 200đ, tối đa 30% tiền hàng, tối thiểu 10 điểm mỗi lần. Điểm bị trừ ngay khi đặt và được hoàn nếu đơn huỷ.
- Quản trị có thể cộng/trừ điểm tay kèm ghi chú.

### Mã OTP
- Kênh: Zalo ZNS (ưu tiên) và SMS brandname, gửi qua eSMS thông qua Thu-Chi.
- Dùng khi: tạo tài khoản, xác thực số điện thoại, quên mật khẩu, đăng ký CTV (tuỳ cài đặt).
- Chống spam: 60 giây giữa hai lần gửi, tối đa 5 mã/giờ mỗi số, 15 mã/giờ mỗi địa chỉ IP; mã hết hạn sau 5 phút; sai 5 lần phải gửi lại.

## 5. Cộng tác viên (affiliate 3 tầng)

### Đăng ký
- Đăng ký từ tài khoản khách hàng. Hồ sơ gồm: họ tên theo CCCD, ngày sinh (đủ 18 tuổi), số CCCD, địa chỉ, ngân hàng và số tài khoản đứng tên mình, mã số thuế cá nhân, xác nhận đã đọc chính sách (lưu phiên bản chính sách và thời điểm đồng ý).
- Có thể bắt buộc OTP khi đăng ký. Hồ sơ được duyệt tự động hoặc chờ quản trị duyệt, tuỳ cài đặt.
- Mỗi CTV có mã giới thiệu và link riêng (`?ref=mã`). Người đăng ký qua link của CTV khác trở thành tuyến dưới của người đó.

### Hoa hồng
- Ba tầng: **trực tiếp** (CTV bán), **gián tiếp 1** (người tuyển CTV đó), **gián tiếp 2** (người tuyển của người tuyển).
- Cơ sở tính: tiền hàng được tính hoa hồng sau khi trừ giảm giá theo tỷ lệ, không tính phí giao hàng.
- Ba hạng tự xét theo doanh số. Mặc định: Thành viên (từ 0đ: 15% / 2% / 1%), Đại sứ (từ 5.000.000đ: 20% / 2% / 1%), Trưởng nhóm (từ 20.000.000đ: 25% / 3% / 1%). Các mức có thể đổi trong quản trị.
- Gắn khách: khách mua qua link/mã CTV được gắn với CTV đó (cookie 30 ngày); khi bật "gắn trọn đời", các đơn sau cùng số điện thoại vẫn tính cho CTV đó.
- **CTV tự mua** (số điện thoại người mua trùng số của CTV): mặc định vẫn có hoa hồng trực tiếp và doanh số xét hạng, nhưng không được cộng giảm giá mã CTV. Quản trị có thể chọn chế độ khác (không tính hoa hồng trực tiếp, hoặc tính như đơn thường kèm giảm giá).
- CTV bị khoá không nhận hoa hồng.

### Ví hoa hồng và rút tiền
- Hoa hồng ở trạng thái "chờ" trong thời gian đổi trả (mặc định 7 ngày sau khi đơn hoàn tất), sau đó tự chuyển sang "khả dụng".
- Đơn huỷ hoặc hoàn hàng thì huỷ hoa hồng.
- CTV gửi yêu cầu rút tiền về ngân hàng, tối thiểu 200.000đ (mặc định), chi trả theo lịch (mặc định ngày 5 và 20 hằng tháng). DaLa khấu trừ thuế thu nhập cá nhân theo quy định trước khi chi trả.
- Số dư rút được = hoa hồng khả dụng trừ các lệnh rút đang chờ, đã duyệt hoặc đã chi.

### Bảng điều khiển CTV (`/ctv`)
- Link và mã giới thiệu, nút sao chép.
- Doanh số, hạng hiện tại và mức cần đạt hạng tiếp theo.
- Ví: chờ, khả dụng, đang rút, đã nhận; lịch sử hoa hồng theo đơn và tầng.
- Đơn hàng từ link của mình (ẩn thông tin nhạy cảm của khách).
- Cây đội nhóm F1/F2.
- Bộ nội dung bán hàng soạn sẵn theo từng sản phẩm.
- Hồ sơ và tài khoản ngân hàng.

## 6. Trang quản trị (`/admin`)

Đăng nhập bằng tài khoản quản trị riêng (không dùng chung tài khoản khách). Ba vai trò:
- **Quản trị** (`admin`): toàn quyền, gồm cài đặt kết nối, khoá API và người dùng.
- **Vận hành** (`ops`): xem và thao tác đơn, sản phẩm, khách, CTV…
- **Chỉ xem** (`viewer`): chỉ xem, không sửa.

### 6.1 Tổng quan
KPI theo khoảng ngày (doanh thu và số đơn so với kỳ trước, giá trị đơn trung bình, đã thu tiền, tỷ lệ chuyển đổi web, khách mới và tỷ lệ mua lại, hoa hồng chờ và phải trả), doanh thu theo ngày, doanh thu theo kênh bán, phễu mua hàng (xem trang → xem sản phẩm → thêm giỏ → bắt đầu thanh toán → đặt hàng), việc cần làm (đơn chờ xác nhận, đơn chờ giao, việc chăm sóc đến hạn, phiếu hỗ trợ mở, yêu cầu rút tiền).

### 6.2 Đơn hàng
- Danh sách lọc theo trạng thái, thanh toán, kênh, khoảng ngày, từ khoá; xuất CSV.
- Kênh: website, CTV, TikTok Shop, Shopee, Zalo, B2B.
- Tạo đơn tay (cho đơn Zalo, điện thoại, B2B) và nhập file CSV đơn từ TikTok Shop/Shopee.
- Chi tiết đơn: hàng, tiền, khách, CTV và hoa hồng, ghi chú nội bộ, nhật ký thay đổi.
- Đổi trạng thái đơn, xác nhận thanh toán tay, ghi nhận hoàn tiền.
- Tạo vận đơn Goship (chọn hãng theo giá), nhập mã vận đơn tay; trạng thái vận đơn tự cập nhật.
- Lịch sử đơn (khách xem được): xem toàn bộ dòng thời gian, thêm cập nhật gửi khách (tiêu đề, chi tiết, công khai hay nội bộ), sửa ngày giao dự kiến.

### 6.3 Sản phẩm và combo
SKU, tên, dòng sản phẩm (bột chuối xanh, chanh leo, khoai lang, hộp quà, trái tươi, combo, khác), loại (bán lẻ, combo, chỉ bán kèm), giá bán, giá gạch, giá sỉ, giá vốn, tồn kho, ảnh, mô tả, câu chuyện, lợi ích, cách dùng, thành phần, nhãn, chân dung khách phù hợp, thành phần combo, link TikTok Shop/Shopee, SEO (tiêu đề, mô tả), khối lượng, kích thước, hàng dễ vỡ, có tính hoa hồng hay không, thứ tự hiển thị, ẩn/hiện.

### 6.4 Flash Sale
Tạo chương trình có thời gian bắt đầu/kết thúc; mỗi sản phẩm có giá sale, tổng suất, giới hạn mỗi đơn; theo dõi số suất đã bán.

### 6.5 Mã giảm giá
Mã, loại (phần trăm, cố định, miễn phí giao hàng), giá trị, đơn tối thiểu, giảm tối đa, giới hạn lượt dùng, chỉ đơn đầu, thời hạn, ghi chú, bật/tắt, hiện trong tài khoản khách; xem số lượt đã dùng.

### 6.6 CRM khách hàng
- Danh sách khách lọc theo nhóm, tỉnh, từ khoá; xuất CSV.
- Nhóm tự động: Tiềm năng (chưa mua), Khách mới, Mua lại (từ 2 đơn), VIP (tổng chi từ 1.000.000đ), VIP cần giữ chân và Có nguy cơ rời bỏ (quá 60 ngày chưa mua).
- Hồ sơ khách: đơn hàng, tổng chi, sản phẩm hay mua, ghi chú, việc chăm sóc, phiếu hỗ trợ, điểm tích luỹ và lịch sử điểm, điều chỉnh điểm.

### 6.7 CSM: chăm sóc khách hàng
- **Việc chăm sóc** tự tạo khi đơn hoàn tất: hỏi thăm trải nghiệm sau 3 ngày (xin đánh giá, hướng dẫn quét QR) và nhắc mua lại theo chu kỳ dùng hết sản phẩm (khoảng 14–35 ngày tuỳ sản phẩm). Có thể tạo việc tay, giao người, đánh dấu xong.
- **Phiếu hỗ trợ**: từ form liên hệ hoặc tạo tay; chủ đề (tư vấn, khiếu nại, đổi trả, B2B, CTV, khác), mức ưu tiên, trạng thái, phản hồi.

### 6.8 Cộng tác viên, hoa hồng, rút tiền
- Danh sách CTV: hạng, doanh số, số F1/F2, trạng thái; xem hồ sơ (CCCD, mã số thuế, ngân hàng, thời điểm đồng ý chính sách); duyệt, khoá, đổi hạng.
- Hoa hồng: lọc theo trạng thái, CTV, tầng.
- Rút tiền: duyệt, từ chối, đánh dấu đã chi; có mã VietQR theo tài khoản CTV để chuyển khoản nhanh.

### 6.9 Lô hàng và QR
Tạo lô (mã lô, sản phẩm, vườn, ngày thu hoạch, ngày chế biến, kiểm nghiệm, ảnh), in mã QR dẫn tới `/lo/{mã}`, xem số lượt quét.

### 6.10 Bài viết và SEO
- Soạn bài blog (tiêu đề, slug, ảnh, nội dung, SEO).
- Chấm điểm SEO toàn site: tiêu đề, mô tả, ảnh, dữ liệu có cấu trúc, gợi ý sửa.

### 6.11 Analytics
Analytics riêng của website (không phụ thuộc Google): lượt xem trang, nguồn truy cập, UTM, thiết bị, trang và sản phẩm được xem nhiều, link CTV mang khách, lượt quét QR, phễu mua hàng. Bot bị loại; dữ liệu giữ 400 ngày.

### 6.12 Cài đặt
- **Kết nối hệ thống Thu-Chi**: địa chỉ Thu-Chi, API key, nút "Lưu & kiểm tra" và bảng trạng thái tích hợp (mục 9).
- **Cửa hàng**: tên, tên pháp lý, khẩu hiệu, hotline, Zalo, email, địa chỉ, mạng xã hội, link TikTok Shop/Shopee/Zalo OA.
- **Thanh toán**: bật/tắt chuyển khoản QR và COD, COD tối đa, thời gian tự huỷ đơn chưa trả, tài khoản ngân hàng dự phòng.
- **Giao hàng**: tài khoản Goship dùng (bên Thu-Chi), địa chỉ lấy hàng, ngưỡng miễn phí giao hàng, phụ phí hàng dễ vỡ, khối lượng bao bì, cách chọn hãng mặc định, bảng phí dự phòng.
- **Ngày giao dự kiến**: giờ chốt đơn, số ngày chuẩn bị, có gửi Chủ nhật không, số ngày mặc định.
- **Cộng tác viên**: các hạng và tỷ lệ hoa hồng 3 tầng, thời gian giữ hoa hồng, rút tối thiểu, lịch chi trả, số ngày cookie, giảm giá cho người mua qua CTV, gắn khách trọn đời, tự duyệt CTV, quy tắc CTV tự mua.
- **Điểm tích luỹ**: bật/tắt, số tiền cho 1 điểm, giá trị 1 điểm, tỷ lệ đổi tối đa, số điểm tối thiểu.
- **Tài khoản và xác thực SĐT**: bắt buộc OTP khi tạo tài khoản khách / khi đăng ký CTV, kênh mặc định, tài khoản eSMS (bên Thu-Chi), gửi thử, nhật ký OTP.
- **SEO và đo lường**: tiêu đề, mô tả, từ khoá mặc định; GA4, Meta Pixel, TikTok Pixel, mã xác minh Google Search Console.
- **Phiên bản và cập nhật**: phiên bản đang chạy, số bản dựng, commit, phiên bản cơ sở dữ liệu, nhật ký cập nhật.
- **Người dùng quản trị**: thêm, đổi vai trò, khoá; đổi mật khẩu.

## 7. Tác vụ tự động (mỗi 5 phút)

1. Hỏi trạng thái thanh toán các đơn chuyển khoản chưa trả trong 48 giờ gần nhất.
2. Huỷ đơn chuyển khoản quá hạn chưa trả, hoàn kho và suất Flash Sale.
3. Chuyển hoa hồng hết thời gian giữ sang khả dụng (chỉ với đơn đã hoàn tất).
4. Đồng bộ trạng thái vận đơn từ Thu-Chi/Goship (lấy các vận đơn thay đổi kể từ lần trước).
5. Dọn phiên đăng nhập hết hạn, xoá dữ liệu analytics cũ hơn 400 ngày.

Ngoài ra: khi đơn hoàn tất thì cộng điểm, tạo việc chăm sóc và xét lại hạng CTV.

## 8. Quy tắc nghiệp vụ quan trọng

- Hoa hồng và điểm chỉ tính trên tiền hàng sau giảm giá, không tính phí giao hàng.
- Điểm đổi được coi như giảm giá, nên hoa hồng tính trên số tiền khách thực trả.
- Mỗi đơn chỉ gắn một CTV, theo thứ tự ưu tiên: mã CTV nhập ở bước thanh toán, rồi link giới thiệu (cookie), rồi CTV đã gắn với số điện thoại khách.
- Đơn sàn (TikTok Shop, Shopee) không cộng điểm và thường không có số điện thoại thật của khách.
- Đổi trả trong 7 ngày nếu lỗi sản xuất, hư hỏng khi vận chuyển hoặc giao sai; trái tươi hỗ trợ trong 48 giờ. Khách quay video khi mở hàng và gửi qua `/lien-he` kèm mã đơn.
- Sản phẩm là thực phẩm, không phải thuốc; không quảng cáo tác dụng chữa bệnh.

## 9. Tích hợp qua hệ thống Thu-Chi

Thu-Chi là hệ thống riêng của DaLa (Cloudflare Worker) quản lý tài khoản ngân hàng SePay, tài khoản Goship và tài khoản eSMS. Website DaLa chỉ giữ **một API key Thu-Chi**; không giữ token Goship hay khoá eSMS.

| Dịch vụ | Website gọi Thu-Chi | Việc làm |
|---|---|---|
| SePay | `/api/v1/payment-requests`, `/api/v1/accounts` | Tạo yêu cầu thu kèm VietQR, hỏi trạng thái thanh toán. |
| Goship | `/api/v1/goship/*` | Danh mục tỉnh/huyện/xã, báo giá, tạo vận đơn, đồng bộ trạng thái vận đơn. |
| eSMS | `/api/v1/otp/send`, `/api/v1/otp/verify` | Gửi và kiểm tra mã OTP qua Zalo/SMS. |
| Trạng thái | `/api/v1/ping`, `/api/v1/status` | Quyền của API key; môi trường (Thật/Sandbox) và tình trạng từng tài khoản. |

API key cần các quyền: tạo yêu cầu thu, Goship, xác minh SĐT. Bảng trạng thái trong quản trị hiển thị từng dịch vụ là Hoạt động hay Lỗi (kèm lý do), môi trường Thật hay Sandbox, lần cuối SePay gửi webhook, tài khoản Goship đã có địa chỉ lấy hàng chưa, kênh Zalo/SMS khả dụng.

## 10. Dữ liệu chính

| Bảng | Nội dung |
|---|---|
| `products` | Sản phẩm, combo, giá, tồn kho, kích thước, SEO. |
| `orders`, `order_items` | Đơn hàng và dòng hàng: khách, địa chỉ, tiền, kênh, CTV, thanh toán, vận đơn, ngày dự kiến. |
| `order_events` | Dòng thời gian của đơn (trạng thái, thanh toán, vận chuyển, ghi chú; công khai hoặc nội bộ). |
| `customers` | Khách theo số điện thoại: tài khoản, điểm, thống kê mua. |
| `points_ledger` | Lịch sử cộng/trừ điểm. |
| `affiliates` | Hồ sơ CTV, mã, tuyến trên, hạng, trạng thái. |
| `commissions`, `withdrawals` | Hoa hồng theo đơn/tầng; yêu cầu rút tiền. |
| `flash_sales`, `flash_sale_items`, `vouchers` | Khuyến mãi. |
| `care_tasks`, `tickets`, `notes` | Chăm sóc khách và hỗ trợ. |
| `lots` | Lô hàng truy xuất QR. |
| `posts` | Bài viết. |
| `events` | Analytics. |
| `otp_codes` | Nhật ký OTP (mã được băm). |
| `settings` | Cài đặt dạng JSON theo nhóm. |
| `admins`, `sessions` | Người dùng quản trị và phiên đăng nhập. |

## 11. API công khai cho hệ thống bên ngoài

Các API dưới đây không cần đăng nhập, trả JSON. Địa chỉ gốc là tên miền website.

| Phương thức và đường dẫn | Mô tả |
|---|---|
| `GET /api/catalog` | Danh mục đang bán: sản phẩm (giá, giá gạch, tồn kho, ảnh, mô tả, lợi ích, cách dùng, link sàn), combo, Flash Sale đang chạy. Nguồn chuẩn cho giá và tồn kho. |
| `POST /api/cart/quote` | Báo giá giỏ hàng: gửi `items` (`sku`, `qty`), tuỳ chọn `voucher`, `ref`, `phone`, địa chỉ `to`; trả tạm tính, các khoản giảm, phí giao hàng và lựa chọn hãng kèm ngày dự kiến. |
| `GET /api/orders/{mã đơn}?t={chữ ký}` | Trạng thái một đơn. Chỉ dùng được với link đơn hợp lệ mà khách nhận khi đặt hàng. |
| `GET /api/lot/{mã lô}` | Thông tin truy xuất của lô hàng. |
| `GET /api/geo/cities`, `/api/geo/districts?city=`, `/api/geo/wards?district=` | Danh mục địa giới hành chính dùng khi nhập địa chỉ. |
| `GET /api/version` | Phiên bản website đang chạy. |

Các API quản trị (`/api/admin/*`), tài khoản khách (`/api/account/*`) và CTV đều cần đăng nhập, không dành cho hệ thống bên ngoài.

## 12. Hướng dẫn cho chatbot trả lời khách

- Lấy giá, tồn kho, Flash Sale từ `GET /api/catalog`; không tự đặt giá.
- Muốn biết phí ship và ngày giao, dùng `POST /api/cart/quote` với địa chỉ của khách, hoặc hướng dẫn khách vào trang thanh toán.
- Không hứa thời gian giao chính xác; nói "dự kiến" theo kết quả báo giá.
- Đơn đã đặt: hướng dẫn khách mở link đơn trong tin nhắn xác nhận, hoặc đăng nhập `/tai-khoan` bằng số điện thoại đã đặt.
- Khiếu nại, đổi trả, hợp tác B2B, đăng ký CTV: dẫn tới `/lien-he` (chọn chủ đề) hoặc `/ctv`.
- Không nói sản phẩm chữa bệnh hay thay thế thuốc.
- Không hỏi hay lưu số CCCD, mã số thuế, mật khẩu, mã OTP của khách trong cuộc trò chuyện.

## 13. Vận hành kỹ thuật

- Mã nguồn trên GitHub; mỗi lần gộp vào nhánh chính, GitHub Actions chạy kiểm thử, áp dụng thay đổi cơ sở dữ liệu và tự deploy lên Cloudflare.
- Phiên bản theo dạng `x.y.z`; mỗi bản có nhật ký cập nhật và bản phát hành trên GitHub.
- Mật khẩu được băm (PBKDF2); khoá API lưu riêng, không trả về giao diện.
