-- Chỉ kết nối Goship và OTP qua web Thu-Chi: bỏ cấu hình kết nối trực tiếp, xoá bộ đệm địa giới cũ (có thể lấy từ Goship Sandbox)
DELETE FROM geo_cache;
UPDATE settings SET value = json_remove(value, '$.provider', '$.goship_env', '$.webhook_key') WHERE key='shipping';
UPDATE settings SET value = json_remove(json_set(value, '$.provider', 'thuchi'), '$.esms') WHERE key='auth';
