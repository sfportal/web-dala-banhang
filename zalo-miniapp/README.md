# DaLa · Zalo Mini App

Giao diện cửa hàng DaLa chạy trong Zalo. Dùng chung máy chủ, sản phẩm, giá, tồn kho, mã giảm giá, CTV và đơn hàng với website (`/api/*` của Worker `dala-shop`). Đơn đặt từ mini app hiện trong Admin với kênh **Zalo**.

Trang có sẵn: cửa hàng (lọc, tìm, Flash Sale), chi tiết sản phẩm (chia sẻ qua Zalo), giỏ hàng, thanh toán (COD hoặc VietQR, phí ship Goship, mã giảm giá/mã CTV), trang đơn (QR, tự xác nhận khi tiền về, lưu QR vào máy, lịch sử giao hàng), danh sách đơn đã đặt trên máy, chat OA và gọi hotline.

## Chạy trên máy (localhost)

Cần Node 20 trở lên.

```bash
cd zalo-miniapp
npm install
cp .env.example .env        # sửa VITE_API_BASE nếu cần
npm run dev                 # mở http://localhost:3000
```

Mặc định mini app gọi website thật `https://dala-shop.sfportal.workers.dev`. Đặt đơn thử khi trỏ vào website thật sẽ tạo đơn thật, nên muốn thử đặt hàng thì chạy kèm máy chủ DaLa trên máy:

```bash
# cửa sổ 1, ở thư mục gốc repo
npm ci && npm run db:migrate:local && npm run build && npx wrangler dev   # http://localhost:8787
# cửa sổ 2
cd zalo-miniapp && VITE_API_BASE=http://localhost:8787 npm run dev
```

Ngoài Zalo, các tính năng riêng của Zalo (lấy tên Zalo, chia sẻ, lưu ảnh, chat OA) không chạy; phần còn lại chạy như trong Zalo. Icon của thanh tiêu đề tải từ máy chủ Zalo nên cần có mạng.

## Chạy trong Zalo và phát hành

1. Đăng ký mini app tại https://mini.zalo.me bằng Zalo Official Account đã xác thực của hợp tác xã, lấy **Mini App ID**.
2. Trong Zalo Mini App Studio (hoặc tiện ích Zalo Mini App cho VS Code), thêm tên miền `dala-shop.sfportal.workers.dev` (và `dala.vn` khi chuyển tên miền) vào danh sách tên miền được phép gọi.
3. `npx zmp login`, rồi `npm start` để xem trên điện thoại (quét QR bằng Zalo).
4. `npm run deploy` để tải bản dựng lên Zalo, chọn bản dùng thử hoặc gửi duyệt. Zalo duyệt xong mới phát hành công khai.

Biến môi trường (`.env`): `VITE_API_BASE` địa chỉ website, `VITE_OA_ID` ID Official Account để hiện nút chat, `VITE_HOTLINE` số hotline.

## Máy chủ

Website mở CORS cho tên miền mini app của Zalo (`h5.zdn.vn`) và `localhost` ở các API: cửa hàng công khai (catalog, báo giá giỏ, đặt hàng, xem đơn cần mã ký, địa chỉ, lô hàng, liên hệ), `/api/zalo/login`, `/api/zalo/location`, một phần `/api/account/*` và `/api/aff/*`. Tài khoản và CTV trong mini app xác thực bằng header `Authorization: Bearer <token>` (token trả về từ `/api/zalo/login`), không dùng cookie. API quản trị không mở. Xem `src/lib/cors.js`.

## Số điện thoại và vị trí Zalo

- Mini app gọi `getPhoneNumber` / `getLocation` để lấy token, gửi kèm `getAccessToken` lên máy chủ. Máy chủ đổi token qua `graph.zalo.me/v2.0/me/info` bằng Secret Key của Zalo App (Admin → Cài đặt → Zalo Mini App, hoặc secret `ZALO_APP_SECRET`). Xem `src/server/zalo.js`.
- Toạ độ được tra tên địa chỉ qua OpenStreetMap (Nominatim). Bản đồ dùng địa giới mới (tỉnh → phường), nên thường chỉ khớp chắc tỉnh/thành; quận/phường khớp được khi tên trùng danh sách Goship.
- Trên trang quản lý mini app của Zalo cần xin quyền "Số điện thoại" và "Vị trí" thì các API trên mới trả token.

## Việc còn lại

- Thanh toán: đang dùng VietQR (SePay) và COD như website. Nếu Zalo yêu cầu dùng cổng thanh toán của Zalo khi duyệt, chuyển sang Checkout SDK (`createOrder` trong `zmp-sdk`).
