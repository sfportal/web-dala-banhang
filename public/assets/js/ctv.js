// Cổng cộng tác viên: đăng ký, đăng nhập, ví hoa hồng, đội nhóm, rút tiền
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, e) => window.dalaToast && window.dalaToast(esc(m), e);
  const date = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN') : '');
  const origin = location.origin;
  let data = null;

  async function api(path, opts = {}) {
    const r = await fetch('/api/aff' + path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Có lỗi xảy ra'); e.status = r.status; throw e; }
    return j;
  }
  function busy(form, on) { const b = $('button:not([type=button])', form); if (b) { b.disabled = on; b.style.opacity = on ? .6 : ''; } }

  // ---------- khách
  $$('[data-auth]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-auth]').forEach((x) => x.classList.toggle('on', x === b));
    $('#regForm').hidden = b.dataset.auth !== 'reg';
    $('#loginForm').hidden = b.dataset.auth !== 'login';
  }));
  if (!$('#rRef').value) { try { const r = JSON.parse(localStorage.getItem('dala_ref') || 'null'); if (r && r.code) $('#rRef').value = r.code; } catch (_) {} }

  $('#regForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.currentTarget; busy(f, true);
    try {
      const r = await api('/register', { method: 'POST', body: { name: $('#rName').value, phone: $('#rPhone').value, password: $('#rPass').value, province: $('#rProv').value, ref: $('#rRef').value.trim(), channel_note: $('#rNote').value } });
      window.dalaTrack && window.dalaTrack('ctv_register', { code: r.code });
      toast(r.status === 'pending' ? 'Đã đăng ký, DaLa sẽ duyệt trong 24 giờ' : 'Chào mừng bạn đến với DaLa!');
      await load(true);
    } catch (err) { toast(err.message, true); } finally { busy(f, false); }
  });
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.currentTarget; busy(f, true);
    try { await api('/login', { method: 'POST', body: { phone: $('#lPhone').value, password: $('#lPass').value } }); await load(true); }
    catch (err) { toast(err.message, true); } finally { busy(f, false); }
  });

  // ---------- bảng điều khiển
  $('#logout').addEventListener('click', async () => { await api('/logout', { method: 'POST' }).catch(() => {}); location.reload(); });
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const v = $(b.dataset.copy).value;
    try { await navigator.clipboard.writeText(v); } catch (_) { $(b.dataset.copy).select(); document.execCommand('copy'); }
    const t = b.textContent; b.textContent = 'Đã chép ✓'; setTimeout(() => (b.textContent = t), 1400);
  }));
  $$('[data-dtab]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-dtab]').forEach((x) => x.classList.toggle('on', x === b));
    $$('[data-dpane]').forEach((x) => x.classList.toggle('on', x.dataset.dpane === b.dataset.dtab));
    if (b.dataset.dtab === 'team') loadTeam();
  }));

  function countUp(el, to) {
    const t0 = performance.now(); const d = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / d); el.textContent = vnd(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function render(d) {
    const me = d.me;
    $('#dName').textContent = me.name;
    $('#dTier').textContent = `${me.tier?.name || 'Cộng tác viên'} · ${me.code}`;
    $('#dSub').textContent = me.status === 'pending' ? 'Tài khoản đang chờ DaLa duyệt. Bạn vẫn có thể chia sẻ link, hoa hồng sẽ được ghi nhận sau khi duyệt.' :
      `Tham gia từ ${date(me.created_at)}${me.parent ? ` · Người giới thiệu: ${me.parent.name}` : ''}`;
    countUp($('#wBal'), d.wallet.balance);
    $('#wPend').textContent = vnd(d.wallet.pending); $('#wReq').textContent = vnd(d.wallet.requested); $('#wPaid').textContent = vnd(d.wallet.paid);
    $('#myLink').value = `${origin}/?ref=${me.code}`;
    $('#myCode').value = me.code;
    $('#myInvite').value = `${origin}/ctv?ref=${me.code}`;
    $('#shareNote').textContent = `Khách nhập mã ${me.code} khi thanh toán được giảm ${d.policy.buyer_discount_pct || 0}%. Link lưu ${d.policy.cookie_days || 30} ngày${d.policy.cookie_days ? '' : ''} và khách mua lần sau vẫn tính cho bạn.`;

    const k = [
      ['Doanh số tháng này', vnd(d.month.sales)], ['Hoa hồng tháng này', vnd(d.month.comm)], ['Đơn có hoa hồng', d.month.orders],
      ['Lượt xem link 30 ngày', d.clicks_30d], ['Khách của bạn', d.customers], ['Đội nhóm F1 / F2', `${d.team.f1} / ${d.team.f2}`],
    ];
    $('#kpis').innerHTML = k.map(([l, v]) => `<div class="kpi"><small>${l}</small><b>${esc(v)}</b></div>`).join('') +
      d.by_level.map((l) => `<div class="kpi lv"><small>Hoa hồng ${esc(l.name.toLowerCase())}</small><b>${vnd(l.amount)}</b></div>`).join('');

    const t = me.tier || {}; const next = d.next_tier;
    const pct = next ? Math.min(100, Math.round((d.month.sales / next.min_sales) * 100)) : 100;
    $('#tierBox').innerHTML = `<div class="tier-prog"><div><b>Hạng ${esc(t.name)}</b>: trực tiếp ${t.direct}% · gián tiếp 1 ${t.l1}% · gián tiếp 2 ${t.l2}%</div>
      <div class="muted">${next ? `Còn ${vnd(Math.max(0, next.min_sales - d.month.sales))} doanh số tháng này để lên <b>${esc(next.name)}</b> (${next.direct}%)` : 'Bạn đang ở hạng cao nhất'}</div></div>
      <div class="bar"><i style="width:0" data-w="${pct}%"></i></div>`;
    requestAnimationFrame(() => setTimeout(() => { const i = $('#tierBox .bar i'); if (i) i.style.width = i.dataset.w; }, 60));

    const WS = { requested: ['Chờ duyệt', ''], approved: ['Đã duyệt', 'green'], paid: ['Đã chuyển', 'green'], rejected: ['Từ chối', 'red'] };
    $('#wds').innerHTML = d.withdrawals.length ? `<table class="tbl"><thead><tr><th>Ngày</th><th>Số tiền</th><th>Tài khoản</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead><tbody>${d.withdrawals.map((w) =>
      `<tr><td>${date(w.created_at)}</td><td><b>${vnd(w.amount)}</b></td><td>${esc(w.bank_name)} · ${esc(w.bank_account)}</td><td><span class="badge ${WS[w.status]?.[1] || ''}">${WS[w.status]?.[0] || esc(w.status)}</span></td><td class="muted">${esc(w.admin_note || w.note || '')}</td></tr>`).join('')}</tbody></table>` :
      `<p class="muted">Chưa có lệnh rút. Ngày chi trả: ${esc(d.policy.payout_days || 'định kỳ')}, tối thiểu ${vnd(d.policy.min_withdraw)}.</p>`;

    $('#pName').value = me.name || ''; $('#pEmail').value = me.email || ''; $('#pProv').value = me.province || '';
    $('#pBank').value = me.bank_name || ''; $('#pAcc').value = me.bank_account || ''; $('#pHolder').value = me.bank_holder || '';
  }

  async function loadOrders() {
    const rows = await api('/orders');
    const CS = { pending: ['Chờ giao xong', ''], available: ['Khả dụng', 'green'], void: ['Huỷ', 'red'], paid: ['Đã rút', 'green'] };
    $('#orders').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Đơn</th><th>Ngày</th><th>Loại</th><th>Người bán</th><th>Doanh số tính HH</th><th>Hoa hồng</th><th>Trạng thái đơn</th><th>Hoa hồng</th></tr></thead><tbody>${rows.map((r) =>
      `<tr><td><b>${esc(r.code)}</b><div class="muted" style="font-size:.8rem">Khách ${esc(r.buyer)}</div></td><td>${date(r.created_at)}</td><td><span class="badge ${r.level === 0 ? 'green' : 'purple'}">${esc(r.level_name)}</span></td><td>${esc(r.level === 0 ? 'Bạn' : r.seller || '')}</td><td>${vnd(r.base)}</td><td><b>${vnd(r.amount)}</b> <span class="muted">(${r.rate}%)</span></td><td>${esc(r.status_label || r.status)}</td><td><span class="badge ${CS[r.cstatus]?.[1] || ''}">${CS[r.cstatus]?.[0] || esc(r.cstatus)}</span>${r.cstatus === 'pending' && r.available_at ? `<div class="muted" style="font-size:.75rem">Khả dụng ${date(r.available_at)}</div>` : ''}</td></tr>`).join('')}</tbody></table>` :
      '<div class="empty-box"><b>Chưa có đơn nào</b><p class="muted">Gửi link giới thiệu cho 5 người bạn nghĩ sẽ thích DaLa nhất. Dùng bộ nội dung bán hàng ở tab cuối để bắt đầu nhanh.</p></div>';
  }

  let teamLoaded = false;
  async function loadTeam() {
    if (teamLoaded) return; teamLoaded = true;
    const t = await api('/team');
    if (!t.f1.length) { $('#team').innerHTML = `<div class="empty-box"><b>Chưa có thành viên</b><p class="muted">Mời bạn bè làm CTV bằng link mời. Bạn nhận ${esc(data.me.tier.l1)}% trên đơn của người bạn mời và ${esc(data.me.tier.l2)}% trên đơn của người họ mời.</p></div>`; return; }
    $('#team').innerHTML = `<div class="tree"><div class="node me"><b>${esc(data.me.name)}</b><small>Bạn · ${esc(data.me.code)}</small></div><ul>${t.f1.map((a) => {
      const kids = t.f2.filter((x) => x.parent_id === a.id);
      return `<li><div class="node"><b>${esc(a.name)}</b><small>F1 · ${esc(a.tier_name)} · ${esc(a.code)}</small><small>Doanh số tháng: ${vnd(a.month_sales)}</small></div>${kids.length ? `<ul>${kids.map((k) => `<li><div class="node f2"><b>${esc(k.name)}</b><small>F2 · ${esc(k.tier_name)}</small></div></li>`).join('')}</ul>` : ''}</li>`;
    }).join('')}</ul></div>`;
  }

  async function loadKit() {
    try {
      const r = await fetch('/api/catalog'); const cat = await r.json();
      const code = data.me.code;
      const picks = cat.products.filter((p) => ['BCX-350', 'CLTH-100', 'COT-250', 'COMBO-KHOE', 'COMBO-THU', 'QUA-TET'].includes(p.sku));
      const cap = {
        'BCX-350': 'Bữa sáng no lâu mà không ngán: 1 thìa bột chuối xanh DaLa pha sữa hoặc sinh tố. Chuối xanh Đắk Lắk, không đường thêm, quét QR thấy vườn.',
        'CLTH-100': 'Chanh leo sấy thăng hoa giòn tan, chua ngọt tự nhiên, không đường. Ăn vặt văn phòng hay pha trà đều ngon.',
        'COT-250': 'Cốt chanh leo 100%, không đường: pha nước, làm trà, làm bánh. Một chai ~ 15 ly.',
        'COMBO-KHOE': 'Combo khỏe mỗi ngày: bột chuối xanh + chanh leo sấy + khoai lang sấy dẻo. Mua combo lợi hơn mua lẻ.',
        'COMBO-THU': 'Lần đầu biết DaLa? Combo dùng thử đủ 3 vị, giá dễ thử.',
        'QUA-TET': 'Quà Tết có câu chuyện: hộp quà nắng cao nguyên, mỗi gói có QR truy xuất vườn trồng.',
      };
      $('#kit').innerHTML = picks.map((p) => {
        const link = `${origin}/san-pham/${p.slug}?ref=${code}`;
        const txt = `${cap[p.sku] || p.short_desc}\n👉 Giá ${vnd(p.effective_price)}. Nhập mã ${code} giảm thêm. Đặt tại: ${link}`;
        return `<div class="kit"><img src="${esc(p.image_bg || p.image)}" alt="" loading="lazy"><div><b>${esc(p.name)} ${esc(p.subtitle || '')}</b><textarea readonly rows="5">${esc(txt)}</textarea>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" data-kit-copy>Chép nội dung</button><a class="btn sm ghost" href="${esc(p.image_bg || p.image)}" download>Tải ảnh</a></div></div></div>`;
      }).join('');
      $$('[data-kit-copy]').forEach((b) => b.addEventListener('click', async () => {
        const ta = b.closest('.kit').querySelector('textarea');
        try { await navigator.clipboard.writeText(ta.value); } catch (_) { ta.select(); document.execCommand('copy'); }
        toast('Đã chép nội dung, dán vào bài đăng nhé');
      }));
    } catch (_) {}
  }

  // ---------- rút tiền + hồ sơ
  const modal = $('#wdModal');
  $('#openWd').addEventListener('click', () => {
    if (!data.me.bank_account) { toast('Cập nhật tài khoản ngân hàng trước khi rút', true); $('[data-dtab=profile]').click(); $('#pBank').focus(); return; }
    $('#wdInfo').textContent = `Số dư rút được ${vnd(data.wallet.balance)}. Tối thiểu ${vnd(data.policy.min_withdraw)}. Chuyển về ${data.me.bank_name} · ${data.me.bank_account} vào ngày ${data.policy.payout_days || 'chi trả gần nhất'}.`;
    $('#wdAmt').value = data.wallet.balance || ''; modal.hidden = false; $('#wdAmt').focus();
  });
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.matches('[data-close]')) modal.hidden = true; });
  $('#wdForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.currentTarget; busy(f, true);
    try { await api('/withdraw', { method: 'POST', body: { amount: Number(String($('#wdAmt').value).replace(/\D/g, '')), note: $('#wdNote').value } }); modal.hidden = true; toast('Đã gửi yêu cầu rút tiền'); await load(); }
    catch (err) { toast(err.message, true); } finally { busy(f, false); }
  });
  $('#profForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const f = e.currentTarget; busy(f, true);
    try {
      await api('/profile', { method: 'PUT', body: { name: $('#pName').value, email: $('#pEmail').value, province: $('#pProv').value, bank_name: $('#pBank').value, bank_account: $('#pAcc').value, bank_holder: $('#pHolder').value, password: $('#pOld').value, new_password: $('#pNew').value } });
      $('#pOld').value = ''; $('#pNew').value = ''; toast('Đã lưu thông tin'); await load();
    } catch (err) { toast(err.message, true); } finally { busy(f, false); }
  });

  async function load(first) {
    try {
      data = await api('/me');
      if (data.guest) { $('#guest').hidden = false; $('#dash').hidden = true; return; }
      $('#guest').hidden = true; $('#dash').hidden = false;
      render(data);
      if (first !== false) { loadOrders().catch(() => {}); if (!$('#kit').children.length) loadKit(); }
      if (first === true) window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err.status === 401) { $('#guest').hidden = false; $('#dash').hidden = true; }
      else toast(err.message, true);
    }
  }
  load(null);
})();
