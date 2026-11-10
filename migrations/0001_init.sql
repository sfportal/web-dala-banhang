-- DaLa Shop: schema D1 (SQLite)
-- Tiền tệ: số nguyên VNĐ. Thời gian: 'YYYY-MM-DD HH:MM:SS' theo UTC.

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  name TEXT,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'ops',          -- admin | ops | viewer
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,                        -- admin | aff
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subtitle TEXT,
  line TEXT NOT NULL DEFAULT 'khac',          -- chuoi | chanhleo | khoailang | qua | tuoi | combo
  kind TEXT NOT NULL DEFAULT 'retail',        -- main | trial | b2b | retail | addon | seasonal | gift | combo
  price INTEGER NOT NULL,
  compare_price INTEGER,
  wholesale_price INTEGER,
  cost INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  image_bg TEXT,
  short_desc TEXT,
  story TEXT,
  benefits TEXT,                             -- JSON array
  usage TEXT,
  ingredients TEXT,
  weight TEXT,
  badges TEXT,                               -- JSON array
  personas TEXT,                             -- JSON array
  combo_items TEXT,                          -- JSON [{sku, qty}]
  tiktok_url TEXT,
  shopee_url TEXT,
  seo_title TEXT,
  seo_desc TEXT,
  commissionable INTEGER NOT NULL DEFAULT 1,
  weight_g INTEGER NOT NULL DEFAULT 300,     -- khối lượng đã đóng gói (gam)
  length_cm INTEGER NOT NULL DEFAULT 15,
  width_cm INTEGER NOT NULL DEFAULT 10,
  height_cm INTEGER NOT NULL DEFAULT 10,
  fragile INTEGER NOT NULL DEFAULT 0,        -- hàng dễ vỡ: phụ phí đóng gói + ghi chú cho hãng vận chuyển
  sort INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE flash_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE flash_sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sale_price INTEGER NOT NULL,
  quota INTEGER NOT NULL DEFAULT 0,          -- 0 = không giới hạn
  sold INTEGER NOT NULL DEFAULT 0,
  per_order INTEGER NOT NULL DEFAULT 3,
  UNIQUE (sale_id, product_id)
);

CREATE TABLE vouchers (
  code TEXT PRIMARY KEY,
  type TEXT NOT NULL,                        -- pct | fixed | freeship
  value INTEGER NOT NULL DEFAULT 0,
  min_order INTEGER NOT NULL DEFAULT 0,
  max_discount INTEGER,
  usage_limit INTEGER,
  used INTEGER NOT NULL DEFAULT 0,
  first_order_only INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE affiliates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  pass_hash TEXT NOT NULL,
  parent_id INTEGER REFERENCES affiliates(id),
  tier INTEGER NOT NULL DEFAULT 1,
  tier_locked INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',     -- pending | active | blocked
  province TEXT,
  channel_note TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_holder TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);
CREATE INDEX idx_aff_parent ON affiliates(parent_id);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  address TEXT,
  province TEXT,
  persona TEXT,
  tags TEXT,
  note TEXT,
  affiliate_id INTEGER REFERENCES affiliates(id),
  source TEXT,
  orders_count INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  first_order_at TEXT,
  last_order_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'web',       -- web | ctv | tiktok | shopee | zalo | b2b | pos
  external_id TEXT,
  customer_id INTEGER REFERENCES customers(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  province TEXT,
  city_code TEXT, district_code TEXT, ward_code TEXT,
  district TEXT, ward TEXT,
  note TEXT,
  subtotal INTEGER NOT NULL,
  discount INTEGER NOT NULL DEFAULT 0,
  shipping_fee INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  voucher_code TEXT,
  affiliate_id INTEGER REFERENCES affiliates(id),
  ref_source TEXT,                           -- link | code | bound | admin
  payment_method TEXT NOT NULL DEFAULT 'sepay', -- sepay | cod | platform | bank
  payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid | partial | paid | refunded
  payment_code TEXT,
  payment_qr TEXT,
  payment_account TEXT,
  payment_bank TEXT,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  status TEXT NOT NULL DEFAULT 'new',        -- new | confirmed | shipping | completed | cancelled | returned
  shipping_carrier TEXT,
  shipping_service TEXT,
  shipping_rate_id TEXT,
  shipping_expected TEXT,
  shipping_cost INTEGER,                     -- phí thực trả hãng vận chuyển
  shop_pays_ship INTEGER NOT NULL DEFAULT 0,
  parcel_weight INTEGER,
  parcel_dims TEXT,
  fragile INTEGER NOT NULL DEFAULT 0,
  goship_id TEXT,
  tracking_code TEXT,
  tracking_url TEXT,
  ship_status TEXT,
  ship_status_text TEXT,
  completed_at TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  session_id TEXT,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_aff ON orders(affiliate_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE UNIQUE INDEX idx_orders_ext ON orders(channel, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  flash_item_id INTEGER,
  commissionable INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_items_order ON order_items(order_id);

CREATE TABLE commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
  order_id INTEGER NOT NULL REFERENCES orders(id),
  level INTEGER NOT NULL,                    -- 0 trực tiếp | 1 gián tiếp 1 | 2 gián tiếp 2
  tier INTEGER NOT NULL,
  base INTEGER NOT NULL,
  rate REAL NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | available | void
  available_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (order_id, level)
);
CREATE INDEX idx_comm_aff ON commissions(affiliate_id, status);

CREATE TABLE withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',  -- requested | approved | paid | rejected
  bank_name TEXT, bank_account TEXT, bank_holder TEXT,
  note TEXT,
  admin_note TEXT,
  processed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE TABLE lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  product_id INTEGER REFERENCES products(id),
  farm TEXT, farmer TEXT, region TEXT, farm_code TEXT,
  harvest_date TEXT, process_date TEXT, expiry_date TEXT,
  lab_summary TEXT, lab_url TEXT, video_url TEXT, photo_url TEXT,
  note TEXT,
  scans INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  sid TEXT, type TEXT NOT NULL, path TEXT, product_id INTEGER, value INTEGER,
  source TEXT, medium TEXT, campaign TEXT, referrer TEXT, ref TEXT, device TEXT
);
CREATE INDEX idx_events_ts ON events(ts);
CREATE INDEX idx_events_type ON events(type, ts);

CREATE TABLE care_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  order_id INTEGER REFERENCES orders(id),
  type TEXT NOT NULL,                        -- followup | repurchase | review | callback | custom
  title TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',       -- open | done | skipped
  assignee TEXT,
  result TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  done_at TEXT,
  UNIQUE (order_id, type)
);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id),
  name TEXT, phone TEXT, email TEXT,
  topic TEXT NOT NULL DEFAULT 'tu-van',      -- tu-van | khieu-nai | doi-tra | b2b | ctv | khac
  message TEXT NOT NULL,
  order_code TEXT,
  channel TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL DEFAULT 'open',       -- open | processing | resolved
  priority TEXT NOT NULL DEFAULT 'normal',
  assignee TEXT,
  reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  author TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  cover TEXT,
  seo_title TEXT,
  seo_desc TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE geo_cache (key TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));
