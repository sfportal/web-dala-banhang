# Nhật ký cập nhật

Mỗi lần gộp vào `main`, website tự deploy. Khi tăng `version` trong `package.json` và thêm mục tương ứng ở đây, lần deploy đó tự tạo bản phát hành `v<phiên bản>` trên GitHub.
Quy ước: tính năng mới tăng số giữa (1.4.0 → 1.5.0), sửa lỗi tăng số cuối (1.5.0 → 1.5.1).

## 1.5.0 – 11/11/2026
- Quản lý phiên bản: số phiên bản và bản dựng hiện trong Admin → Cài đặt, kèm nhật ký cập nhật.
- Mỗi lần deploy có phiên bản mới thì tự tạo bản phát hành trên GitHub.
- CI nhắc khi tăng phiên bản mà quên ghi nhật ký.

## 1.4.0 – 11/11/2026
- Lịch sử cập nhật đơn hàng cho khách: đặt hàng, thanh toán, xác nhận, bàn giao, trạng thái từ Goship (kèm vị trí, ghi chú).
- Ngày giao dự kiến ở bước thanh toán, trang đơn và tài khoản; admin chỉnh được giờ chốt đơn và ngày dự kiến của từng đơn.

## 1.3.1 – 11/11/2026
- Sửa lỗi không chọn được tỉnh/thành khi kết nối Goship; tự nhận diện môi trường Sandbox/Thật.

## 1.3.0 – 11/11/2026
- Điểm tích luỹ: tích khi đơn hoàn tất, đổi điểm khi thanh toán.
- Khuyến mãi hiện trong tài khoản khách.
- Quy tắc tính hoa hồng khi CTV tự mua.

## 1.2.1 – 11/11/2026
- Sửa menu header bị xuống dòng.

## 1.2.0 – 11/11/2026
- Tài khoản khách bằng số điện thoại, xem lại đơn cũ cùng SĐT.
- Đăng ký CTV với hồ sơ chi tiết, ngân hàng, MST, xác nhận chính sách.
- Xác thực SĐT qua Zalo/SMS (eSMS), bật tắt trong admin.

## 1.1.1 – 11/11/2026
- Sửa lỗi 404 khi kết nối web Thu-Chi (gọi qua service binding).

## 1.1.0 – 11/11/2026
- Deploy lên Cloudflare: gắn cơ sở dữ liệu D1, tự sinh khoá ký đơn hàng.

## 1.0.0 – 10/11/2026
- Website bán hàng DaLa: sản phẩm, combo, flash sale, voucher, giỏ hàng, thanh toán QR/COD, Goship.
- CTV 3 tầng, quản trị đơn, CRM, chăm sóc khách, lô hàng QR, bài viết, SEO, analytics, CI/CD.
