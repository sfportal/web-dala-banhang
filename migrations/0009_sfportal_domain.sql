-- Tên miền workers.dev đổi từ minhducuy sang sfportal: cập nhật địa chỉ Thu-Chi đã lưu
UPDATE settings SET value = replace(value, 'minhducuy.workers.dev', 'sfportal.workers.dev') WHERE key = 'payment';
