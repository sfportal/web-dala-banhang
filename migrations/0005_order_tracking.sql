-- Lịch sử cập nhật đơn hàng (khách xem được) + ngày giao dự kiến
CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,            -- status | payment | ship | note
  code TEXT,                     -- mã trạng thái (new, shipping, 904…)
  title TEXT NOT NULL,
  detail TEXT,
  location TEXT,
  source TEXT,                   -- web | admin | goship | sepay | system
  public INTEGER NOT NULL DEFAULT 1,
  happened_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_order_events_order ON order_events(order_id, happened_at);

ALTER TABLE orders ADD COLUMN eta_from TEXT;
ALTER TABLE orders ADD COLUMN eta_to TEXT;

-- Dựng lại lịch sử cho đơn cũ từ các mốc đã có
INSERT INTO order_events (order_id, kind, code, title, source, happened_at)
  SELECT id, 'status', 'new', 'Đặt hàng thành công', 'system', created_at FROM orders;
INSERT INTO order_events (order_id, kind, code, title, source, happened_at)
  SELECT id, 'payment', 'paid', 'Đã nhận thanh toán', 'system', paid_at FROM orders WHERE paid_at IS NOT NULL AND payment_method NOT IN ('cod','platform');
INSERT INTO order_events (order_id, kind, code, title, detail, source, happened_at)
  SELECT id, 'ship', ship_status, IFNULL(ship_status_text, 'Đã bàn giao vận chuyển'), tracking_code, 'system', updated_at FROM orders WHERE tracking_code IS NOT NULL AND status NOT IN ('new','confirmed');
INSERT INTO order_events (order_id, kind, code, title, source, happened_at)
  SELECT id, 'status', 'completed', 'Giao hàng thành công', 'system', completed_at FROM orders WHERE completed_at IS NOT NULL;
INSERT INTO order_events (order_id, kind, code, title, source, happened_at)
  SELECT id, 'status', status, CASE status WHEN 'cancelled' THEN 'Đơn đã huỷ' ELSE 'Đơn hoàn về' END, 'system', updated_at FROM orders WHERE status IN ('cancelled','returned');
