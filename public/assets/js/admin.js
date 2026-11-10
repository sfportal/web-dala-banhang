// DaLa · trang quản trị một trang (hash router), gọi /api/admin/*
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
  const num = (n) => Number(n || 0).toLocaleString('vi-VN');
  const toDate = (s) => (s ? new Date(String(s).replace(' ', 'T') + (String(s).length <= 19 ? 'Z' : '')) : null);
  const dt = (s) => { const d = toDate(s); return d && !isNaN(d) ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''; };
  const dd = (s) => { const d = toDate(s); return d && !isNaN(d) ? d.toLocaleDateString('vi-VN') : ''; };
  const localInput = (s) => { const d = toDate(s); if (!d || isNaN(d)) return ''; const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 16); };

  const STATUS = { new: ['Mới', 'b-sun'], confirmed: ['Đã xác nhận', 'b-blue'], shipping: ['Đang giao', 'b-purple'], completed: ['Hoàn tất', 'b-green'], cancelled: ['Đã huỷ', 'b-gray'], returned: ['Hoàn hàng', 'b-red'] };
  const PAY = { unpaid: ['Chưa TT', 'b-gray'], partial: ['TT thiếu', 'b-sun'], paid: ['Đã TT', 'b-green'], refunded: ['Hoàn tiền', 'b-red'] };
  const CHANNEL = { web: 'Website', ctv: 'Cộng tác viên', tiktok: 'TikTok Shop', shopee: 'Shopee', zalo: 'Zalo/Facebook', b2b: 'B2B/Quán', pos: 'Cửa hàng' };
  const PM = { sepay: 'QR SePay', cod: 'COD', platform: 'Sàn thu hộ', bank: 'Chuyển khoản' };
  const badge = (map, k) => `<span class="badge ${map[k]?.[1] || 'b-gray'}">${esc(map[k]?.[0] || k || '')}</span>`;

  let ME = null; let SETTINGS = null; let PRODUCTS = null;

  // ---------- tiện ích
  async function api(path, opts = {}) {
    const r = await fetch('/api/admin' + path, { credentials: 'same-origin', method: opts.method || 'GET', headers: { 'content-type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (r.status === 401 && path !== '/login') { showLogin(); throw new Error('Phiên đăng nhập đã hết'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Có lỗi xảy ra');
    return j;
  }
  function toast(msg, err) {
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3200);
  }
  const fail = (e) => toast(e.message || String(e), true);
  async function act(btn, fn) { if (btn) btn.disabled = true; try { return await fn(); } catch (e) { fail(e); } finally { if (btn) btn.disabled = false; } }
  function download(path, name) { const a = document.createElement('a'); a.href = '/api/admin' + path; a.download = name || ''; document.body.appendChild(a); a.click(); a.remove(); }
  async function products() { if (!PRODUCTS) PRODUCTS = await api('/products'); return PRODUCTS; }

  function table(cols, rows, opts = {}) {
    if (!rows.length) return `<div class="empty">${opts.empty || 'Chưa có dữ liệu'}</div>`;
    return `<div class="tbl-wrap"><table class="t"><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${c.h}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) =>
      `<tr ${opts.click ? `class="click" data-i="${i}"` : ''}>${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.f ? c.f(r) : esc(r[c.k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function bindRows(el, rows, fn) { $$('tr.click', el).forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('button,a,input,select')) return; fn(rows[+tr.dataset.i]); })); }

  // form builder: fields [{k, l, t:'text|number|select|textarea|check|date|datetime|sec', o:[[v,l]], s:span, h:hint}]
  function form(fields, v = {}) {
    return `<div class="form">${fields.map((f) => {
      if (f.t === 'sec') return `<div class="sec">${esc(f.l)}</div>`;
      const val = f.get ? f.get(v) : v[f.k];
      const id = 'f_' + f.k;
      let input;
      if (f.t === 'select') input = `<select id="${id}" name="${f.k}">${f.o.map(([ov, ol]) => `<option value="${esc(ov)}" ${String(val ?? '') === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
      else if (f.t === 'textarea') input = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 3}" ${f.ro ? 'readonly' : ''}>${esc(val ?? '')}</textarea>`;
      else if (f.t === 'check') return `<label class="f s${f.s || 2} chk"><input type="checkbox" name="${f.k}" ${val ? 'checked' : ''} /> ${esc(f.l)}</label>`;
      else if (f.t === 'datetime') input = `<input id="${id}" name="${f.k}" type="datetime-local" value="${esc(localInput(val))}" />`;
      else input = `<input id="${id}" name="${f.k}" type="${f.t || 'text'}" value="${esc(val ?? '')}" ${f.ph ? `placeholder="${esc(f.ph)}"` : ''} ${f.ro ? 'readonly' : ''} ${f.t === 'number' ? 'step="any"' : ''} />`;
      return `<div class="f s${f.s || 6}"><label for="${id}">${esc(f.l)}</label>${input}${f.h ? `<span class="hint">${esc(f.h)}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }
  function readForm(root) {
    const o = {};
    $$('[name]', root).forEach((el) => { if (el.type === 'checkbox') o[el.name] = el.checked; else if (el.type === 'number') o[el.name] = el.value === '' ? '' : Number(el.value); else o[el.name] = el.value; });
    return o;
  }

  // ---------- drawer
  function openDrawer(title, body, actions = '') {
    $('#drawer').innerHTML = `<div class="drawer-h"><h2>${title}</h2>${actions}<button class="x" data-close aria-label="Đóng">×</button></div><div class="drawer-b">${body}</div>`;
    $('#drawerBg').hidden = false; return $('#drawer');
  }
  function closeDrawer() { $('#drawerBg').hidden = true; $('#drawer').innerHTML = ''; }
  $('#drawerBg').addEventListener('click', (e) => { if (e.target.id === 'drawerBg' || e.target.closest('[data-close]')) closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawerBg').hidden) closeDrawer(); });

  // ---------- biểu đồ (một chuỗi, cột, có tooltip)
  function barChart(points, { h = 200, fmt = vnd } = {}) {
    if (!points.length) return '<div class="empty">Chưa có dữ liệu trong khoảng này</div>';
    const W = 720, H = h, pl = 54, pb = 22, pt = 8;
    const max = Math.max(...points.map((p) => p.v), 1);
    const nice = (m) => { const e = Math.pow(10, Math.floor(Math.log10(m))); const f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
    const top = nice(max); const bw = (W - pl) / points.length; const gap = Math.min(6, bw * .25);
    const y = (v) => pt + (H - pt - pb) * (1 - v / top);
    const ticks = [0, .25, .5, .75, 1].map((k) => top * k);
    const short = (v) => (v >= 1e6 ? (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'tr' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : v);
    const every = Math.ceil(points.length / 10);
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Biểu đồ cột">
      <g class="grid">${ticks.map((t) => `<line x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}" />`).join('')}</g>
      <g class="ax">${ticks.map((t) => `<text x="${pl - 6}" y="${y(t) + 3}" text-anchor="end">${short(t)}</text>`).join('')}
      ${points.map((p, i) => (i % every === 0 ? `<text x="${pl + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(p.l)}</text>` : '')).join('')}</g>
      ${points.map((p, i) => { const x = pl + i * bw + gap / 2, w = Math.max(1, bw - gap), yy = y(p.v), hh = Math.max(p.v ? 2 : 0, H - pb - yy);
        return `<g data-tip="${esc(p.t || p.l)}: ${esc(fmt(p.v))}"><rect class="hit" x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pt - pb}" /><rect class="bar" x="${x}" y="${H - pb - hh}" width="${w}" height="${hh}" rx="${Math.min(4, w / 2)}" /></g>`; }).join('')}
    </svg><div class="tip"></div></div>`;
  }
  function bindTips(root) {
    $$('.chart', root).forEach((c) => {
      const tip = $('.tip', c);
      $$('[data-tip]', c).forEach((g) => {
        g.addEventListener('mouseenter', () => { tip.textContent = g.dataset.tip; tip.style.opacity = 1; });
        g.addEventListener('mousemove', (e) => { const r = c.getBoundingClientRect(); tip.style.left = e.clientX - r.left + 'px'; tip.style.top = e.clientY - r.top + 'px'; });
        g.addEventListener('mouseleave', () => (tip.style.opacity = 0));
      });
    });
  }
  function hbars(rows, { fmt = vnd, cls = '' } = {}) {
    if (!rows.length) return '<div class="empty">Chưa có dữ liệu</div>';
    const max = Math.max(...rows.map((r) => r.v), 1);
    return rows.map((r) => `<div class="hbar ${cls}" title="${esc(r.l)}: ${esc(fmt(r.v))}"><span>${esc(r.l)}</span><div class="tr"><i style="width:${(100 * r.v) / max}%"></i></div><span class="v">${esc(fmt(r.v))}${r.x ? ` <span class="muted small">${esc(r.x)}</span>` : ''}</span></div>`).join('');
  }
  const delta = (a, b) => { if (!b) return ''; const p = Math.round(((a - b) / b) * 100); return `<span class="d ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% so với kỳ trước</span>`; };
  function daysSeg(cur) { return `<div class="seg" id="days">${[[7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày']].map(([d, l]) => `<button data-d="${d}" class="${d === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`; }

  // ---------- điều hướng
  const NAV = [
    ['Bán hàng'], ['', '📊', 'Tổng quan'], ['orders', '🧾', 'Đơn hàng', 'new_orders'], ['products', '📦', 'Sản phẩm & combo'], ['flash', '⚡', 'Flash sale'], ['vouchers', '🎟️', 'Mã giảm giá'],
    ['Khách hàng'], ['customers', '👥', 'CRM khách hàng'], ['tasks', '📞', 'Chăm sóc (CSM)', 'tasks_due'], ['tickets', '💬', 'Hỗ trợ', 'open_tickets'],
    ['Cộng tác viên'], ['affiliates', '🤝', 'CTV & đại lý'], ['commissions', '💰', 'Hoa hồng'], ['withdrawals', '🏦', 'Rút tiền', 'withdrawals'],
    ['Nội dung & tăng trưởng'], ['lots', '🌱', 'Lô hàng & QR'], ['posts', '✍️', 'Bài viết'], ['seo', '🔎', 'SEO'], ['analytics', '📈', 'Analytics'],
    ['Hệ thống'], ['settings', '⚙️', 'Cài đặt & tích hợp'],
  ];
  let COUNTS = {};
  function renderNav() {
    const cur = location.hash.replace(/^#\/?/, '').split('/')[0];
    $('#nav').innerHTML = NAV.map((n) => n.length === 1 ? `<div class="grp">${n[0]}</div>` :
      `<a href="#/${n[0]}" class="${cur === n[0] ? 'on' : ''}"><span>${n[1]}</span>${n[2]}${n[3] && COUNTS[n[3]] ? `<span class="cnt">${COUNTS[n[3]]}</span>` : ''}</a>`).join('');
  }
  const VIEWS = {};
  async function route() {
    const [name, arg] = location.hash.replace(/^#\/?/, '').split('/');
    const v = VIEWS[name || ''] || VIEWS[''];
    const nav = NAV.find((n) => n[0] === (name || ''));
    $('#title').textContent = nav ? nav[2] : 'Tổng quan';
    $('#topR').innerHTML = '';
    $('#side').classList.remove('open');
    renderNav();
    $('#view').innerHTML = '<div class="empty">Đang tải…</div>';
    try { await v($('#view'), arg); } catch (e) { $('#view').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  window.addEventListener('hashchange', route);
  $('#menu').addEventListener('click', () => $('#side').classList.toggle('open'));

  // ================================================================ Tổng quan
  let DAYS = 30;
  VIEWS[''] = async (el) => {
    const d = await api('/dashboard?days=' + DAYS);
    COUNTS = d.todo; renderNav();
    const k = d.kpi;
    // gom doanh thu theo ngày, đủ các ngày trống
    const byDay = {}; d.by_day.forEach((r) => (byDay[r.d] = (byDay[r.d] || 0) + r.revenue));
    const pts = []; for (let i = DAYS - 1; i >= 0; i--) { const x = new Date(Date.now() + 7 * 3600e3 - i * 86400e3).toISOString().slice(0, 10); pts.push({ l: x.slice(8, 10) + '/' + x.slice(5, 7), t: x.split('-').reverse().join('/'), v: byDay[x] || 0 }); }
    $('#topR').innerHTML = daysSeg(DAYS);
    el.innerHTML = `
      <div class="kpis">
        <div class="kpi"><small>Doanh thu ${DAYS} ngày</small><b>${vnd(k.revenue)}</b>${delta(k.revenue, k.prev_revenue)}</div>
        <div class="kpi"><small>Số đơn</small><b>${num(k.orders)}</b>${delta(k.orders, k.prev_orders)}</div>
        <div class="kpi"><small>Giá trị đơn TB</small><b>${vnd(k.aov)}</b></div>
        <div class="kpi"><small>Đã thu tiền</small><b>${vnd(k.paid)}</b></div>
        <div class="kpi"><small>Tỷ lệ chuyển đổi web</small><b>${k.conversion}%</b><span class="muted small">${num(k.sessions)} phiên</span></div>
        <div class="kpi"><small>Khách mới · tỷ lệ mua lại</small><b>${num(k.new_customers)} · ${k.repeat_rate}%</b></div>
        <div class="kpi"><small>Hoa hồng chờ / phải trả</small><b>${vnd(d.commissions.pending)}</b><span class="muted small">Khả dụng chưa rút ${vnd(d.commissions.payable)}</span></div>
      </div>
      <div class="card"><div class="card-h"><h2>Việc cần làm</h2></div><div class="todo">
        <a href="#/orders" class="${d.todo.new_orders ? 'hot' : ''}"><b>${d.todo.new_orders}</b>Đơn mới cần xác nhận</a>
        <a href="#/orders" class="${d.todo.to_ship ? 'hot' : ''}"><b>${d.todo.to_ship}</b>Đơn chờ tạo vận đơn</a>
        <a href="#/tasks" class="${d.todo.tasks_due ? 'hot' : ''}"><b>${d.todo.tasks_due}</b>Cuộc gọi chăm sóc đến hạn</a>
        <a href="#/tickets" class="${d.todo.open_tickets ? 'hot' : ''}"><b>${d.todo.open_tickets}</b>Phiếu hỗ trợ mở</a>
        <a href="#/withdrawals" class="${d.todo.withdrawals ? 'hot' : ''}"><b>${d.todo.withdrawals}</b>Lệnh rút ${vnd(d.todo.withdrawals_total)}</a>
        <a href="#/products" class="${d.low_stock.length ? 'hot' : ''}"><b>${d.low_stock.length}</b>SKU sắp hết hàng</a>
      </div></div>
      <div class="g21">
        <div class="card"><div class="card-h"><h2>Doanh thu theo ngày</h2><span class="muted small">Không tính đơn huỷ, hoàn</span></div>${barChart(pts)}</div>
        <div class="card"><div class="card-h"><h2>Theo kênh bán</h2></div>${hbars(d.by_channel.map((c) => ({ l: c.label, v: c.revenue, x: c.n + ' đơn' })))}</div>
      </div>
      <div class="g2">
        <div class="card"><div class="card-h"><h2>Phễu mua hàng (web)</h2><span class="muted small">Số phiên</span></div>${hbars(d.funnel.map(([l, v]) => ({ l, v })), { fmt: num, cls: 'sun' })}</div>
        <div class="card"><div class="card-h"><h2>Sản phẩm bán chạy</h2></div>${hbars(d.top_products.map((p) => ({ l: p.name.split(' · ')[0], v: p.revenue, x: p.qty + ' sp' })))}</div>
      </div>
      <div class="g21">
        <div class="card"><div class="card-h"><h2>Đơn gần đây</h2><a href="#/orders">Tất cả →</a></div>${table([
          { h: 'Mã', f: (r) => `<b>${esc(r.code)}</b>` }, { h: 'Khách', k: 'name' }, { h: 'Kênh', f: (r) => esc(CHANNEL[r.channel]) }, { h: 'Tổng', num: 1, f: (r) => vnd(r.total) },
          { h: 'Thanh toán', f: (r) => `${esc(PM[r.payment_method] || '')} ${badge(PAY, r.payment_status)}` }, { h: 'Trạng thái', f: (r) => badge(STATUS, r.status) }, { h: 'Lúc', f: (r) => dt(r.created_at) }], d.recent, { click: 1 })}</div>
        <div class="card"><div class="card-h"><h2>Tồn kho thấp</h2></div>${table([{ h: 'SKU', k: 'sku' }, { h: 'Sản phẩm', f: (r) => esc(r.name + ' ' + (r.subtitle || '')) }, { h: 'Tồn', num: 1, f: (r) => `<b style="color:${r.stock < 10 ? 'var(--red)' : 'inherit'}">${r.stock}</b>` }], d.low_stock, { empty: 'Kho ổn ✓' })}</div>
      </div>`;
    bindTips(el);
    bindRows(el, d.recent, (r) => orderDetail(r.id));
    $$('#days button').forEach((b) => b.addEventListener('click', () => { DAYS = +b.dataset.d; route(); }));
  };

  // ================================================================ Đơn hàng
  let OF = { status: '', channel: '', pay: '', q: '', from: '', to: '' };
  VIEWS.orders = async (el, arg) => {
    $('#topR').innerHTML = `<button class="btn ghost sm" id="imp">⬆ Nhập CSV TikTok/Shopee</button><button class="btn ghost sm" id="exp">⬇ Xuất CSV</button><button class="btn sm" id="newO">+ Tạo đơn</button>`;
    const qs = () => new URLSearchParams(Object.entries(OF).filter(([, v]) => v)).toString();
    el.innerHTML = `<div class="filters">
      <input type="search" id="oq" placeholder="Mã đơn, SĐT, tên, mã sàn" value="${esc(OF.q)}" />
      <select id="os"><option value="">Mọi trạng thái</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${OF.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
      <select id="oc"><option value="">Mọi kênh</option>${Object.entries(CHANNEL).map(([k, v]) => `<option value="${k}" ${OF.channel === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="op"><option value="">Mọi thanh toán</option>${Object.entries(PAY).map(([k, v]) => `<option value="${k}" ${OF.pay === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select>
      <input type="date" id="of" value="${OF.from}" title="Từ ngày" /><input type="date" id="ot" value="${OF.to}" title="Đến ngày" />
    </div><div class="card" id="olist"><div class="empty">Đang tải…</div></div>`;
    const load = async () => {
      const rows = await api('/orders?' + qs());
      const sum = rows.filter((r) => !['cancelled', 'returned'].includes(r.status)).reduce((s, r) => s + r.total, 0);
      $('#olist').innerHTML = `<div class="card-h"><span class="muted">${rows.length} đơn · ${vnd(sum)} (không tính huỷ/hoàn)</span></div>` + table([
        { h: 'Mã', f: (r) => `<b>${esc(r.code)}</b>${r.external_id ? `<div class="muted small">${esc(r.external_id)}</div>` : ''}` },
        { h: 'Lúc', f: (r) => `<span class="nowrap">${dt(r.created_at)}</span>` }, { h: 'Kênh', f: (r) => esc(CHANNEL[r.channel] || r.channel) },
        { h: 'Khách', f: (r) => `${esc(r.name)}<div class="muted small">${esc(r.phone)} · ${esc(r.province || '')}</div>` },
        { h: 'Tổng', num: 1, f: (r) => `<b>${vnd(r.total)}</b>${r.discount ? `<div class="muted small">−${vnd(r.discount)}</div>` : ''}` },
        { h: 'Thanh toán', f: (r) => `<span class="small">${esc(PM[r.payment_method] || r.payment_method)}</span><br>${badge(PAY, r.payment_status)}` },
        { h: 'Vận chuyển', f: (r) => `<span class="small">${esc(r.shipping_carrier || '')}${r.fragile ? ' · 🥚 dễ vỡ' : ''}</span>${r.tracking_code ? `<div class="small">${esc(r.tracking_code)}</div>` : ''}${r.ship_status_text ? `<div class="muted small">${esc(r.ship_status_text)}</div>` : ''}` },
        { h: 'CTV', f: (r) => (r.aff_code ? `<span class="badge b-purple">${esc(r.aff_code)}</span>` : '') },
        { h: 'Trạng thái', f: (r) => badge(STATUS, r.status) },
      ], rows, { click: 1, empty: 'Không có đơn phù hợp' });
      bindRows($('#olist'), rows, (r) => orderDetail(r.id, load));
    };
    let t; $('#oq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { OF.q = e.target.value.trim(); load().catch(fail); }, 300); });
    [['#os', 'status'], ['#oc', 'channel'], ['#op', 'pay'], ['#of', 'from'], ['#ot', 'to']].forEach(([s, k]) => $(s).addEventListener('change', (e) => { OF[k] = e.target.value; load().catch(fail); }));
    $('#exp').addEventListener('click', () => download('/orders?format=csv&' + qs()));
    $('#newO').addEventListener('click', () => manualOrderForm(load));
    $('#imp').addEventListener('click', () => importForm(load));
    await load();
    if (arg) orderDetail(+arg, load);
  };

  async function orderDetail(id, reload) {
    const o = await api('/orders/' + id).catch(fail); if (!o) return;
    const parcel = (() => { try { return JSON.parse(o.parcel_dims || 'null'); } catch { return null; } })();
    const next = { new: ['confirmed', 'cancelled'], confirmed: ['shipping', 'completed', 'cancelled'], shipping: ['completed', 'returned', 'cancelled'], completed: ['returned'], cancelled: [], returned: [] }[o.status] || [];
    const addr = [o.address, o.ward, o.district, o.province].filter(Boolean).join(', ');
    const d = openDrawer(`Đơn ${esc(o.code)} ${badge(STATUS, o.status)}`, `
      <div class="g2">
        <div class="card"><h3>Khách hàng</h3><dl class="kv">
          <dt>Họ tên</dt><dd><b>${esc(o.name)}</b>${o.customer_id ? ` · <a href="#/customers/${o.customer_id}">hồ sơ CRM</a>` : ''}</dd>
          <dt>Điện thoại</dt><dd><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a> · <a href="https://zalo.me/${esc(o.phone)}" target="_blank" rel="noopener">Zalo</a></dd>
          ${o.email ? `<dt>Email</dt><dd>${esc(o.email)}</dd>` : ''}
          <dt>Địa chỉ</dt><dd>${esc(addr)}</dd>
          ${o.note ? `<dt>Ghi chú khách</dt><dd>${esc(o.note)}</dd>` : ''}
          <dt>Kênh</dt><dd>${esc(CHANNEL[o.channel])}${o.external_id ? ` · ${esc(o.external_id)}` : ''}</dd>
          <dt>Nguồn</dt><dd>${esc([o.utm_source, o.utm_medium, o.utm_campaign].filter(Boolean).join(' / ') || 'trực tiếp')}</dd>
          <dt>Đặt lúc</dt><dd>${dt(o.created_at)}</dd>
        </dl></div>
        <div class="card"><h3>Thanh toán</h3><dl class="kv">
          <dt>Hình thức</dt><dd>${esc(PM[o.payment_method] || o.payment_method)} ${badge(PAY, o.payment_status)}</dd>
          ${o.payment_code ? `<dt>Mã thanh toán</dt><dd><b>${esc(o.payment_code)}</b></dd>` : ''}
          ${o.paid_amount ? `<dt>Đã nhận</dt><dd>${vnd(o.paid_amount)} · ${dt(o.paid_at)}</dd>` : ''}
          ${o.voucher_code ? `<dt>Voucher</dt><dd>${esc(o.voucher_code)}</dd>` : ''}
          <dt>CTV</dt><dd>${o.aff_code ? `${esc(o.aff_name)} (${esc(o.aff_code)}) · ${esc(o.ref_source || '')}` : '—'}</dd>
        </dl>
        <div class="actions">${o.payment_status !== 'paid' ? `<button class="btn sm" id="markPaid">Đánh dấu đã thu tiền</button>` : ''}${o.payment_method === 'sepay' && o.payment_status !== 'paid' ? `<button class="btn ghost sm" id="syncPay">Kiểm tra SePay</button>` : ''}
        <a class="btn ghost sm" target="_blank" href="/don-hang/${esc(o.code)}?t=${esc(o.view_token)}">Trang đơn của khách ↗</a></div></div>
      </div>
      <div class="card"><h3>Sản phẩm</h3>${table([{ h: 'SKU', k: 'sku' }, { h: 'Tên', f: (r) => esc(r.name) + (r.flash_item_id ? ' <span class="badge b-red">Flash</span>' : '') }, { h: 'SL', num: 1, k: 'qty' }, { h: 'Đơn giá', num: 1, f: (r) => vnd(r.price) }, { h: 'Thành tiền', num: 1, f: (r) => vnd(r.price * r.qty) }], o.items)}
        <dl class="kv" style="margin-top:10px;max-width:360px;margin-left:auto"><dt>Tạm tính</dt><dd class="right">${vnd(o.subtotal)}</dd><dt>Giảm giá</dt><dd class="right">−${vnd(o.discount)}</dd>
        <dt>Phí giao</dt><dd class="right">${vnd(o.shipping_fee)}${o.shop_pays_ship ? ' <span class="badge b-green">shop trả</span>' : ''}</dd><dt><b>Tổng</b></dt><dd class="right"><b>${vnd(o.total)}</b></dd></dl></div>
      <div class="card"><h3>Vận chuyển</h3><dl class="kv">
        <dt>Kiện hàng</dt><dd>${parcel ? `${num(parcel.weight)}g · ${parcel.length}×${parcel.width}×${parcel.height}cm${parcel.fragile ? ' · <b>🥚 dễ vỡ</b>' : ''}` : (o.parcel_weight ? num(o.parcel_weight) + 'g' : '—')}</dd>
        <dt>Hãng khách chọn</dt><dd>${esc(o.shipping_carrier || '—')} ${esc(o.shipping_service || '')} ${o.shipping_expected ? '· ' + esc(o.shipping_expected) : ''}</dd>
        ${o.tracking_code ? `<dt>Mã vận đơn</dt><dd><b>${esc(o.tracking_code)}</b> ${o.tracking_url ? `<a href="${esc(o.tracking_url)}" target="_blank" rel="noopener">theo dõi ↗</a>` : ''}</dd>` : ''}
        ${o.ship_status_text ? `<dt>Trạng thái hãng</dt><dd>${esc(o.ship_status_text)}</dd>` : ''}
        ${o.shipping_cost ? `<dt>Phí thực trả</dt><dd>${vnd(o.shipping_cost)}</dd>` : ''}
      </dl>
      ${!o.goship_id && ['new', 'confirmed'].includes(o.status) ? `<div class="actions"><button class="btn sm sun" id="getRates">Lấy giá Goship & tạo vận đơn</button></div><div id="rates" class="rates" style="margin-top:10px"></div>` : ''}
      <div class="form" style="margin-top:10px"><div class="f s3"><label>Hãng (nhập tay)</label><input id="eCarrier" value="${esc(o.shipping_carrier || '')}" /></div><div class="f s3"><label>Mã vận đơn (nhập tay)</label><input id="eTrack" value="${esc(o.tracking_code || '')}" /></div></div></div>
      ${o.commissions.length ? `<div class="card"><h3>Hoa hồng</h3>${table([{ h: 'Cấp', f: (r) => esc(r.level_name) }, { h: 'CTV', f: (r) => `${esc(r.name)} (${esc(r.code)})` }, { h: 'Doanh số', num: 1, f: (r) => vnd(r.base) }, { h: '%', num: 1, k: 'rate' }, { h: 'Hoa hồng', num: 1, f: (r) => `<b>${vnd(r.amount)}</b>` }, { h: 'Trạng thái', f: (r) => esc(r.status) + (r.available_at ? `<div class="muted small">khả dụng ${dd(r.available_at)}</div>` : '') }], o.commissions)}</div>` : ''}
      <div class="card"><h3>Xử lý</h3><div class="form">
        <div class="f s3"><label>Mã CTV gán cho đơn</label><input id="eAff" value="${esc(o.aff_code || '')}" placeholder="Để trống nếu không có" /></div>
        <div class="f s3"><label>Đổi trạng thái</label><select id="eStatus"><option value="">— giữ nguyên (${esc(STATUS[o.status][0])}) —</option>${next.map((s) => `<option value="${s}">${STATUS[s][0]}</option>`).join('')}</select></div>
        <div class="f"><label>Ghi chú nội bộ</label><textarea id="eNote" rows="2">${esc(o.admin_note || '')}</textarea></div>
      </div><div class="actions"><button class="btn" id="saveO">Lưu thay đổi</button></div>
      <p class="muted small">Huỷ hoặc hoàn hàng sẽ trả lại tồn kho, suất flash sale và huỷ hoa hồng chưa rút. Hoàn tất sẽ chuyển hoa hồng sang khả dụng sau thời gian giữ.</p></div>`);
    const refresh = () => { reload && reload().catch(() => {}); orderDetail(id, reload); };
    $('#markPaid', d)?.addEventListener('click', (e) => act(e.target, async () => { if (!confirm('Xác nhận đã nhận đủ ' + vnd(o.total) + '?')) return; await api('/orders/' + id, { method: 'PUT', body: { payment_status: 'paid' } }); toast('Đã ghi nhận thanh toán'); refresh(); }));
    $('#syncPay', d)?.addEventListener('click', (e) => act(e.target, async () => { const r = await api(`/orders/${id}/sync-payment`, { method: 'POST' }); toast(r.payment_status === 'paid' ? 'Đã nhận tiền ✓' : 'Chưa thấy tiền về'); refresh(); }));
    $('#getRates', d)?.addEventListener('click', (e) => act(e.target, async () => {
      const opts = await api(`/orders/${id}/rates`);
      const box = $('#rates', d);
      if (!opts.length || opts[0].id === 'fallback') { box.innerHTML = '<p class="muted">Chưa kết nối Goship hoặc đơn thiếu mã quận/huyện. Kết nối trong Cài đặt, hoặc nhập tay hãng và mã vận đơn bên dưới.</p>'; return; }
      box.innerHTML = opts.map((r, i) => `<label><input type="radio" name="rate" value="${esc(r.id)}" ${i === 0 ? 'checked' : ''} />${r.logo ? `<img src="${esc(r.logo)}" alt="" />` : ''}<span style="flex:1"><b>${esc(r.carrier)}</b> ${esc(r.service || '')}<br><span class="muted small">${esc(r.expected || '')}${r.success ? ' · giao thành công ' + r.success + '%' : ''}</span></span><b>${vnd(r.fee)}</b></label>`).join('') +
        '<button class="btn sm" id="mkShip">Tạo vận đơn</button>';
      $('#mkShip', d).addEventListener('click', (ev) => act(ev.target, async () => {
        const rate = $('input[name=rate]:checked', d)?.value;
        const r = await api(`/orders/${id}/shipment`, { method: 'POST', body: { rate_id: rate } });
        toast('Đã tạo vận đơn ' + (r.shipment?.tracking_number || r.shipment?.id || '')); refresh();
      }));
    }));
    $('#saveO', d).addEventListener('click', (e) => act(e.target, async () => {
      const st = $('#eStatus', d).value;
      if (st && ['cancelled', 'returned'].includes(st) && !confirm(`Chuyển đơn sang "${STATUS[st][0]}"?`)) return;
      await api('/orders/' + id, { method: 'PUT', body: { status: st || undefined, admin_note: $('#eNote', d).value, affiliate_code: $('#eAff', d).value.trim().toUpperCase(), tracking_code: $('#eTrack', d).value.trim() || null, shipping_carrier: $('#eCarrier', d).value.trim() || null } });
      toast('Đã lưu'); refresh();
    }));
  }

  async function manualOrderForm(reload) {
    const ps = (await products()).filter((p) => p.active);
    const opt = ps.map((p) => `<option value="${esc(p.sku)}">${esc(p.sku)} · ${esc(p.name)} ${esc(p.subtitle || '')} (${vnd(p.price)})</option>`).join('');
    const row = () => `<div class="row"><select class="inp" data-sku>${opt}</select><input class="inp" data-qty type="number" min="1" value="1" /><input class="inp" data-price type="number" placeholder="Giá (mặc định)" /><button class="btn red sm" data-del type="button">×</button></div>`;
    const d = openDrawer('Tạo đơn thủ công', `
      <p class="muted">Dùng cho đơn từ TikTok Shop, Shopee, Zalo/Facebook, khách sỉ B2B hoặc bán tại cửa hàng. Tồn kho được trừ, khách được lưu vào CRM, hoa hồng tính nếu gán mã CTV.</p>
      <div class="card">${form([
        { k: 'channel', l: 'Kênh', t: 'select', s: 2, o: Object.entries(CHANNEL).filter(([k]) => k !== 'web') },
        { k: 'external_id', l: 'Mã đơn trên sàn', s: 2 }, { k: 'status', l: 'Trạng thái', t: 'select', s: 2, o: [['confirmed', 'Đã xác nhận'], ['shipping', 'Đang giao'], ['completed', 'Hoàn tất']] },
        { k: 'name', l: 'Tên khách', s: 3 }, { k: 'phone', l: 'Số điện thoại', s: 3 }, { k: 'address', l: 'Địa chỉ', s: 4 }, { k: 'province', l: 'Tỉnh/thành', s: 2 },
      ], { channel: 'tiktok', status: 'confirmed' })}
      <h3 style="margin-top:14px">Sản phẩm</h3><div class="lines-ed" id="lines">${row()}</div><button class="btn ghost sm" id="addL" type="button">+ Thêm dòng</button>
      <div style="margin-top:12px">${form([
        { k: 'discount', l: 'Giảm giá (đ)', t: 'number', s: 2 }, { k: 'shipping_fee', l: 'Phí ship thu khách (đ)', t: 'number', s: 2 }, { k: 'affiliate_code', l: 'Mã CTV (nếu có)', s: 2 },
        { k: 'payment_method', l: 'Thanh toán', t: 'select', s: 3, o: [['cod', 'COD'], ['bank', 'Chuyển khoản'], ['platform', 'Sàn thu hộ']] }, { k: 'paid', l: 'Đã thu tiền', t: 'check', s: 3 }, { k: 'note', l: 'Ghi chú' },
      ], {})}</div>
      <div class="actions"><button class="btn" id="mkO">Tạo đơn</button></div></div>`);
    $('#addL', d).addEventListener('click', () => $('#lines', d).insertAdjacentHTML('beforeend', row()));
    $('#lines', d).addEventListener('click', (e) => { if (e.target.matches('[data-del]') && $$('#lines .row', d).length > 1) e.target.closest('.row').remove(); });
    $('#mkO', d).addEventListener('click', (e) => act(e.target, async () => {
      const b = readForm(d);
      b.items = $$('#lines .row', d).map((r) => ({ sku: $('[data-sku]', r).value, qty: +$('[data-qty]', r).value || 1, price: $('[data-price]', r).value || null }));
      const o = await api('/orders', { method: 'POST', body: b });
      toast('Đã tạo đơn ' + o.code); PRODUCTS = null; closeDrawer(); reload && reload();
    }));
  }

  function importForm(reload) {
    const d = openDrawer('Nhập đơn từ TikTok Shop / Shopee', `<div class="card">
      <p>Xuất file đơn hàng (CSV) từ Seller Center rồi chọn file ở đây. Hệ thống tự nhận cột Mã đơn, SKU, Số lượng, Giá, Người nhận, SĐT, Địa chỉ, Trạng thái. Đơn đã nhập sẽ bỏ qua, đơn huỷ không nhập.</p>
      <p class="muted small">SKU trên sàn cần trùng SKU trong DaLa (VD: BCX-350, CLTH-100). File Excel (.xlsx) hãy lưu lại dạng CSV UTF-8 trước.</p>
      ${form([{ k: 'channel', l: 'Sàn', t: 'select', s: 2, o: [['tiktok', 'TikTok Shop'], ['shopee', 'Shopee']] }], {})}
      <div class="form" style="margin-top:10px"><div class="f"><label>File CSV</label><input type="file" id="csvF" accept=".csv,text/csv" /></div></div>
      <div class="actions"><button class="btn" id="doImp">Nhập đơn</button></div><div id="impRes" style="margin-top:10px"></div></div>`);
    $('#doImp', d).addEventListener('click', (e) => act(e.target, async () => {
      const f = $('#csvF', d).files[0]; if (!f) throw new Error('Chọn file CSV');
      const csv = await f.text();
      const r = await api('/orders/import', { method: 'POST', body: { channel: $('[name=channel]', d).value, csv } });
      $('#impRes', d).innerHTML = `<p><b>Đã nhập ${r.created} đơn</b>, bỏ qua ${r.skipped}.</p>${r.errors.length ? `<ul class="small">${r.errors.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
      PRODUCTS = null; reload && reload();
    }));
  }

  // ================================================================ Sản phẩm
  const LINES = [['chuoi', 'Bột chuối xanh'], ['chanhleo', 'Chanh leo'], ['khoailang', 'Khoai lang'], ['qua', 'Hộp quà'], ['tuoi', 'Trái tươi'], ['combo', 'Combo'], ['khac', 'Khác']];
  const KINDS = [['retail', 'Bán lẻ'], ['combo', 'Combo'], ['addon', 'Chỉ bán kèm'], ['b2b', 'B2B/sỉ'], ['gift', 'Quà tặng']];
  VIEWS.products = async (el) => {
    PRODUCTS = null; const ps = await products();
    $('#topR').innerHTML = '<button class="btn sm" id="newP">+ Thêm sản phẩm / combo</button>';
    el.innerHTML = `<div class="card">${table([
      { h: '', f: (p) => `<img class="th" src="${esc((p.image || '').replace('.webp', '-sm.webp'))}" alt="" onerror="this.src='${esc(p.image || '')}'" />` },
      { h: 'Sản phẩm', f: (p) => `<b>${esc(p.name)}</b> <span class="muted">${esc(p.subtitle || '')}</span><div class="muted small">${esc(p.sku)} · ${esc(KINDS.find((k) => k[0] === p.kind)?.[1] || p.kind)}${p.active ? '' : ' · <b>đang ẩn</b>'}</div>` },
      { h: 'Giá', num: 1, f: (p) => `${vnd(p.price)}${p.flash ? `<div class="small" style="color:var(--red)">⚡ ${vnd(p.flash.price)}</div>` : ''}${p.compare_price ? `<div class="muted small"><s>${vnd(p.compare_price)}</s></div>` : ''}` },
      { h: 'Tồn', num: 1, f: (p) => `<b style="color:${p.stock < 10 ? 'var(--red)' : 'inherit'}">${num(p.stock)}</b>${p.kind === 'combo' ? '<div class="muted small">theo thành phần</div>' : ''}` },
      { h: 'Bán 30 ngày', num: 1, f: (p) => `${num(p.sold_30d)}<div class="muted small">${vnd(p.revenue_30d)}</div>` },
      { h: 'Kiện hàng', f: (p) => `<span class="small">${num(p.weight_g)}g · ${p.length_cm}×${p.width_cm}×${p.height_cm}${p.fragile ? ' · 🥚' : ''}</span>` },
      { h: 'Sàn', f: (p) => `${p.tiktok_url ? '<span class="badge b-gray">TikTok</span> ' : ''}${p.shopee_url ? '<span class="badge b-sun">Shopee</span>' : ''}` },
    ], ps, { click: 1 })}</div>`;
    bindRows(el, ps, (p) => productForm(p));
    $('#newP').addEventListener('click', () => productForm({ kind: 'retail', line: 'chuoi', active: 1, commissionable: 1, weight_g: 300, length_cm: 15, width_cm: 10, height_cm: 10, sort: 100 }));
  };
  function productForm(p) {
    const combo = (p.combo_items || []).map((c) => `${c.sku} x${c.qty}`).join(', ');
    const d = openDrawer(p.id ? `Sửa ${esc(p.name)}` : 'Thêm sản phẩm', `<div class="card">${form([
      { t: 'sec', l: 'Thông tin bán hàng' },
      { k: 'sku', l: 'SKU', s: 2 }, { k: 'name', l: 'Tên', s: 4 }, { k: 'subtitle', l: 'Quy cách hiển thị (VD: Túi 350g)', s: 3 }, { k: 'slug', l: 'Đường dẫn (slug)', s: 3, h: 'Để trống để tự tạo' },
      { k: 'line', l: 'Dòng', t: 'select', o: LINES, s: 2 }, { k: 'kind', l: 'Loại', t: 'select', o: KINDS, s: 2 }, { k: 'sort', l: 'Thứ tự', t: 'number', s: 2 },
      { k: 'price', l: 'Giá bán', t: 'number', s: 2 }, { k: 'compare_price', l: 'Giá gốc / mua lẻ', t: 'number', s: 2 }, { k: 'wholesale_price', l: 'Giá sỉ', t: 'number', s: 2 },
      { k: 'cost', l: 'Giá vốn', t: 'number', s: 2 }, { k: 'stock', l: 'Tồn kho', t: 'number', s: 2 }, { k: 'active', l: 'Đang bán', t: 'check', s: 1 }, { k: 'commissionable', l: 'Tính hoa hồng', t: 'check', s: 1 },
      { k: 'combo_items', l: 'Thành phần combo', get: () => combo, ph: 'BCX-S10 x1, CLTH-25 x1', h: 'Chỉ cho loại Combo. Tồn kho combo tính theo thành phần.' },
      { t: 'sec', l: 'Kiện hàng (tính phí Goship)' },
      { k: 'weight_g', l: 'Khối lượng (g)', t: 'number', s: 1 }, { k: 'length_cm', l: 'Dài (cm)', t: 'number', s: 1 }, { k: 'width_cm', l: 'Rộng (cm)', t: 'number', s: 1 }, { k: 'height_cm', l: 'Cao (cm)', t: 'number', s: 1 },
      { k: 'fragile', l: 'Hàng dễ vỡ', t: 'check', s: 2 },
      { t: 'sec', l: 'Nội dung & storyline' },
      { k: 'image', l: 'Ảnh (đã tách nền)', s: 3 }, { k: 'image_bg', l: 'Ảnh có nền', s: 3 },
      { k: 'short_desc', l: 'Mô tả ngắn', t: 'textarea', rows: 2 }, { k: 'story', l: 'Câu chuyện', t: 'textarea', rows: 4 },
      { k: 'benefits', l: 'Lợi ích (mỗi dòng một ý)', t: 'textarea', get: (v) => (v.benefits || []).join('\n') },
      { k: 'usage', l: 'Cách dùng', t: 'textarea', rows: 2 }, { k: 'ingredients', l: 'Thành phần', s: 4 }, { k: 'weight', l: 'Quy cách', s: 2 },
      { k: 'badges', l: 'Nhãn (mỗi dòng một nhãn)', t: 'textarea', rows: 2, s: 3, get: (v) => (v.badges || []).join('\n') },
      { k: 'personas', l: 'Chân dung khách (van-phong, me-be, duong-huyet, qua-tang, quan-tra)', t: 'textarea', rows: 2, s: 3, get: (v) => (v.personas || []).join('\n') },
      { t: 'sec', l: 'Đa kênh & SEO' },
      { k: 'tiktok_url', l: 'Link TikTok Shop', s: 3 }, { k: 'shopee_url', l: 'Link Shopee', s: 3 },
      { k: 'seo_title', l: 'Tiêu đề SEO (30–65 ký tự)' }, { k: 'seo_desc', l: 'Mô tả SEO (70–165 ký tự)', t: 'textarea', rows: 2 },
    ], p)}<div class="actions"><button class="btn" id="saveP">Lưu</button>${p.slug ? `<a class="btn ghost" href="/san-pham/${esc(p.slug)}" target="_blank">Xem trang ↗</a>` : ''}</div></div>`);
    $('#saveP', d).addEventListener('click', (e) => act(e.target, async () => {
      const b = readForm(d);
      await api(p.id ? '/products/' + p.id : '/products', { method: p.id ? 'PUT' : 'POST', body: b });
      toast('Đã lưu sản phẩm'); closeDrawer(); route();
    }));
  }

  // ================================================================ Flash sale
  VIEWS.flash = async (el) => {
    const [sales, ps] = await Promise.all([api('/flash-sales'), products()]);
    $('#topR').innerHTML = '<button class="btn sm" id="newF">+ Tạo flash sale</button>';
    const now = Date.now();
    const state = (s) => { const a = toDate(s.starts_at), b = toDate(s.ends_at); if (!s.active) return '<span class="badge b-gray">Tắt</span>'; if (now < a) return '<span class="badge b-blue">Sắp diễn ra</span>'; if (now > b) return '<span class="badge b-gray">Đã kết thúc</span>'; return '<span class="badge b-red">Đang chạy</span>'; };
    el.innerHTML = `<div class="card">${table([
      { h: 'Tên', f: (s) => `<b>${esc(s.name)}</b>` }, { h: 'Thời gian', f: (s) => `${dt(s.starts_at)} → ${dt(s.ends_at)}` }, { h: 'Trạng thái', f: state },
      { h: 'Sản phẩm', f: (s) => s.items.map((i) => `<div class="small">${esc(i.sku)}: <b>${vnd(i.sale_price)}</b> <span class="muted">(${i.sold}/${i.quota || '∞'} suất, tối đa ${i.per_order}/đơn)</span></div>`).join('') },
    ], sales, { click: 1, empty: 'Chưa có flash sale' })}</div>
    <p class="muted small">Giá flash áp dụng tự động trên web trong khung giờ. Khi hết suất hoặc vượt giới hạn mỗi đơn, phần dư tính giá thường. Đơn huỷ được trả lại suất.</p>`;
    bindRows(el, sales, (s) => flashForm(s, ps));
    $('#newF').addEventListener('click', () => flashForm({ name: 'Flash Sale', active: 1, items: [], starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 86400e3).toISOString() }, ps));
  };
  function flashForm(s, ps) {
    const opt = (sel) => ps.filter((p) => p.active).map((p) => `<option value="${p.id}" ${+sel === p.id ? 'selected' : ''}>${esc(p.sku)} · ${esc(p.name)} ${esc(p.subtitle || '')} (${vnd(p.price)})</option>`).join('');
    const row = (i = {}) => `<div class="row" style="grid-template-columns:1fr 100px 70px 70px 30px"><select class="inp" data-p>${opt(i.product_id)}</select><input class="inp" data-sp type="number" placeholder="Giá flash" value="${i.sale_price || ''}" /><input class="inp" data-q type="number" placeholder="Suất" value="${i.quota ?? ''}" title="Số suất (0 = không giới hạn)" /><input class="inp" data-po type="number" placeholder="/đơn" value="${i.per_order || 3}" title="Tối đa mỗi đơn" /><button class="btn red sm" data-del type="button">×</button></div>`;
    const d = openDrawer(s.id ? 'Sửa flash sale' : 'Tạo flash sale', `<div class="card">${form([
      { k: 'name', l: 'Tên chương trình', s: 4 }, { k: 'active', l: 'Bật', t: 'check', s: 2 },
      { k: 'starts_at', l: 'Bắt đầu', t: 'datetime', s: 3 }, { k: 'ends_at', l: 'Kết thúc', t: 'datetime', s: 3 },
    ], s)}<h3 style="margin-top:14px">Sản phẩm giảm giá</h3><p class="muted small">Giá flash · số suất · tối đa mỗi đơn</p><div class="lines-ed" id="fl">${(s.items.length ? s.items : [{}]).map(row).join('')}</div>
    <button class="btn ghost sm" id="addF" type="button">+ Thêm sản phẩm</button>
    <div class="actions"><button class="btn" id="saveF">Lưu</button>${s.id ? '<button class="btn red" id="delF">Xoá</button>' : ''}</div></div>`);
    $('#addF', d).addEventListener('click', () => $('#fl', d).insertAdjacentHTML('beforeend', row()));
    $('#fl', d).addEventListener('click', (e) => { if (e.target.matches('[data-del]')) e.target.closest('.row').remove(); });
    $('#saveF', d).addEventListener('click', (e) => act(e.target, async () => {
      const b = readForm($('.form', d));
      b.starts_at = b.starts_at ? new Date(b.starts_at).toISOString() : ''; b.ends_at = b.ends_at ? new Date(b.ends_at).toISOString() : '';
      b.items = $$('#fl .row', d).map((r) => ({ product_id: +$('[data-p]', r).value, sale_price: +$('[data-sp]', r).value, quota: +$('[data-q]', r).value || 0, per_order: +$('[data-po]', r).value || 3 }));
      await api(s.id ? '/flash-sales/' + s.id : '/flash-sales', { method: s.id ? 'PUT' : 'POST', body: b });
      toast('Đã lưu flash sale'); closeDrawer(); route();
    }));
    $('#delF', d)?.addEventListener('click', (e) => act(e.target, async () => { if (!confirm('Xoá flash sale này?')) return; await api('/flash-sales/' + s.id, { method: 'DELETE' }); closeDrawer(); route(); }));
  }

  // ================================================================ Voucher
  VIEWS.vouchers = async (el) => {
    const rows = await api('/vouchers');
    $('#topR').innerHTML = '<button class="btn sm" id="newV">+ Tạo mã</button>';
    const T = { pct: 'Giảm %', fixed: 'Giảm tiền', freeship: 'Miễn phí ship' };
    el.innerHTML = `<div class="card">${table([
      { h: 'Mã', f: (v) => `<b>${esc(v.code)}</b>` }, { h: 'Loại', f: (v) => T[v.type] }, { h: 'Giá trị', f: (v) => (v.type === 'pct' ? v.value + '%' + (v.max_discount ? ` (tối đa ${vnd(v.max_discount)})` : '') : v.type === 'fixed' ? vnd(v.value) : '—') },
      { h: 'Đơn tối thiểu', num: 1, f: (v) => vnd(v.min_order) }, { h: 'Đã dùng', num: 1, f: (v) => `${v.used}${v.usage_limit ? '/' + v.usage_limit : ''}` },
      { h: 'Điều kiện', f: (v) => `${v.first_order_only ? 'Đơn đầu · ' : ''}${v.ends_at ? 'đến ' + dd(v.ends_at) : ''}` }, { h: 'Ghi chú', k: 'note' },
      { h: '', f: (v) => (v.active ? '<span class="badge b-green">Bật</span>' : '<span class="badge b-gray">Tắt</span>') },
    ], rows, { click: 1 })}</div><p class="muted small">Mã CTV cũng nhập được ở ô mã giảm giá khi thanh toán (giảm theo cài đặt cộng tác viên).</p>`;
    bindRows(el, rows, (v) => voucherForm(v));
    $('#newV').addEventListener('click', () => voucherForm({ type: 'pct', active: 1 }));
  };
  function voucherForm(v) {
    const d = openDrawer(v.code ? 'Sửa mã ' + esc(v.code) : 'Tạo mã giảm giá', `<div class="card">${form([
      { k: 'code', l: 'Mã', s: 2, ro: !!v.code }, { k: 'type', l: 'Loại', t: 'select', s: 2, o: [['pct', 'Giảm %'], ['fixed', 'Giảm tiền'], ['freeship', 'Miễn phí ship']] }, { k: 'value', l: 'Giá trị (% hoặc đ)', t: 'number', s: 2 },
      { k: 'min_order', l: 'Đơn tối thiểu', t: 'number', s: 2 }, { k: 'max_discount', l: 'Giảm tối đa', t: 'number', s: 2 }, { k: 'usage_limit', l: 'Giới hạn lượt', t: 'number', s: 2 },
      { k: 'starts_at', l: 'Bắt đầu', t: 'datetime', s: 3 }, { k: 'ends_at', l: 'Kết thúc', t: 'datetime', s: 3 },
      { k: 'first_order_only', l: 'Chỉ đơn đầu tiên', t: 'check', s: 3 }, { k: 'active', l: 'Bật', t: 'check', s: 3 }, { k: 'note', l: 'Mô tả' },
    ], v)}<div class="actions"><button class="btn" id="saveV">Lưu</button>${v.code ? '<button class="btn red" id="delV">Xoá</button>' : ''}</div></div>`);
    $('#saveV', d).addEventListener('click', (e) => act(e.target, async () => {
      const b = readForm(d); ['starts_at', 'ends_at'].forEach((k) => (b[k] = b[k] ? new Date(b[k]).toISOString() : null));
      await api('/vouchers', { method: 'POST', body: b }); toast('Đã lưu mã'); closeDrawer(); route();
    }));
    $('#delV', d)?.addEventListener('click', (e) => act(e.target, async () => { if (!confirm('Xoá mã ' + v.code + '?')) return; await api('/vouchers/' + v.code, { method: 'DELETE' }); closeDrawer(); route(); }));
  }

  // ================================================================ CRM khách hàng
  let CSEG = ''; let CQ = '';
  const PERSONA = [['', '—'], ['van-phong', 'Dân văn phòng'], ['me-be', 'Mẹ bỉm sữa'], ['duong-huyet', 'Lo đường huyết'], ['qua-tang', 'Mua quà biếu'], ['quan-tra', 'Chủ quán trà']];
  VIEWS.customers = async (el, arg) => {
    $('#topR').innerHTML = '<button class="btn ghost sm" id="expC">⬇ Xuất CSV</button>';
    const segs = [['', 'Tất cả'], ['new', 'Khách mới'], ['repeat', 'Mua lại'], ['vip', 'VIP ≥1tr'], ['risk', 'Nguy cơ rời bỏ'], ['lead', 'Tiềm năng'], ['ctv', 'Gắn CTV']];
    el.innerHTML = `<div class="filters"><div class="seg" id="cseg">${segs.map(([k, l]) => `<button data-s="${k}" class="${CSEG === k ? 'on' : ''}">${l}</button>`).join('')}</div><input type="search" id="cq" placeholder="Tên, SĐT, tag" value="${esc(CQ)}" /></div><div class="card" id="clist"></div>`;
    const load = async () => {
      const rows = await api(`/customers?segment=${CSEG}&q=${encodeURIComponent(CQ)}`);
      const SB = { 'VIP': 'b-sun', 'VIP cần giữ chân': 'b-red', 'Mua lại': 'b-green', 'Khách mới': 'b-blue', 'Có nguy cơ rời bỏ': 'b-red', 'Tiềm năng': 'b-gray' };
      $('#clist').innerHTML = `<div class="card-h"><span class="muted">${rows.length} khách</span></div>` + table([
        { h: 'Khách', f: (c) => `<b>${esc(c.name || '(chưa có tên)')}</b><div class="muted small">${esc(c.phone)} · ${esc(c.province || '')}</div>` },
        { h: 'Nhóm', f: (c) => `<span class="badge ${SB[c.segment] || 'b-gray'}">${esc(c.segment)}</span>` },
        { h: 'Chân dung', f: (c) => esc(PERSONA.find((p) => p[0] === c.persona)?.[1] || '') }, { h: 'Đơn', num: 1, k: 'orders_count' }, { h: 'Tổng chi', num: 1, f: (c) => vnd(c.total_spent) },
        { h: 'Đơn gần nhất', f: (c) => dd(c.last_order_at) }, { h: 'Nguồn', f: (c) => esc(c.source || '') + (c.aff_code ? ` <span class="badge b-purple">${esc(c.aff_code)}</span>` : '') }, { h: 'Tag', k: 'tags' },
      ], rows, { click: 1, empty: 'Không có khách phù hợp' });
      bindRows($('#clist'), rows, (c) => customerDetail(c.id, load));
    };
    $$('#cseg button').forEach((b) => b.addEventListener('click', () => { CSEG = b.dataset.s; $$('#cseg button').forEach((x) => x.classList.toggle('on', x === b)); load().catch(fail); }));
    let t; $('#cq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { CQ = e.target.value.trim(); load().catch(fail); }, 300); });
    $('#expC').addEventListener('click', () => download(`/customers?format=csv&segment=${CSEG}`));
    await load();
    if (arg) customerDetail(+arg, load);
  };
  async function customerDetail(id, reload) {
    const c = await api('/customers/' + id).catch(fail); if (!c) return;
    const tl = [
      ...c.orders.map((o) => ({ t: o.created_at, h: `🧾 Đơn <a href="#/orders/${o.id}">${esc(o.code)}</a> · ${vnd(o.total)} · ${esc(CHANNEL[o.channel])} ${badge(STATUS, o.status)}` })),
      ...c.notes.map((n) => ({ t: n.created_at, h: `📝 <b>${esc(n.author)}</b>: ${esc(n.body)}` })),
      ...c.tasks.map((k) => ({ t: k.done_at || k.due_at, h: `📞 ${esc(k.title)} · ${k.status === 'open' ? 'hạn ' + dd(k.due_at) : esc(k.status)}${k.result ? ' · ' + esc(k.result) : ''}` })),
      ...c.tickets.map((k) => ({ t: k.created_at, h: `💬 Hỗ trợ: ${esc(k.message).slice(0, 120)} · ${esc(k.status)}` })),
    ].sort((a, b) => String(b.t).localeCompare(String(a.t)));
    const d = openDrawer(esc(c.name || c.phone), `
      <div class="g2"><div class="card"><dl class="kv">
        <dt>Điện thoại</dt><dd><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a> · <a href="https://zalo.me/${esc(c.phone)}" target="_blank" rel="noopener">Zalo</a></dd>
        <dt>Nhóm</dt><dd><b>${esc(c.segment)}</b></dd><dt>Số đơn · tổng chi</dt><dd>${c.orders_count} · ${vnd(c.total_spent)}</dd>
        <dt>Mua lần đầu</dt><dd>${dd(c.first_order_at)}</dd><dt>Gần nhất</dt><dd>${dd(c.last_order_at)}</dd>
        <dt>CTV gắn</dt><dd>${c.aff_code ? `${esc(c.aff_name)} (${esc(c.aff_code)})` : '—'}</dd>
        <dt>Hay mua</dt><dd>${c.favorites.map((f) => `${esc(f.name.split(' · ')[0])} ×${f.qty}`).join(', ') || '—'}</dd>
      </dl></div>
      <div class="card">${form([
        { k: 'name', l: 'Tên', s: 3 }, { k: 'email', l: 'Email', s: 3 }, { k: 'province', l: 'Tỉnh', s: 2 }, { k: 'persona', l: 'Chân dung', t: 'select', o: PERSONA, s: 4 },
        { k: 'address', l: 'Địa chỉ' }, { k: 'tags', l: 'Tag (phẩy)', ph: 'mẹ bỉm, thích chanh leo' }, { k: 'note', l: 'Ghi chú cố định', t: 'textarea', rows: 2 },
      ], c)}<div class="actions"><button class="btn sm" id="saveC">Lưu hồ sơ</button></div></div></div>
      <div class="card"><h3>Ghi chú & việc chăm sóc</h3>
        <div class="form"><div class="f s4"><textarea id="note" rows="2" placeholder="Nội dung cuộc gọi, phản hồi của khách…"></textarea></div><div class="f s2"><button class="btn sm" id="addN">+ Ghi chú</button></div>
        <div class="f s3"><input id="tTitle" placeholder="Việc cần làm, VD: gọi tư vấn combo" /></div><div class="f s2"><input id="tDue" type="datetime-local" /></div><div class="f s1"><button class="btn ghost sm" id="addT">+ Việc</button></div></div>
      </div>
      <div class="card"><h3>Lịch sử</h3><ul class="timeline">${tl.map((x) => `<li><span class="muted small">${dt(x.t)}</span><br>${x.h}</li>`).join('') || '<li>Chưa có hoạt động</li>'}</ul></div>`);
    $('#saveC', d).addEventListener('click', (e) => act(e.target, async () => { await api('/customers/' + id, { method: 'PUT', body: readForm($('.card .form', d)) }); toast('Đã lưu'); reload && reload(); }));
    $('#addN', d).addEventListener('click', (e) => act(e.target, async () => { await api(`/customers/${id}/notes`, { method: 'POST', body: { body: $('#note', d).value } }); customerDetail(id, reload); }));
    $('#addT', d).addEventListener('click', (e) => act(e.target, async () => { const due = $('#tDue', d).value; await api('/tasks', { method: 'POST', body: { customer_id: id, title: $('#tTitle', d).value, type: 'callback', due_at: due ? new Date(due).toISOString() : null } }); toast('Đã thêm việc'); customerDetail(id, reload); }));
  }

  // ================================================================ CSM: việc chăm sóc
  let TST = 'open'; let TDUE = 'today';
  VIEWS.tasks = async (el) => {
    el.innerHTML = `<div class="filters"><div class="seg" id="tst">${[['open', 'Cần làm'], ['done', 'Đã xong'], ['skipped', 'Bỏ qua']].map(([k, l]) => `<button data-s="${k}" class="${TST === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="seg" id="tdue">${[['today', 'Đến hạn'], ['', 'Tất cả']].map(([k, l]) => `<button data-s="${k}" class="${TDUE === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="card" id="tlist"></div>
      <p class="muted small">Hệ thống tự tạo việc: hỏi thăm 3 ngày sau khi giao, nhắc mua lại theo chu kỳ dùng của sản phẩm (bột chuối ~25 ngày, gói dùng thử ~14 ngày, chanh leo ~35 ngày).</p>`;
    const TY = { followup: 'Hỏi thăm sau giao', repurchase: 'Nhắc mua lại', review: 'Xin đánh giá', callback: 'Gọi lại', custom: 'Khác' };
    const load = async () => {
      const rows = await api(`/tasks?status=${TST}&due=${TDUE}`);
      $('#tlist').innerHTML = table([
        { h: 'Hạn', f: (t) => `<span class="${toDate(t.due_at) < new Date() && t.status === 'open' ? 'down' : ''}">${dt(t.due_at)}</span>` }, { h: 'Loại', f: (t) => `<span class="badge b-blue">${esc(TY[t.type] || t.type)}</span>` },
        { h: 'Việc', f: (t) => `${esc(t.title)}${t.order_code ? `<div class="muted small">Đơn ${esc(t.order_code)}</div>` : ''}` },
        { h: 'Khách', f: (t) => t.customer_id ? `<a href="#/customers/${t.customer_id}">${esc(t.name || '')}</a><div class="small"><a href="tel:${esc(t.phone)}">${esc(t.phone)}</a> · ${t.orders_count} đơn · ${vnd(t.total_spent)}</div>` : '' },
        { h: 'Kết quả', f: (t) => (t.status === 'open' ? `<input class="inp" data-r="${t.id}" placeholder="Kết quả cuộc gọi" style="width:100%" />` : esc(t.result || '')) },
        { h: '', f: (t) => (t.status === 'open' ? `<div class="nowrap"><button class="btn sm" data-done="${t.id}">Xong</button> <button class="btn ghost sm" data-skip="${t.id}">Bỏ</button></div>` : `<button class="btn ghost sm" data-reopen="${t.id}">Mở lại</button>`) },
      ], rows, { empty: TST === 'open' ? 'Không có việc đến hạn 🎉' : 'Trống' });
      const upd = (id, status, btn) => act(btn, async () => { await api('/tasks/' + id, { method: 'PUT', body: { status, result: $(`[data-r="${id}"]`)?.value || null } }); load(); });
      $$('[data-done]').forEach((b) => b.addEventListener('click', () => upd(b.dataset.done, 'done', b)));
      $$('[data-skip]').forEach((b) => b.addEventListener('click', () => upd(b.dataset.skip, 'skipped', b)));
      $$('[data-reopen]').forEach((b) => b.addEventListener('click', () => upd(b.dataset.reopen, 'open', b)));
    };
    $$('#tst button').forEach((b) => b.addEventListener('click', () => { TST = b.dataset.s; route(); }));
    $$('#tdue button').forEach((b) => b.addEventListener('click', () => { TDUE = b.dataset.s; route(); }));
    await load();
  };

  // ================================================================ Hỗ trợ
  VIEWS.tickets = async (el) => {
    const rows = await api('/tickets');
    $('#topR').innerHTML = '<button class="btn sm" id="newT">+ Ghi nhận yêu cầu</button>';
    const ST = { open: ['Mới', 'b-sun'], processing: ['Đang xử lý', 'b-blue'], resolved: ['Đã xong', 'b-green'] };
    const TP = { 'tu-van': 'Tư vấn', 'khieu-nai': 'Khiếu nại', 'doi-tra': 'Đổi trả', b2b: 'B2B/đại lý', ctv: 'CTV', khac: 'Khác' };
    el.innerHTML = `<div class="card">${table([
      { h: 'Lúc', f: (t) => dt(t.created_at) }, { h: 'Chủ đề', f: (t) => `<span class="badge ${t.topic === 'khieu-nai' ? 'b-red' : 'b-gray'}">${esc(TP[t.topic] || t.topic)}</span>${t.priority === 'high' ? ' <span class="badge b-red">Gấp</span>' : ''}` },
      { h: 'Khách', f: (t) => `${esc(t.name || '')}<div class="small">${esc(t.phone || '')} ${t.order_code ? '· ' + esc(t.order_code) : ''}</div>` },
      { h: 'Nội dung', f: (t) => esc(String(t.message).slice(0, 140)) }, { h: 'Kênh', k: 'channel' }, { h: 'Trạng thái', f: (t) => badge(ST, t.status) },
    ], rows, { click: 1, empty: 'Không có yêu cầu' })}</div>`;
    bindRows(el, rows, (t) => {
      const d = openDrawer('Yêu cầu hỗ trợ', `<div class="card"><dl class="kv"><dt>Khách</dt><dd>${esc(t.name || '')} · <a href="tel:${esc(t.phone)}">${esc(t.phone || '')}</a> ${t.email ? '· ' + esc(t.email) : ''}</dd><dt>Chủ đề</dt><dd>${esc(TP[t.topic] || t.topic)}</dd>${t.order_code ? `<dt>Đơn</dt><dd>${esc(t.order_code)}</dd>` : ''}<dt>Nội dung</dt><dd style="white-space:pre-wrap">${esc(t.message)}</dd></dl></div>
        <div class="card">${form([{ k: 'status', l: 'Trạng thái', t: 'select', s: 3, o: Object.entries(ST).map(([k, v]) => [k, v[0]]) }, { k: 'priority', l: 'Ưu tiên', t: 'select', s: 3, o: [['normal', 'Bình thường'], ['high', 'Gấp'], ['low', 'Thấp']] }, { k: 'reply', l: 'Phản hồi / cách xử lý', t: 'textarea', rows: 4 }], t)}
        <div class="actions"><button class="btn" id="saveT">Lưu</button></div></div>`);
      $('#saveT', d).addEventListener('click', (e) => act(e.target, async () => { await api('/tickets/' + t.id, { method: 'PUT', body: readForm(d) }); toast('Đã lưu'); closeDrawer(); route(); }));
    });
    $('#newT').addEventListener('click', () => {
      const d = openDrawer('Ghi nhận yêu cầu', `<div class="card">${form([{ k: 'name', l: 'Tên', s: 3 }, { k: 'phone', l: 'SĐT', s: 3 }, { k: 'topic', l: 'Chủ đề', t: 'select', s: 2, o: Object.entries(TP) }, { k: 'channel', l: 'Kênh', t: 'select', s: 2, o: [['zalo', 'Zalo'], ['facebook', 'Facebook'], ['phone', 'Điện thoại'], ['tiktok', 'TikTok'], ['shopee', 'Shopee']] }, { k: 'priority', l: 'Ưu tiên', t: 'select', s: 2, o: [['normal', 'Bình thường'], ['high', 'Gấp']] }, { k: 'order_code', l: 'Mã đơn' }, { k: 'message', l: 'Nội dung', t: 'textarea', rows: 4 }], {})}<div class="actions"><button class="btn" id="mkT">Lưu</button></div></div>`);
      $('#mkT', d).addEventListener('click', (e) => act(e.target, async () => { await api('/tickets', { method: 'POST', body: readForm(d) }); closeDrawer(); route(); }));
    });
  };

  // ================================================================ CTV
  let AQ = ''; let AST = '';
  VIEWS.affiliates = async (el, arg) => {
    el.innerHTML = `<div class="filters"><div class="seg" id="ast">${[['', 'Tất cả'], ['active', 'Hoạt động'], ['pending', 'Chờ duyệt'], ['blocked', 'Khoá']].map(([k, l]) => `<button data-s="${k}" class="${AST === k ? 'on' : ''}">${l}</button>`).join('')}</div><input type="search" id="aq" placeholder="Tên, SĐT, mã" value="${esc(AQ)}" /><a class="btn ghost sm" href="/ctv" target="_blank">Trang đăng ký CTV ↗</a></div><div class="card" id="alist"></div>`;
    const load = async () => {
      const { rows, tiers } = await api(`/affiliates?status=${AST}&q=${encodeURIComponent(AQ)}`);
      const AS = { active: ['Hoạt động', 'b-green'], pending: ['Chờ duyệt', 'b-sun'], blocked: ['Khoá', 'b-red'] };
      const tot = rows.reduce((s, r) => s + r.month_sales, 0);
      $('#alist').innerHTML = `<div class="card-h"><span class="muted">${rows.length} CTV · doanh số tháng ${vnd(tot)}</span></div>` + table([
        { h: 'CTV', f: (a) => `<b>${esc(a.name)}</b> <span class="badge b-purple">${esc(a.code)}</span><div class="muted small">${esc(a.phone)} · ${esc(a.province || '')}</div>` },
        { h: 'Hạng', f: (a) => `${esc(a.tier_name)}${a.tier_locked ? ' 🔒' : ''}` }, { h: 'Người giới thiệu', f: (a) => esc(a.parent_code || '—') }, { h: 'F1', num: 1, k: 'f1' },
        { h: 'Doanh số tháng', num: 1, f: (a) => `<b>${vnd(a.month_sales)}</b>` }, { h: 'Tổng doanh số', num: 1, f: (a) => vnd(a.total_sales) },
        { h: 'HH chờ', num: 1, f: (a) => vnd(a.pending) }, { h: 'Số dư ví', num: 1, f: (a) => vnd(Math.max(0, a.balance)) }, { h: 'Trạng thái', f: (a) => badge(AS, a.status) },
      ], rows, { click: 1, empty: 'Chưa có cộng tác viên' });
      bindRows($('#alist'), rows, (a) => affDetail(a.id, tiers, load));
      if (arg) { affDetail(+arg, tiers, load); arg = null; }
    };
    $$('#ast button').forEach((b) => b.addEventListener('click', () => { AST = b.dataset.s; $$('#ast button').forEach((x) => x.classList.toggle('on', x === b)); load().catch(fail); }));
    let t; $('#aq').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { AQ = e.target.value.trim(); load().catch(fail); }, 300); });
    await load();
  };
  async function affDetail(id, tiers, reload) {
    const a = await api('/affiliates/' + id).catch(fail); if (!a) return;
    const d = openDrawer(`${esc(a.name)} <span class="badge b-purple">${esc(a.code)}</span>`, `
      <div class="kpis"><div class="kpi"><small>Số dư rút được</small><b>${vnd(a.wallet.balance)}</b></div><div class="kpi"><small>Hoa hồng chờ</small><b>${vnd(a.wallet.pending)}</b></div><div class="kpi"><small>Đã chi trả</small><b>${vnd(a.wallet.paid)}</b></div><div class="kpi"><small>Khách · tổng chi</small><b>${a.customers.n} · ${vnd(a.customers.spent)}</b></div></div>
      <div class="g2"><div class="card"><dl class="kv"><dt>SĐT</dt><dd><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></dd><dt>Email</dt><dd>${esc(a.email || '—')}</dd><dt>Tỉnh</dt><dd>${esc(a.province || '—')}</dd>
        <dt>Kênh bán</dt><dd>${esc(a.channel_note || '—')}</dd><dt>Ngân hàng</dt><dd>${esc([a.bank_name, a.bank_account, a.bank_holder].filter(Boolean).join(' · ') || '—')}</dd>
        <dt>Tham gia</dt><dd>${dd(a.created_at)}</dd><dt>Đăng nhập cuối</dt><dd>${dt(a.last_login) || '—'}</dd><dt>Link</dt><dd><code>${location.origin}/?ref=${esc(a.code)}</code></dd></dl></div>
      <div class="card">${form([
        { k: 'status', l: 'Trạng thái', t: 'select', s: 3, o: [['active', 'Hoạt động'], ['pending', 'Chờ duyệt'], ['blocked', 'Khoá']] }, { k: 'tier', l: 'Hạng', t: 'select', s: 3, o: tiers.map((t) => [t.id, `${t.name} (${t.direct}%)`]) },
        { k: 'tier_locked', l: 'Khoá hạng (không tự xét)', t: 'check', s: 6 }, { k: 'parent_code', l: 'Mã người giới thiệu', get: (v) => v.parent_code || '' }, { k: 'admin_note', l: 'Ghi chú nội bộ', t: 'textarea', rows: 2 },
      ], a)}<div class="actions"><button class="btn sm" id="saveA">Lưu</button></div></div></div>
      <div class="card"><h3>Đội nhóm</h3>${a.f1.length ? `<div class="tree"><ul>${a.f1.map((x) => `<li><b>${esc(x.name)}</b> <span class="muted small">F1 · ${esc(x.code)}</span>${a.f2.filter((y) => y.parent_id === x.id).length ? `<ul>${a.f2.filter((y) => y.parent_id === x.id).map((y) => `<li>${esc(y.name)} <span class="muted small">F2 · ${esc(y.code)}</span></li>`).join('')}</ul>` : ''}</li>`).join('')}</ul></div>` : '<p class="muted">Chưa có thành viên</p>'}</div>
      <div class="card"><h3>Hoa hồng</h3>${table([{ h: 'Đơn', f: (c) => `<a href="#/orders/${c.order_id}">${esc(c.code)}</a>` }, { h: 'Cấp', f: (c) => esc(c.level_name) }, { h: 'Doanh số', num: 1, f: (c) => vnd(c.base) }, { h: '%', num: 1, k: 'rate' }, { h: 'Hoa hồng', num: 1, f: (c) => vnd(c.amount) }, { h: 'Trạng thái', k: 'status' }, { h: 'Lúc', f: (c) => dd(c.created_at) }], a.commissions)}</div>
      <div class="card"><h3>Rút tiền</h3>${table([{ h: 'Lúc', f: (w) => dd(w.created_at) }, { h: 'Số tiền', num: 1, f: (w) => vnd(w.amount) }, { h: 'Trạng thái', k: 'status' }, { h: 'Ghi chú', f: (w) => esc(w.admin_note || w.note || '') }], a.withdrawals)}</div>`);
    $('#saveA', d).addEventListener('click', (e) => act(e.target, async () => { const b = readForm($('.g2 .form', d)); b.parent_code = b.parent_code.trim().toUpperCase(); await api('/affiliates/' + id, { method: 'PUT', body: b }); toast('Đã lưu'); reload && reload(); affDetail(id, tiers, reload); }));
  }

  VIEWS.commissions = async (el) => {
    let st = '';
    el.innerHTML = `<div class="filters"><div class="seg" id="cst">${[['', 'Tất cả'], ['pending', 'Chờ (đơn chưa xong)'], ['available', 'Khả dụng'], ['void', 'Đã huỷ']].map(([k, l]) => `<button data-s="${k}" class="${k === st ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="card" id="cml"></div>
      <p class="muted small">Hoa hồng tạo khi đơn được thanh toán (QR) hoặc đặt COD, chuyển khả dụng sau ${esc(SETTINGS?.affiliate?.hold_days ?? 7)} ngày kể từ khi đơn hoàn tất, tự huỷ nếu đơn huỷ hoặc hoàn.</p>`;
    const load = async () => {
      const rows = await api('/commissions' + (st ? '?status=' + st : ''));
      const sum = rows.filter((r) => r.status !== 'void').reduce((s, r) => s + r.amount, 0);
      $('#cml').innerHTML = `<div class="card-h"><span class="muted">${rows.length} dòng · ${vnd(sum)}</span></div>` + table([
        { h: 'Lúc', f: (c) => dd(c.created_at) }, { h: 'Đơn', f: (c) => `<a href="#/orders/${c.order_id}">${esc(c.order_code)}</a> ${badge(STATUS, c.order_status)}` }, { h: 'CTV', f: (c) => `<a href="#/affiliates/${c.affiliate_id}">${esc(c.name)}</a> <span class="muted small">${esc(c.code)}</span>` },
        { h: 'Cấp', f: (c) => `<span class="badge ${c.level ? 'b-purple' : 'b-green'}">${esc(c.level_name)}</span>` }, { h: 'Doanh số', num: 1, f: (c) => vnd(c.base) }, { h: '%', num: 1, k: 'rate' }, { h: 'Hoa hồng', num: 1, f: (c) => `<b>${vnd(c.amount)}</b>` },
        { h: 'Trạng thái', f: (c) => esc(c.status) + (c.available_at && c.status === 'pending' ? `<div class="muted small">${dd(c.available_at)}</div>` : '') },
      ], rows);
    };
    $$('#cst button').forEach((b) => b.addEventListener('click', () => { st = b.dataset.s; $$('#cst button').forEach((x) => x.classList.toggle('on', x === b)); load().catch(fail); }));
    await load();
  };

  VIEWS.withdrawals = async (el) => {
    let st = 'requested';
    el.innerHTML = `<div class="filters"><div class="seg" id="wst">${[['requested', 'Chờ duyệt'], ['approved', 'Đã duyệt, chờ chuyển'], ['paid', 'Đã chuyển'], ['rejected', 'Từ chối'], ['', 'Tất cả']].map(([k, l]) => `<button data-s="${k}" class="${k === st ? 'on' : ''}">${l}</button>`).join('')}</div></div><div class="card" id="wl"></div>
      <p class="muted small">Quy trình: duyệt → quét mã VietQR để chuyển khoản đúng số tài khoản CTV → bấm "Đã chuyển". Ngày chi trả: ${esc(SETTINGS?.affiliate?.payout_days || '')}.</p>`;
    const WS = { requested: ['Chờ duyệt', 'b-sun'], approved: ['Đã duyệt', 'b-blue'], paid: ['Đã chuyển', 'b-green'], rejected: ['Từ chối', 'b-red'] };
    const load = async () => {
      const rows = await api('/withdrawals' + (st ? '?status=' + st : ''));
      $('#wl').innerHTML = `<div class="card-h"><span class="muted">${rows.length} lệnh · ${vnd(rows.reduce((s, r) => s + r.amount, 0))}</span></div>` + table([
        { h: 'Lúc', f: (w) => dt(w.created_at) }, { h: 'CTV', f: (w) => `<a href="#/affiliates/${w.affiliate_id}">${esc(w.name)}</a><div class="muted small">${esc(w.code)} · ${esc(w.phone)}</div>` },
        { h: 'Số tiền', num: 1, f: (w) => `<b>${vnd(w.amount)}</b>` }, { h: 'Tài khoản', f: (w) => `${esc(w.bank_name)}<div class="small">${esc(w.bank_account)} · ${esc(w.bank_holder)}</div>` },
        { h: 'Trạng thái', f: (w) => badge(WS, w.status) + (w.processed_by ? `<div class="muted small">${esc(w.processed_by)} · ${dd(w.processed_at)}</div>` : '') }, { h: 'Ghi chú', f: (w) => esc(w.admin_note || w.note || '') },
      ], rows, { click: 1, empty: 'Không có lệnh rút' });
      bindRows($('#wl'), rows, (w) => {
        const bin = bankBin(w.bank_name);
        const qr = bin ? `https://img.vietqr.io/image/${bin}-${encodeURIComponent(w.bank_account)}-compact2.png?amount=${w.amount}&addInfo=${encodeURIComponent('DALA HH ' + w.code + ' ' + w.id)}&accountName=${encodeURIComponent(w.bank_holder || '')}` : '';
        const d = openDrawer(`Lệnh rút #${w.id}`, `<div class="card"><div class="qr-pay">${qr ? `<img src="${qr}" alt="VietQR chuyển khoản" />` : ''}<dl class="kv"><dt>CTV</dt><dd>${esc(w.name)} (${esc(w.code)})</dd><dt>Số tiền</dt><dd><b>${vnd(w.amount)}</b></dd><dt>Ngân hàng</dt><dd>${esc(w.bank_name)}</dd><dt>Số TK</dt><dd><b>${esc(w.bank_account)}</b></dd><dt>Chủ TK</dt><dd>${esc(w.bank_holder)}</dd><dt>Nội dung</dt><dd>DALA HH ${esc(w.code)} ${w.id}</dd></dl></div>
          ${!qr ? '<p class="muted small">Chưa nhận diện được ngân hàng để tạo VietQR, chuyển khoản thủ công theo thông tin trên.</p>' : ''}
          ${['requested', 'approved'].includes(w.status) ? `<div class="form" style="margin-top:12px"><div class="f"><label>Ghi chú (mã giao dịch, lý do từ chối)</label><input id="wNote" /></div></div><div class="actions">${w.status === 'requested' ? '<button class="btn ghost" data-ws="approved">Duyệt</button>' : ''}<button class="btn" data-ws="paid">Đã chuyển tiền</button><button class="btn red" data-ws="rejected">Từ chối</button></div>` : ''}</div>`);
        $$('[data-ws]', d).forEach((b) => b.addEventListener('click', () => act(b, async () => {
          if (b.dataset.ws === 'paid' && !confirm(`Xác nhận đã chuyển ${vnd(w.amount)} cho ${w.name}?`)) return;
          await api('/withdrawals/' + w.id, { method: 'PUT', body: { status: b.dataset.ws, admin_note: $('#wNote', d).value } }); toast('Đã cập nhật'); closeDrawer(); load();
        })));
      });
    };
    $$('#wst button').forEach((b) => b.addEventListener('click', () => { st = b.dataset.s; $$('#wst button').forEach((x) => x.classList.toggle('on', x === b)); load().catch(fail); }));
    await load();
  };
  function bankBin(name) {
    const n = String(name || '').toLowerCase().replace(/\s|bank|ngân hàng/g, '');
    const M = { vietcom: '970436', vcb: '970436', vietin: '970415', ctg: '970415', bidv: '970418', agri: '970405', techcom: '970407', tcb: '970407', mb: '970422', quandoi: '970422', acb: '970416', vp: '970432', tp: '970423', sacom: '970403', stb: '970403', vib: '970441', hd: '970437', shb: '970443', ocb: '970448', msb: '970426', hanghai: '970426', sea: '970440', lienviet: '970449', lpb: '970449', nama: '970428', baca: '970409', cake: '546034', timo: '963388', eximbank: '970431', exim: '970431', pvcom: '970412', scb: '970429', abbank: '970425', ab: '970425', kienlong: '970452', vietcapital: '970454', bvb: '970454', bacabank: '970409', dongaa: '970406' };
    const k = Object.keys(M).sort((a, b) => b.length - a.length).find((x) => n.includes(x));
    return k ? M[k] : null;
  }

  // ================================================================ Lô hàng & QR
  VIEWS.lots = async (el) => {
    const [rows, ps] = await Promise.all([api('/lots'), products()]);
    $('#topR').innerHTML = '<button class="btn sm" id="newL">+ Thêm lô</button>';
    el.innerHTML = `<div class="card">${table([
      { h: 'Mã lô', f: (l) => `<b>${esc(l.code)}</b>` }, { h: 'Sản phẩm', f: (l) => esc((l.product_name || '') + ' ' + (l.product_subtitle || '')) }, { h: 'Vườn', f: (l) => `${esc(l.farm || '')}<div class="muted small">${esc(l.region || '')} · ${esc(l.farm_code || '')}</div>` },
      { h: 'Thu hái', f: (l) => esc(l.harvest_date || '') }, { h: 'HSD', f: (l) => esc(l.expiry_date || '') }, { h: 'Lượt quét', num: 1, k: 'scans' },
      { h: 'QR', f: (l) => `<a href="https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&data=${encodeURIComponent(location.origin + '/lo/' + l.code)}" target="_blank" rel="noopener">Tải QR ↗</a> · <a href="/lo/${esc(l.code)}" target="_blank">Xem</a>` },
    ], rows, { click: 1 })}</div><p class="muted small">Mã QR in ở mặt trước bao bì dẫn tới /lo/MÃ-LÔ. Có thể đồng bộ dữ liệu vườn từ FarmBase (nhập tay mã vùng trồng, nhật ký, phiếu kiểm nghiệm).</p>`;
    const f = (l) => {
      const d = openDrawer(l.id ? 'Sửa lô ' + esc(l.code) : 'Thêm lô', `<div class="card">${form([
        { k: 'code', l: 'Mã lô', s: 2, ph: 'DL-CL-2612A' }, { k: 'product_id', l: 'Sản phẩm', t: 'select', s: 4, o: [['', '—'], ...ps.map((p) => [p.id, `${p.sku} · ${p.name} ${p.subtitle || ''}`])] },
        { k: 'farm', l: 'Tên vườn', s: 3 }, { k: 'farmer', l: 'Nông hộ', s: 3 }, { k: 'region', l: 'Vùng', s: 3 }, { k: 'farm_code', l: 'Mã số vùng trồng', s: 3 },
        { k: 'harvest_date', l: 'Ngày thu hái', t: 'date', s: 2 }, { k: 'process_date', l: 'Ngày chế biến', t: 'date', s: 2 }, { k: 'expiry_date', l: 'Hạn dùng', t: 'date', s: 2 },
        { k: 'lab_summary', l: 'Tóm tắt kiểm nghiệm', t: 'textarea', rows: 2 }, { k: 'lab_url', l: 'Link phiếu kiểm nghiệm', s: 3 }, { k: 'video_url', l: 'Link video vườn', s: 3 }, { k: 'photo_url', l: 'Ảnh vườn', s: 3 }, { k: 'note', l: 'Ghi chú', s: 3 },
      ], l)}<div class="actions"><button class="btn" id="saveL">Lưu</button></div></div>`);
      $('#saveL', d).addEventListener('click', (e) => act(e.target, async () => { await api(l.id ? '/lots/' + l.id : '/lots', { method: l.id ? 'PUT' : 'POST', body: readForm(d) }); toast('Đã lưu lô'); closeDrawer(); route(); }));
    };
    bindRows(el, rows, f); $('#newL').addEventListener('click', () => f({}));
  };

  // ================================================================ Bài viết
  VIEWS.posts = async (el) => {
    const rows = await api('/posts');
    $('#topR').innerHTML = '<button class="btn sm" id="newPo">+ Viết bài</button>';
    el.innerHTML = `<div class="card">${table([{ h: 'Tiêu đề', f: (p) => `<b>${esc(p.title)}</b><div class="muted small">/blog/${esc(p.slug)}</div>` }, { h: 'Ngày', f: (p) => dd(p.created_at) }, { h: '', f: (p) => (p.published ? '<span class="badge b-green">Đã đăng</span>' : '<span class="badge b-gray">Nháp</span>') }], rows, { click: 1 })}</div>`;
    const f = (p) => {
      const d = openDrawer(p.id ? 'Sửa bài' : 'Viết bài', `<div class="card">${form([
        { k: 'title', l: 'Tiêu đề' }, { k: 'slug', l: 'Đường dẫn', s: 3, h: 'Để trống để tự tạo' }, { k: 'cover', l: 'Ảnh bìa', s: 3 }, { k: 'excerpt', l: 'Tóm tắt', t: 'textarea', rows: 2 },
        { k: 'body', l: 'Nội dung (Markdown đơn giản: ## tiêu đề, - gạch đầu dòng, **đậm**)', t: 'textarea', rows: 14 }, { k: 'seo_title', l: 'Tiêu đề SEO', s: 3 }, { k: 'seo_desc', l: 'Mô tả SEO', s: 3 }, { k: 'published', l: 'Đăng', t: 'check' },
      ], p)}<div class="actions"><button class="btn" id="saveP">Lưu</button>${p.id ? `<a class="btn ghost" href="/blog/${esc(p.slug)}" target="_blank">Xem ↗</a><button class="btn red" id="delP">Xoá</button>` : ''}</div></div>`);
      $('#saveP', d).addEventListener('click', (e) => act(e.target, async () => { await api(p.id ? '/posts/' + p.id : '/posts', { method: p.id ? 'PUT' : 'POST', body: readForm(d) }); toast('Đã lưu'); closeDrawer(); route(); }));
      $('#delP', d)?.addEventListener('click', (e) => act(e.target, async () => { if (!confirm('Xoá bài viết?')) return; await api('/posts/' + p.id, { method: 'DELETE' }); closeDrawer(); route(); }));
    };
    bindRows(el, rows, f); $('#newPo').addEventListener('click', () => f({ published: 1 }));
  };

  // ================================================================ SEO
  VIEWS.seo = async (el) => {
    const a = await api('/seo-audit');
    el.innerHTML = `<div class="g21"><div class="card"><div class="card-h"><h2>Các trang cần tối ưu</h2></div>${table([
      { h: 'Loại', k: 'type' }, { h: 'Trang', f: (i) => `<a href="${esc(i.url)}" target="_blank">${esc(i.name)}</a>` },
      { h: 'Vấn đề', f: (i) => (i.issues.length ? i.issues.map((x) => `<div class="small">⚠️ ${esc(x)}</div>`).join('') : '<span class="badge b-green">Tốt</span>') },
      { h: '', f: (i) => `<a href="#/${i.type === 'Sản phẩm' ? 'products' : 'posts'}" class="small">Sửa</a>` },
    ], a.items)}</div>
    <div><div class="card" style="display:flex;gap:16px;align-items:center"><div class="score" style="--p:${a.score}"><span>${a.score}</span></div><div><b>Điểm SEO</b><p class="muted small" style="margin:0">Theo độ dài tiêu đề/mô tả, ảnh, nội dung và cấu hình đo lường.</p></div></div>
    <div class="card"><h3>Cấu hình chung</h3><ul class="check">${a.global.map((g) => `<li>${g.ok ? '✅' : '⬜'} ${esc(g.text)}</li>`).join('')}</ul><a href="#/settings" class="btn ghost sm" style="margin-top:8px">Cài GA4, Pixel, Search Console</a></div>
    <div class="card"><h3>Đã có sẵn</h3><ul class="check small"><li>✅ URL tiếng Việt không dấu, canonical, Open Graph</li><li>✅ Sitemap.xml, robots.txt tự động</li><li>✅ JSON-LD: Product, Offer, Breadcrumb, FAQ, Article, Organization</li><li>✅ Ảnh WebP, tải lười, CSS nội tuyến (tốc độ)</li></ul></div></div></div>`;
  };

  // ================================================================ Analytics
  VIEWS.analytics = async (el) => {
    const a = await api('/analytics?days=' + DAYS);
    $('#topR').innerHTML = daysSeg(DAYS);
    const pts = a.daily.map((r) => ({ l: r.d.slice(8, 10) + '/' + r.d.slice(5, 7), t: r.d.split('-').reverse().join('/'), v: r.sessions }));
    el.innerHTML = `<div class="kpis"><div class="kpi"><small>Phiên</small><b>${num(a.daily.reduce((s, r) => s + r.sessions, 0))}</b></div><div class="kpi"><small>Lượt xem trang</small><b>${num(a.daily.reduce((s, r) => s + r.views, 0))}</b></div><div class="kpi"><small>Lượt quét QR</small><b>${num(a.qr_scans)}</b><span class="muted small">${a.qr_rate}% so với số đơn</span></div></div>
      <div class="card"><div class="card-h"><h2>Phiên truy cập theo ngày</h2></div>${barChart(pts, { fmt: num })}</div>
      <div class="g2">
        <div class="card"><h2>Nguồn truy cập</h2>${table([{ h: 'Nguồn', f: (s) => esc(s.source) + (s.medium ? ` <span class="muted small">/ ${esc(s.medium)}</span>` : '') }, { h: 'Phiên', num: 1, k: 'sessions' }, { h: 'Đơn', num: 1, k: 'orders' }, { h: 'Doanh thu', num: 1, f: (s) => vnd(s.revenue) }, { h: 'CR', num: 1, f: (s) => (s.sessions ? ((100 * s.orders) / s.sessions).toFixed(1) + '%' : '') }], a.sources)}</div>
        <div class="card"><h2>Trang xem nhiều</h2>${table([{ h: 'Trang', f: (p) => `<a href="${esc(p.path)}" target="_blank">${esc(p.path)}</a>` }, { h: 'Lượt xem', num: 1, k: 'views' }, { h: 'Người xem', num: 1, k: 'visitors' }], a.pages)}</div>
      </div>
      <div class="g2">
        <div class="card"><h2>Sản phẩm: xem → thêm giỏ</h2>${table([{ h: 'Sản phẩm', f: (p) => esc(p.name + ' ' + (p.subtitle || '')) }, { h: 'Xem', num: 1, k: 'views' }, { h: 'Thêm giỏ', num: 1, k: 'carts' }, { h: 'Tỷ lệ', num: 1, f: (p) => (p.views ? Math.round((100 * p.carts) / p.views) + '%' : '') }], a.products)}</div>
        <div class="card"><h2>Link cộng tác viên</h2>${table([{ h: 'Mã', f: (r) => `<b>${esc(r.ref)}</b> <span class="muted small">${esc(r.name || '')}</span>` }, { h: 'Người xem', num: 1, k: 'visitors' }, { h: 'Đơn', num: 1, k: 'orders' }], a.refs)}</div>
      </div>
      <div class="g3">
        <div class="card"><h2>Thiết bị</h2>${hbars(a.devices.map((d) => ({ l: d.device === 'mobile' ? 'Điện thoại' : d.device === 'desktop' ? 'Máy tính' : d.device, v: d.n })), { fmt: num })}</div>
        <div class="card"><h2>Chiến dịch (UTM)</h2>${table([{ h: 'Chiến dịch', k: 'campaign' }, { h: 'Đơn', num: 1, k: 'orders' }, { h: 'Doanh thu', num: 1, f: (r) => vnd(r.revenue) }], a.utm, { empty: 'Gắn ?utm_campaign= vào link quảng cáo để đo' })}</div>
        <div class="card"><h2>Lô được quét nhiều</h2>${table([{ h: 'Lô', k: 'code' }, { h: 'Sản phẩm', f: (r) => esc(r.name || '') }, { h: 'Quét', num: 1, k: 'scans' }], a.qr)}</div>
      </div>
      <p class="muted small">Số liệu đo bằng hệ thống riêng (không cookie bên thứ ba). Gắn thêm GA4, Meta Pixel, TikTok Pixel ở Cài đặt để chạy quảng cáo chuyển đổi.</p>`;
    bindTips(el);
    $$('#days button').forEach((b) => b.addEventListener('click', () => { DAYS = +b.dataset.d; route(); }));
  };

  // ================================================================ Cài đặt
  VIEWS.settings = async (el) => {
    const s = await api('/settings'); SETTINGS = s;
    const shop = s.shop || {}, ship = s.shipping || {}, pay = s.payment || {}, aff = s.affiliate || {}, seo = s.seo || {};
    const isAdmin = ME.role === 'admin';
    el.innerHTML = `
      <div class="g2">
        <div class="card" id="sShop"><h2>Cửa hàng</h2>${form([{ k: 'name', l: 'Tên', s: 2 }, { k: 'legal_name', l: 'Tên pháp lý', s: 4 }, { k: 'slogan', l: 'Slogan' }, { k: 'hotline', l: 'Hotline', s: 2 }, { k: 'zalo', l: 'Zalo', s: 2 }, { k: 'email', l: 'Email', s: 2 }, { k: 'address', l: 'Địa chỉ' }, { k: 'facebook', l: 'Facebook', s: 3 }, { k: 'zalo_oa', l: 'Zalo OA', s: 3 }, { k: 'tiktok_shop', l: 'TikTok Shop', s: 3 }, { k: 'shopee_shop', l: 'Shopee', s: 3 }], shop)}</div>
        <div class="card" id="sPay"><h2>Thanh toán ${s.status.thuchi ? '<span class="badge b-green">SePay đã kết nối</span>' : '<span class="badge b-sun">SePay chưa kết nối</span>'}</h2>
          ${form([{ k: 'online_enabled', l: 'Bật chuyển khoản QR (SePay)', t: 'check', s: 3 }, { k: 'cod_enabled', l: 'Bật COD', t: 'check', s: 3 }, { k: 'cod_max', l: 'COD tối đa (đ)', t: 'number', s: 3 }, { k: 'expire_minutes', l: 'Huỷ đơn QR chưa trả sau (phút)', t: 'number', s: 3 },
            { k: 'thuchi_base', l: 'Địa chỉ hệ thống Thu-Chi (SePay)', ph: 'https://sepay-thuchi.minhducuy.workers.dev', h: 'Tạo API key trong Thu-Chi: Cài đặt → API keys' }], pay)}
          <div class="form" style="margin-top:8px"><div class="f s4"><label>API key Thu-Chi ${s.secrets.thuchi_api_key ? `(đang dùng ${esc(s.secrets.thuchi_api_key)})` : ''}</label><input id="kThuchi" type="password" placeholder="Dán API key mới" autocomplete="off" /></div><div class="f s2" style="align-self:end"><button class="btn ghost sm" id="testThuchi">Lưu & kiểm tra</button></div></div>
          <details style="margin-top:10px"><summary class="muted small">Tài khoản dự phòng (khi chưa có SePay)</summary>${form([{ k: 'bank', l: 'Mã ngân hàng (VD: VCB, MB)', s: 2, get: (v) => v.bank?.bank }, { k: 'account', l: 'Số tài khoản', s: 2, get: (v) => v.bank?.account }, { k: 'holder', l: 'Chủ tài khoản', s: 2, get: (v) => v.bank?.holder }], pay).replace('class="form"', 'class="form" id="sBank"')}</details>
        </div>
      </div>
      <div class="card" id="sShip"><h2>Giao hàng ${s.status.goship ? '<span class="badge b-green">Goship đã kết nối</span>' : '<span class="badge b-sun">Goship chưa kết nối, đang dùng bảng phí dự phòng</span>'}</h2>
        ${form([{ k: 'free_threshold', l: 'Miễn phí ship từ (đ)', t: 'number', s: 2 }, { k: 'fragile_fee', l: 'Phụ phí hàng dễ vỡ (đ)', t: 'number', s: 2 }, { k: 'packaging_weight', l: 'Khối lượng bao bì (g)', t: 'number', s: 1 }, { k: 'fragile_padding_cm', l: 'Đệm chống sốc (cm)', t: 'number', s: 1 },
          { k: 'pick', l: 'Hãng mặc định cho khách', t: 'select', s: 3, o: [['cheapest', 'Rẻ nhất'], ['fastest', 'Nhanh nhất'], ['best', 'Tỷ lệ giao thành công cao nhất']] }, { k: 'goship_env', l: 'Môi trường Goship', t: 'select', s: 3, o: [['sandbox', 'Sandbox (thử)'], ['production', 'Thật']] }], ship)}
        <h3 style="margin-top:14px">Địa chỉ lấy hàng</h3>
        <div class="form" id="sOrigin"><div class="f s2"><label>Tên người gửi</label><input name="name" value="${esc(ship.origin?.name || '')}" /></div><div class="f s2"><label>SĐT</label><input name="phone" value="${esc(ship.origin?.phone || '')}" /></div><div class="f s2"><label>Số nhà, đường</label><input name="street" value="${esc(ship.origin?.street || '')}" /></div>
          <div class="f s2"><label>Tỉnh/TP</label><select name="city" id="oCity"><option value="">${s.status.goship ? 'Đang tải…' : 'Cần kết nối Goship'}</option></select></div><div class="f s2"><label>Quận/Huyện</label><select name="district" id="oDist"></select></div><div class="f s2"><label>Phường/Xã</label><select name="ward" id="oWard"></select></div></div>
        <h3 style="margin-top:14px">Kết nối Goship</h3>
        <p class="muted small">Đăng nhập bằng tài khoản Goship và client_id / client_secret (lấy trong Goship → Cài đặt → API). Token được lưu mã hoá phía máy chủ. Webhook cập nhật trạng thái vận đơn: <code>${esc(s.webhook_url)}</code></p>
        <div class="form" id="gLogin"><div class="f s3"><label>Email/SĐT Goship</label><input name="username" autocomplete="off" /></div><div class="f s3"><label>Mật khẩu</label><input name="password" type="password" autocomplete="new-password" /></div><div class="f s2"><label>client_id</label><input name="client_id" /></div><div class="f s3"><label>client_secret ${s.secrets.goship_client_secret ? '(đã lưu)' : ''}</label><input name="client_secret" type="password" autocomplete="off" /></div><div class="f s1" style="align-self:end"><button class="btn ghost sm" id="gDo">Kết nối</button></div></div>
        <details style="margin-top:8px"><summary class="muted small">Hoặc dán access token Goship có sẵn</summary><div class="form" style="margin-top:8px"><div class="f s4"><input id="gTok" type="password" placeholder="access_token" /></div><div class="f s2"><button class="btn ghost sm" id="gTokSave">Lưu token</button></div></div></details>
        <div class="actions"><button class="btn ghost sm" id="gTest">Kiểm tra kết nối Goship</button><button class="btn ghost sm" id="qTest">Thử tính phí: 2 bột chuối + 1 cốt về Hà Nội</button></div><div id="qRes" class="small"></div>
      </div>
      <div class="card" id="sAff"><h2>Cộng tác viên & hoa hồng</h2>
        <div class="tbl-wrap"><table class="t" id="tiers"><thead><tr><th>Hạng</th><th>Doanh số tháng từ (đ)</th><th>Trực tiếp %</th><th>Gián tiếp 1 %</th><th>Gián tiếp 2 %</th></tr></thead><tbody>${(aff.tiers || []).map((t) => `<tr data-id="${t.id}"><td><input class="inp" data-k="name" value="${esc(t.name)}" /></td><td><input class="inp" type="number" data-k="min_sales" value="${t.min_sales}" /></td><td><input class="inp" type="number" step="any" data-k="direct" value="${t.direct}" /></td><td><input class="inp" type="number" step="any" data-k="l1" value="${t.l1}" /></td><td><input class="inp" type="number" step="any" data-k="l2" value="${t.l2}" /></td></tr>`).join('')}</tbody></table></div>
        <div style="margin-top:10px">${form([{ k: 'hold_days', l: 'Giữ hoa hồng sau khi giao (ngày)', t: 'number', s: 2 }, { k: 'min_withdraw', l: 'Rút tối thiểu (đ)', t: 'number', s: 2 }, { k: 'payout_days', l: 'Ngày chi trả', s: 2 }, { k: 'cookie_days', l: 'Lưu link giới thiệu (ngày)', t: 'number', s: 2 }, { k: 'buyer_discount_pct', l: 'Khách nhập mã CTV được giảm (%)', t: 'number', s: 2 }, { k: 'lifetime_binding', l: 'Khách gắn trọn đời với CTV đầu tiên', t: 'check', s: 2 }, { k: 'auto_approve', l: 'Tự duyệt CTV mới', t: 'check', s: 2 }], aff)}</div>
      </div>
      <div class="card" id="sSeo"><h2>SEO & đo lường</h2>${form([{ k: 'title', l: 'Tiêu đề trang chủ' }, { k: 'description', l: 'Mô tả trang chủ', t: 'textarea', rows: 2 }, { k: 'keywords', l: 'Từ khoá' }, { k: 'og_image', l: 'Ảnh chia sẻ (OG)', s: 3 }, { k: 'ga4', l: 'GA4 Measurement ID (G-XXXX)', s: 3 }, { k: 'gsc_verify', l: 'Mã xác minh Search Console', s: 2 }, { k: 'fb_pixel', l: 'Meta Pixel ID', s: 2 }, { k: 'tiktok_pixel', l: 'TikTok Pixel ID', s: 2 }, { k: 'head_extra', l: 'Mã chèn thêm vào <head>', t: 'textarea', rows: 2 }], seo)}</div>
      ${isAdmin ? '<div class="actions" style="position:sticky;bottom:10px"><button class="btn sun" id="saveS">💾 Lưu tất cả cài đặt</button></div>' : '<p class="muted">Chỉ quản trị viên được sửa cài đặt.</p>'}
      <div class="card" style="margin-top:16px" id="users"><h2>Người dùng quản trị</h2><div id="ulist"></div></div>`;

    // địa chỉ lấy hàng theo Goship
    const o = ship.origin || {};
    const fill = async (sel, url, cur) => { try { const r = await fetch(url).then((x) => x.json()); const items = r.items || []; sel.innerHTML = '<option value="">—</option>' + items.map((i) => `<option value="${esc(i.id)}" ${String(i.id) === String(cur) ? 'selected' : ''}>${esc(i.name)}</option>`).join(''); } catch {} };
    if (s.status.goship) {
      await fill($('#oCity'), '/api/geo/cities', o.city);
      if (o.city) await fill($('#oDist'), '/api/geo/districts?city=' + o.city, o.district);
      if (o.district) await fill($('#oWard'), '/api/geo/wards?district=' + o.district, o.ward);
      $('#oCity').addEventListener('change', (e) => { $('#oWard').innerHTML = ''; fill($('#oDist'), '/api/geo/districts?city=' + e.target.value); });
      $('#oDist').addEventListener('change', (e) => fill($('#oWard'), '/api/geo/wards?district=' + e.target.value));
    }

    $('#testThuchi').addEventListener('click', (e) => act(e.target, async () => {
      const k = $('#kThuchi').value.trim();
      if ($('#sPay [name=thuchi_base]').value) await saveAll(true);
      if (k) await api('/settings/secret', { method: 'POST', body: { key: 'thuchi_api_key', value: k } });
      const r = await api('/integrations/thuchi/test', { method: 'POST' });
      toast(r.ok ? `Kết nối SePay OK${r.accounts ? ' · ' + r.accounts + ' tài khoản' : ''}` : 'Chưa kết nối được: ' + (r.error || ''), !r.ok);
    }));
    $('#gDo').addEventListener('click', (e) => act(e.target, async () => { await api('/integrations/goship/login', { method: 'POST', body: { ...readForm($('#gLogin')), goship_env: $('#sShip [name=goship_env]').value } }); await saveAll(true); toast('Đã kết nối Goship'); route(); }));
    $('#gTokSave').addEventListener('click', (e) => act(e.target, async () => { await api('/settings/secret', { method: 'POST', body: { key: 'goship_token', value: $('#gTok').value.trim() } }); toast('Đã lưu token'); route(); }));
    $('#gTest').addEventListener('click', (e) => act(e.target, async () => { const r = await api('/integrations/goship/test', { method: 'POST' }); toast(`Goship OK · ${r.cities} tỉnh/thành`); }));
    $('#qTest').addEventListener('click', (e) => act(e.target, async () => {
      const r = await api('/shipping/quote', { method: 'POST', body: { items: [{ sku: 'BCX-350', qty: 2 }, { sku: 'COT-250', qty: 1 }], to: { province: 'Hà Nội', city: '100000' }, amount: 323000 } });
      $('#qRes').innerHTML = `<p>Kiện: ${num(r.parcel.weight)}g · ${r.parcel.length}×${r.parcel.width}×${r.parcel.height}cm${r.parcel.fragile ? ' · dễ vỡ' : ''}</p>` + r.options.map((x) => `<div>${esc(x.carrier)} ${esc(x.service || '')}: <b>${vnd(x.fee)}</b> ${esc(x.expected || '')}</div>`).join('');
    }));

    async function saveAll(quiet) {
      const tiers = $$('#tiers tbody tr').map((tr) => { const t = { id: +tr.dataset.id }; $$('[data-k]', tr).forEach((i) => (t[i.dataset.k] = i.type === 'number' ? Number(i.value) : i.value)); return t; });
      const bank = readForm($('#sBank'));
      const body = {
        shop: { ...shop, ...readForm($('#sShop')) },
        payment: { ...pay, ...readForm($('#sPay > .form')), bank },
        shipping: { ...ship, ...readForm($('#sShip > .form')), origin: { ...readForm($('#sOrigin')), city_name: $('#oCity').selectedOptions[0]?.text || '', district_name: $('#oDist').selectedOptions[0]?.text || '', ward_name: $('#oWard').selectedOptions[0]?.text || '' } },
        affiliate: { ...aff, ...readForm($('#sAff .form')), tiers },
        seo: { ...seo, ...readForm($('#sSeo')) },
      };
      await api('/settings', { method: 'PUT', body });
      if (!quiet) toast('Đã lưu cài đặt');
    }
    $('#saveS')?.addEventListener('click', (e) => act(e.target, () => saveAll()));

    // người dùng
    const loadUsers = async () => {
      if (!isAdmin) { $('#ulist').innerHTML = `<div class="form"><div class="f s3"><label>Đổi mật khẩu của bạn</label><input id="myPw" type="password" autocomplete="new-password" /></div><div class="f s2" style="align-self:end"><button class="btn ghost sm" id="myPwB">Đổi</button></div></div>`; $('#myPwB').onclick = (e) => act(e.target, async () => { await api('/users/' + ME.id, { method: 'PUT', body: { password: $('#myPw').value } }); toast('Đã đổi mật khẩu'); }); return; }
      const us = await api('/users');
      const R = { admin: 'Quản trị', ops: 'Vận hành', viewer: 'Chỉ xem' };
      $('#ulist').innerHTML = table([{ h: 'Tên đăng nhập', f: (u) => `<b>${esc(u.username)}</b> ${u.id === ME.id ? '(bạn)' : ''}` }, { h: 'Tên', k: 'name' }, { h: 'Vai trò', f: (u) => esc(R[u.role]) }, { h: '', f: (u) => (u.active ? '' : '<span class="badge b-gray">Khoá</span>') },
        { h: '', f: (u) => `<button class="btn ghost sm" data-pw="${u.id}">Đổi mật khẩu</button>${u.id !== ME.id ? ` <button class="btn ghost sm" data-tg="${u.id}" data-a="${u.active ? 0 : 1}">${u.active ? 'Khoá' : 'Mở'}</button>` : ''}` }], us) +
        `<div class="form" style="margin-top:12px"><div class="f s2"><label>Tên đăng nhập</label><input id="nuU" /></div><div class="f s2"><label>Mật khẩu (≥8)</label><input id="nuP" type="password" autocomplete="new-password" /></div><div class="f s1"><label>Vai trò</label><select id="nuR"><option value="ops">Vận hành</option><option value="viewer">Chỉ xem</option><option value="admin">Quản trị</option></select></div><div class="f s1" style="align-self:end"><button class="btn sm" id="nuB">Thêm</button></div></div>`;
      $$('[data-pw]').forEach((b) => (b.onclick = () => act(b, async () => { const p = prompt('Mật khẩu mới (tối thiểu 8 ký tự)'); if (!p) return; await api('/users/' + b.dataset.pw, { method: 'PUT', body: { password: p } }); toast('Đã đổi mật khẩu'); if (+b.dataset.pw === ME.id) { $('#banner').innerHTML = ''; } })));
      $$('[data-tg]').forEach((b) => (b.onclick = () => act(b, async () => { await api('/users/' + b.dataset.tg, { method: 'PUT', body: { active: b.dataset.a === '1' } }); loadUsers(); })));
      $('#nuB').onclick = (e) => act(e.target, async () => { await api('/users', { method: 'POST', body: { username: $('#nuU').value, password: $('#nuP').value, role: $('#nuR').value, name: $('#nuU').value } }); toast('Đã thêm'); loadUsers(); });
    };
    loadUsers().catch(fail);
  };

  // ---------- đăng nhập
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#lp').focus(); }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await act($('#loginForm button'), async () => { await api('/login', { method: 'POST', body: { username: $('#lu').value, password: $('#lp').value } }); await boot(); });
  });
  $('#logout').addEventListener('click', async () => { await api('/logout', { method: 'POST' }).catch(() => {}); location.hash = ''; showLogin(); });

  async function boot() {
    try { ME = await api('/me'); } catch { return showLogin(); }
    $('#login').hidden = true; $('#app').hidden = false;
    $('#who').textContent = `${ME.name || ME.username} · ${({ admin: 'Quản trị', ops: 'Vận hành', viewer: 'Chỉ xem' })[ME.role]}`;
    $('#banner').innerHTML = ME.default_password ? '<div class="warn">⚠️ Bạn đang dùng mật khẩu mặc định. Vào <a href="#/settings">Cài đặt → Người dùng</a> để đổi ngay, hoặc đặt biến môi trường ADMIN_PASSWORD.</div>' : '';
    api('/settings').then((s) => (SETTINGS = s)).catch(() => {});
    api('/dashboard?days=7').then((d) => { COUNTS = d.todo; renderNav(); }).catch(() => {});
    route();
  }
  boot();
})();
