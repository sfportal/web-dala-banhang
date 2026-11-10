-- Tài khoản khách hàng bằng số điện thoại, hồ sơ CTV chi tiết, xác thực OTP Zalo/SMS
ALTER TABLE customers ADD COLUMN pass_hash TEXT;
ALTER TABLE customers ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customers ADD COLUMN registered_at TEXT;
ALTER TABLE customers ADD COLUMN last_login TEXT;

ALTER TABLE affiliates ADD COLUMN customer_id INTEGER REFERENCES customers(id);
ALTER TABLE affiliates ADD COLUMN birth_date TEXT;
ALTER TABLE affiliates ADD COLUMN id_number TEXT;          -- số CCCD
ALTER TABLE affiliates ADD COLUMN address TEXT;
ALTER TABLE affiliates ADD COLUMN tax_code TEXT;           -- mã số thuế cá nhân
ALTER TABLE affiliates ADD COLUMN policy_version TEXT;
ALTER TABLE affiliates ADD COLUMN policy_agreed_at TEXT;
ALTER TABLE affiliates ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_aff_customer ON affiliates(customer_id);

-- Gắn CTV cũ với hồ sơ khách cùng số điện thoại
INSERT OR IGNORE INTO customers (phone, name, email, province, source) SELECT phone, name, email, province, 'ctv' FROM affiliates;
UPDATE affiliates SET customer_id = (SELECT id FROM customers c WHERE c.phone = affiliates.phone) WHERE customer_id IS NULL;

CREATE TABLE otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,                     -- signup | affiliate | reset | test
  code_hash TEXT NOT NULL,
  channel TEXT,                              -- zalo | sms
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'sent',       -- sent | failed | verified | expired
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  expires_at TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_otp_phone ON otp_codes(phone, purpose, created_at);
CREATE INDEX idx_orders_phone ON orders(phone);

INSERT OR IGNORE INTO settings (key, value) VALUES ('auth', '{"otp_signup":false,"otp_affiliate":false,"channel":"zalo_sms","provider":"esms","ttl_minutes":5,"policy_version":"2026-11","esms":{"brandname":"","oa_id":"","zns_template_id":"","sms_template":"{otp} la ma xac thuc tai khoan DaLa cua ban. Ma co hieu luc {ttl} phut.","sandbox":false}}');
