-- Điểm tích luỹ theo số điện thoại khách, khuyến mãi hiển thị trong tài khoản
ALTER TABLE customers ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_discount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN points_earned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vouchers ADD COLUMN public INTEGER NOT NULL DEFAULT 1;  -- hiện trong mục Khuyến mãi của khách

CREATE TABLE points_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  type TEXT NOT NULL,                        -- earn | revoke | redeem | refund | adjust
  points INTEGER NOT NULL,                   -- dương: cộng, âm: trừ
  note TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_points_customer ON points_ledger(customer_id, id);

INSERT OR IGNORE INTO settings (key, value) VALUES ('loyalty', '{"enabled":true,"earn_per":10000,"point_value":200,"max_redeem_pct":30,"min_redeem":10}');
