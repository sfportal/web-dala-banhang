-- Mật mã xem tài liệu hệ thống /tai-lieu (lưu dạng băm PBKDF2; đổi trong Admin → Cài đặt → Tài liệu hệ thống)
INSERT OR IGNORE INTO settings (key, value) VALUES ('secret:docs_pass_hash', 'pbkdf2$100000$bf2ca4e2ec148ddb6a1cf946f08d70fa$c8ea918132943777f2b1f43c2b68b5430e9455ae4e68d265ed6c34d8d1537f09');
