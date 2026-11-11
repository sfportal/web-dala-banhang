-- Gửi OTP và Goship qua web Thu-Chi: lưu request_id của Thu-Chi cho mỗi lượt OTP
ALTER TABLE otp_codes ADD COLUMN ext_ref TEXT;
-- Chuyển nhà cung cấp OTP mặc định sang Thu-Chi (vẫn chọn lại eSMS trực tiếp được trong admin)
UPDATE settings SET value = json_set(value, '$.provider', 'thuchi') WHERE key='auth' AND json_extract(value, '$.provider') = 'esms';
