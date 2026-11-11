# DaLa · Website bán hàng, cộng tác viên và quản trị

Website bán lẻ cho DaLa ("Nắng cao nguyên, quét QR thấy vườn"), xây theo kế hoạch bán lẻ nội địa 2027–2029.

- **Công nghệ**: Astro 7 (SSR) chạy trên Cloudflare Workers, cơ sở dữ liệu Cloudflare D1.
- **Thanh toán**: chuyển khoản VietQR qua SePay (hệ thống Thu-Chi) hoặc trả tiền khi nhận hàng (COD).
- **Phí giao hàng**: tính theo Goship, có xét khối lượng, kích thước và hàng dễ vỡ.

## Tính năng

**Cửa hàng**
- Trang chủ có motion: hero chuyển động, câu chuyện từng dòng sản phẩm, gợi ý theo chân dung khách, hành trình QR.
- Combo và hộp quà.
- Flash sale có đếm ngược, giới hạn suất và giới hạn mỗi đơn.
- Giỏ hàng trượt, thanh toán một trang, trang đơn hàng tự xác nhận khi tiền về.
- Tra cứu lô hàng QR, blog.
- SEO: JSON-LD, sitemap, Open Graph.

**Tài khoản khách hàng (`/tai-khoan`)**
- Đặt hàng không cần đăng nhập. Khách tạo tài khoản bằng số điện thoại và mật khẩu.
- Tạo tài khoản bằng số đã từng mua sẽ thấy lại các đơn cũ cùng số. Chưa xác thực SĐT thì chỉ xem tóm tắt đơn (ẩn địa chỉ).
- Quên mật khẩu bằng mã OTP; trang thanh toán tự điền thông tin khi đã đăng nhập.
- Điểm tích luỹ theo SĐT: cộng khi đơn hoàn tất, thu hồi khi hoàn hàng; khách đăng nhập đổi điểm giảm tiền hàng lúc thanh toán (hoàn điểm khi huỷ đơn). Mặc định 10.000đ = 1 điểm, 1 điểm = 200đ, tối đa 30% tiền hàng.
- Mục Khuyến mãi: mã giảm giá đang chạy (bật "Hiện trong tài khoản khách") và Flash Sale.

**Cộng tác viên (`/ctv`)**
- Đăng ký từ tài khoản khách: họ tên theo CCCD, ngày sinh, số CCCD, địa chỉ, ngân hàng, mã số thuế cá nhân, xác nhận đã đọc chính sách (lưu phiên bản và thời điểm đồng ý).
- Có link và mã giới thiệu riêng.
- Hoa hồng 3 tầng: trực tiếp, gián tiếp 1, gián tiếp 2. Ba hạng tự xét theo doanh số.
- Ví hoa hồng: hoa hồng giữ lại trong thời gian đổi trả rồi mới chuyển sang khả dụng. CTV gửi yêu cầu rút tiền về ngân hàng.
- Xem cây đội nhóm F1/F2 và có bộ nội dung bán hàng soạn sẵn.

**Quản trị (`/admin`)**
- Tổng quan: KPI, doanh thu, kênh bán, phễu mua hàng, việc cần làm.
- Đơn hàng đa kênh: website, CTV, TikTok Shop, Shopee, Zalo, B2B. Có thể tạo đơn tay, nhập file CSV từ TikTok/Shopee và xuất CSV.
- Vận đơn Goship.
- Sản phẩm và combo (khối lượng, kích thước, hàng dễ vỡ, link sàn, SEO), flash sale, mã giảm giá.
- CRM: phân nhóm khách, dòng thời gian, ghi chú.
- CSM: việc chăm sóc tự tạo (hỏi thăm sau giao hàng, nhắc mua lại), phiếu hỗ trợ.
- Cộng tác viên, hoa hồng, duyệt rút tiền có VietQR chuyển khoản.
- Lô hàng và QR, bài viết, chấm điểm SEO, analytics riêng (nguồn truy cập, trang, sản phẩm, link CTV, UTM, lượt quét QR).
- Cài đặt và phân quyền người dùng: quản trị, vận hành, chỉ xem.

## Chạy trên máy

```bash
npm ci
cp .dev.vars.example .dev.vars          # đặt ADMIN_PASSWORD, APP_SECRET
npm run db:migrate:local                # tạo bảng + dữ liệu mẫu
npm run build && npx wrangler dev       # http://localhost:8787
npm test                                # kiểm thử hoa hồng, ví, phí giao hàng
```

Vào `/admin` bằng tài khoản `admin` với mật khẩu là `ADMIN_PASSWORD`. Nếu chưa đặt biến này, mật khẩu là `dala12345`, nên đổi ngay sau khi đăng nhập.

## Triển khai (CI/CD)

Repo có sẵn hai quy trình GitHub Actions:

- **CI** (`.github/workflows/ci.yml`) chạy ở mỗi PR và mỗi lần push nhánh: chạy test, build, rồi thử migration trên một D1 trống.
- **Deploy** (`.github/workflows/deploy.yml`) chạy khi merge vào `main`: chạy test, áp migration D1 lên bản thật, build, deploy Worker và cập nhật secret.

### Cài đặt một lần

Cơ sở dữ liệu D1 `dala-shop` đã được tạo, ID của nó đã ghi sẵn trong `wrangler.jsonc`.

1. Tạo Cloudflare API token theo mẫu "Edit Cloudflare Workers" và thêm quyền **D1 Edit**.
2. Trong GitHub, vào **Settings → Secrets and variables → Actions** và thêm 2 secret: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
3. Chạy lại workflow **Deploy**, hoặc merge vào `main`.

Các mục không bắt buộc:
- Secret `ADMIN_PASSWORD` để tạo tài khoản `admin` lần đầu.
- Secret `APP_SECRET`. Nếu không đặt, hệ thống tự sinh và lưu trong D1.
- Biến `SITE_URL` cho tên miền riêng.

### Kết nối thanh toán và giao hàng (trong trang quản trị)

**SePay qua hệ thống Thu-Chi**
1. Trong Thu-Chi, vào **Cài đặt → API keys** và tạo key có quyền ghi.
2. Trong DaLa, vào **Quản trị → Cài đặt → Thanh toán**: nhập địa chỉ Thu-Chi và API key, rồi bấm "Lưu & kiểm tra".
3. Khách quét mã VietQR. SePay báo tiền về cho Thu-Chi, DaLa đối soát mỗi 4 giây trên trang đơn và mỗi 5 phút bằng cron, rồi tự xác nhận đơn và tạo hoa hồng.

**Goship**
1. Trong **Cài đặt → Giao hàng**, đăng nhập bằng tài khoản Goship kèm `client_id`/`client_secret`, hoặc dán access token.
2. Chọn địa chỉ lấy hàng.
3. Khai báo webhook `https://<tên-miền>/api/goship/webhook` trên Goship để cập nhật trạng thái vận đơn.

Khi chưa kết nối Goship, website dùng bảng phí dự phòng theo khối lượng. Bảng này có phụ phí hàng dễ vỡ và giảm phí cho các tỉnh gần kho.

### Xác thực số điện thoại (OTP Zalo/SMS)

Dùng [eSMS.vn](https://esms.vn): một tài khoản gửi được cả Zalo ZNS và SMS brandname.
1. Đăng ký eSMS, khai báo brandname SMS và mẫu tin OTP; kết nối Zalo OA và duyệt mẫu ZNS OTP (1 tham số là mã).
2. Trong **Cài đặt → Tài khoản & xác thực SĐT**: nhập ApiKey, SecretKey, brandname, OA ID, mã mẫu ZNS, nội dung SMS, rồi bấm "Lưu & gửi thử".
3. Bật công tắc "Bắt buộc OTP khi tạo tài khoản khách" và/hoặc "khi đăng ký CTV". Kênh mặc định: gửi Zalo trước, eSMS từ chối thì gửi SMS.

Giới hạn chống spam: 60 giây giữa hai lần gửi, 5 mã/giờ mỗi số, 15 mã/giờ mỗi IP, mã hết hạn sau 5 phút, sai 5 lần phải gửi lại. Khi chạy trên máy (`localhost`) có thể đặt `provider` của cài đặt `auth` là `test` để nhận mã ngay trong phản hồi.

### Pixel và Search Console

Vào **Cài đặt → SEO & đo lường** để nhập GA4, Meta Pixel, TikTok Pixel và mã xác minh Google Search Console.

### Phiên bản và nhật ký cập nhật
- Phiên bản nằm ở `version` trong `package.json`, nhật ký ở `CHANGELOG.md`. Tính năng mới tăng số giữa, sửa lỗi tăng số cuối.
- Mỗi PR tăng phiên bản phải thêm mục `## x.y.z – ngày` vào `CHANGELOG.md` (CI kiểm tra).
- Khi gộp vào `main`, workflow Deploy tự tạo bản phát hành `vx.y.z` trên GitHub nếu chưa có. Mỗi lần deploy có số bản dựng riêng.
- Admin → Cài đặt → Phiên bản & cập nhật hiện bản đang chạy, commit, migration mới nhất và nhật ký. `GET /api/version` trả phiên bản cho công cụ giám sát.
- Quay lại bản trước: Cloudflare Dashboard → Workers → dala-shop → Deployments → Rollback. Thao tác này chỉ đổi mã nguồn, không hoàn tác migration cơ sở dữ liệu.

## Quy tắc nghiệp vụ chính

- **Doanh số tính hoa hồng**: tiền hàng sau khi trừ giảm giá theo tỷ lệ, không tính phí ship. Món nào tắt "Tính hoa hồng" sẽ bị loại.
- **Ghi nhận CTV cho đơn**, theo thứ tự ưu tiên:
  1. Mã CTV nhập lúc thanh toán (khách được giảm %).
  2. Link `?ref=` (lưu 30 ngày).
  3. Khách đã gắn với CTV từ trước (gắn trọn đời).
- **Vòng đời hoa hồng**:
  - Tạo ở trạng thái *chờ* khi đơn được thanh toán (QR) hoặc khi đặt COD.
  - Khi đơn hoàn tất, sau `hold_days` ngày sẽ chuyển sang *khả dụng*.
  - Huỷ nếu đơn huỷ hoặc hoàn hàng.
- **CTV tự mua** (SĐT người mua trùng SĐT CTV): mặc định tính hoa hồng trực tiếp, không cộng giảm giá mã CTV; đổi trong Cài đặt → Cộng tác viên.
- **Hạng CTV**: xét theo doanh số trực tiếp lấy mức cao hơn giữa tháng này và tháng trước. Quản trị có thể khoá hạng.
- **Flash sale**: phần vượt suất hoặc vượt giới hạn mỗi đơn tính giá thường. Đơn huỷ được trả lại suất và tồn kho.
- **Combo**: tồn kho tính theo thành phần, bán combo sẽ trừ kho thành phần.
- **Khoai lang sấy dẻo**: chỉ bán kèm với sản phẩm khác.
- **Đơn QR chưa thanh toán**: tự huỷ sau `expire_minutes` phút.

Giá, combo đề xuất, dữ liệu lô hàng và bài viết trong `migrations/0002_seed.sql` là **dữ liệu mẫu**, sửa được trong trang quản trị. Sản phẩm là thực phẩm, nội dung không đưa ra công dụng chữa bệnh.

## Cấu trúc

```
src/lib/          commission.js (hoa hồng), catalog.js (giá, flash, giỏ), orders.js (đơn, thanh toán, cron),
                  shipping.js (Goship + dự phòng), payment.js (SePay/Thu-Chi), db.js, util.js, content.js
src/server/api.js API công khai, /api/aff/* (CTV), /api/admin/* (quản trị)
src/pages/        trang cửa hàng (Astro), ctv.astro, admin.astro
public/assets/    css, js (store, checkout, order, ctv, admin), ảnh sản phẩm đã tách nền
migrations/       0001_init.sql (bảng), 0002_seed.sql (dữ liệu khởi tạo, sinh từ scripts/gen-seed.py)
test/             kiểm thử node:test
```
