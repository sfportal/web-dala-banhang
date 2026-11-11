/* Trang thanh toán: địa chỉ (Goship), phí ship theo khối lượng/kích thước/dễ vỡ, mã giảm giá, COD / QR */
(function () {
  const $ = (s) => document.querySelector(s);
  const vnd = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = () => new Promise((r) => (window.dalaCart ? r() : setTimeout(() => wait().then(r), 30)));
  let geoSource = 'static', rateId = null, voucher = '', lastQuote = null, timer, usePoints = false;
  const saved = JSON.parse(localStorage.getItem('dala_customer') || '{}');
  for (const k of ['name', 'phone', 'email', 'address']) if (saved[k]) $('#' + k).value = saved[k];
  // Đã đăng nhập tài khoản khách: điền sẵn thông tin còn trống (không bắt buộc đăng nhập để đặt hàng)
  fetch('/api/account/me', { credentials: 'same-origin' }).then((r) => r.json()).then((d) => {
    const c = d && d.customer; if (!c) return;
    for (const k of ['name', 'phone', 'email', 'address']) if (c[k] && !$('#' + k).value) $('#' + k).value = c[k];
  }).catch(() => {});
  const pm = () => document.querySelector('input[name=pm]:checked')?.value || 'sepay';
  document.querySelectorAll('input[name=pm]').forEach((r) => r.addEventListener('change', () => {
    document.querySelectorAll('.opt').forEach((o) => o.classList.toggle('on', o.contains(r) ? r.checked : o.querySelector('input').checked));
    refresh();
  }));

  async function getJson(u) { try { const r = await fetch(u); const j = await r.json(); return j && typeof j === 'object' ? j : {}; } catch { return {}; } }
  function fill(sel, items, ph, val) {
    sel.innerHTML = `<option value="">${ph}</option>` + items.map((i) => `<option value="${esc(i.id)}"${String(i.id) === String(val) ? ' selected' : ''}>${esc(i.name)}</option>`).join('');
    sel.disabled = false;
  }
  async function loadCities() {
    const d = await getJson('/api/geo/cities');
    geoSource = d.source === 'goship' && (d.items || []).length ? 'goship' : 'static';
    fill($('#city'), d.items || [], 'Chọn tỉnh/thành', saved.city);
    if (geoSource !== 'goship') staticMode();
    else if (saved.city) { await loadDistricts(saved.district); }
    refresh();
  }
  // Không có Goship (hoặc Goship lỗi): chỉ chọn tỉnh, ghi phường/xã vào địa chỉ, phí theo bảng dự phòng
  function staticMode() {
    geoSource = 'static';
    $('#fDistrict').style.display = 'none'; $('#fWard').style.display = 'none';
    $('#geo').style.gridTemplateColumns = '1fr';
    $('#addrHint').textContent = '(ghi rõ phường/xã)';
    $('#address').placeholder = 'Số nhà, đường, phường/xã';
  }
  async function loadDistricts(val) {
    const c = $('#city').value; if (!c) return;
    const d = await getJson('/api/geo/districts?city=' + encodeURIComponent(c));
    if (!(d.items || []).length) { staticMode(); return; }
    fill($('#district'), d.items || [], 'Chọn quận/huyện', val);
    $('#ward').innerHTML = '<option value="">Chọn quận trước</option>'; $('#ward').disabled = true;
    if (val) await loadWards(saved.ward);
  }
  async function loadWards(val) {
    const dd = $('#district').value; if (!dd) return;
    const d = await getJson('/api/geo/wards?district=' + encodeURIComponent(dd));
    fill($('#ward'), d.items || [], 'Chọn phường/xã', val);
  }
  $('#city').addEventListener('change', async () => { if (geoSource === 'goship') await loadDistricts(); refresh(); });
  $('#district').addEventListener('change', async () => { await loadWards(); refresh(); });
  $('#ward').addEventListener('change', refresh);
  $('#phone').addEventListener('change', refresh);
  $('#applyV').addEventListener('click', () => { voucher = $('#voucher').value.trim(); refresh(true); });
  $('#voucher').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#applyV').click(); } });

  function to() {
    const sel = (id) => $(id).selectedOptions[0];
    if (geoSource === 'goship') {
      return { city: $('#city').value, district: $('#district').value, ward: $('#ward').value, province: sel('#city')?.textContent, city_name: sel('#city')?.textContent,
        district_name: $('#district').value ? sel('#district')?.textContent : '', ward_name: $('#ward').value ? sel('#ward')?.textContent : '' };
    }
    return { province: $('#city').value };
  }
  function refresh(now) { clearTimeout(timer); timer = setTimeout(run, now ? 0 : 250); }

  async function run() {
    await wait();
    const cart = window.dalaCart;
    if (!cart.items.length) { $('#lines').innerHTML = '<div class="empty"><div class="ico">🧺</div><p>Giỏ hàng trống.</p><a class="btn" href="/san-pham">Chọn sản phẩm</a></div>'; $('#submit').disabled = true; return; }
    const t = to();
    const q = await window.dalaQuote({ voucher, phone: $('#phone').value, to: t.province ? t : null, payment_method: pm(), rate_id: rateId, use_points: usePoints });
    lastQuote = q;
    const lines = window.dalaGroupLines(q.lines || []);
    $('#lines').innerHTML = lines.map((l) => `<div class="line-item"><img src="${esc(l.image.replace('.webp', '-sm.webp'))}" alt="" onerror="this.src='${esc(l.image)}'"><div><div class="n">${esc(l.name)}</div><div class="s">${esc(l.subtitle || '')} · SL ${l.qty}${l.flashQty ? ' · <b style="color:var(--red)">⚡ Flash</b>' : ''}</div></div><div class="p">${vnd(l.amount)}</div></div>`).join('');
    const sh = q.shipping || {};
    if (!t.province) $('#shipOpts').innerHTML = '<p class="muted">Chọn tỉnh/thành để xem phí giao hàng.</p>';
    else if (sh.options?.length) {
      rateId = sh.selected?.id || null;
      $('#shipOpts').innerHTML = sh.options.map((o) => `<label class="opt${o.id === rateId ? ' on' : ''}"><input type="radio" name="rate" value="${esc(o.id)}"${o.id === rateId ? ' checked' : ''}>
        ${o.logo ? `<img class="logo-c" src="${esc(o.logo)}" alt="">` : '<span style="font-size:1.4rem">🚚</span>'}
        <div class="t"><b>${esc(o.carrier)} · ${esc(o.service || '')}</b><small>${o.eta ? `Dự kiến giao <span style="font-weight:700;color:var(--ink)">${esc(o.eta.text)}</span>` : esc(o.expected || '')}${o.success ? ` · giao thành công ${o.success}%` : ''}</small></div>
        <b>${sh.shop_pays ? '<s class="muted" style="font-weight:500">' + vnd(o.fee) + '</s> <span style="color:var(--green)">Miễn phí</span>' : vnd(o.fee)}</b></label>`).join('');
      document.querySelectorAll('input[name=rate]').forEach((r) => r.addEventListener('change', () => { rateId = r.value; refresh(true); }));
      const p = q.parcel || {};
      $('#parcelInfo').textContent = `Kiện hàng ước tính ${(p.weight / 1000).toLocaleString('vi-VN')}kg · ${p.length}×${p.width}×${p.height}cm${p.fragile ? ' · có hàng dễ vỡ, đã cộng phí đóng gói chống sốc' : ''}.`;
    }
    const after = q.subtotal - q.discount - (q.points_discount || 0);
    const P = q.points;
    $('#pointsBox').innerHTML = P && P.balance > 0 ? `<label class="points-opt${usePoints ? ' on' : ''}"><input type="checkbox" id="usePts"${usePoints ? ' checked' : ''}${P.max ? '' : ' disabled'}>
      <span>Dùng điểm tích luỹ <b>${P.balance.toLocaleString('vi-VN')} điểm</b>${P.max ? ` · đổi ${(usePoints ? P.used : P.max).toLocaleString('vi-VN')} điểm giảm <b>${vnd((usePoints ? P.used : P.max) * P.point_value)}</b>` : ` · cần tối thiểu ${P.min_redeem} điểm`}</span></label>` :
      (q.points_earn > 0 ? `<div class="muted small" style="margin:6px 0">Đơn này tích <b>${q.points_earn.toLocaleString('vi-VN')} điểm</b> khi giao thành công${P ? '' : '. <a href="/tai-khoan?tab=dang-ky&next=/thanh-toan">Tạo tài khoản</a> để dùng điểm'}.</div>` : '');
    const up = $('#usePts'); if (up) up.addEventListener('change', () => { usePoints = up.checked; refresh(true); });
    $('#sums').innerHTML = `${q.free_gap > 0 ? `<div class="note-box">Mua thêm <b>${vnd(q.free_gap)}</b> để được miễn phí giao hàng.</div>` : ''}
      <div class="sum-row"><span>Tạm tính</span><b>${vnd(q.subtotal)}</b></div>
      ${q.discount ? `<div class="sum-row" style="color:var(--green)"><span>${esc(q.discount_label || 'Giảm giá')}</span><b>−${vnd(q.discount)}</b></div>` : ''}
      ${q.points_discount ? `<div class="sum-row" style="color:var(--green)"><span>Đổi ${q.points.used.toLocaleString('vi-VN')} điểm</span><b>−${vnd(q.points_discount)}</b></div>` : ''}
      <div class="sum-row"><span>Phí giao hàng</span><b>${!t.province ? '—' : sh.shop_pays ? '<span style="color:var(--green)">Miễn phí</span>' : vnd(sh.fee)}</b></div>
      ${t.province && sh.selected?.eta ? `<div class="sum-row"><span>Dự kiến giao</span><b>${esc(sh.selected.eta.text)}</b></div>` : ''}
      <div class="sum-row total"><span>Tổng cộng</span><span>${vnd(t.province ? q.total : after)}</span></div>`;
    $('#refNote').innerHTML = q.self_purchase ? `<div class="note-box">🤝 Đơn bạn tự mua với tư cách cộng tác viên${q.affiliate ? `: hoa hồng ghi nhận cho ${esc(q.affiliate.code)}` : ''}. Mã CTV không cộng thêm giảm giá cho đơn tự mua.</div>` :
      q.affiliate ? `<div class="note-box">🤝 Đơn được giới thiệu bởi cộng tác viên <b>${esc(q.affiliate.name)}</b> (${esc(q.affiliate.code)})</div>` : '';
    $('#errs').innerHTML = (q.errors || []).map((e) => `<div class="err-box">${esc(e)}</div>`).join('');
    $('#submit').disabled = !q.lines?.length;
    $('#submit').firstChild.textContent = pm() === 'cod' ? `Đặt hàng COD · ${vnd(t.province ? q.total : after)} ` : `Đặt hàng & lấy mã QR · ${vnd(t.province ? q.total : after)} `;
  }

  $('#co').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#submit');
    const t = to();
    const need = [['#name', 'họ tên'], ['#phone', 'số điện thoại'], ['#city', 'tỉnh/thành'], ['#address', 'địa chỉ']];
    if (geoSource === 'goship') need.splice(3, 0, ['#district', 'quận/huyện']);
    const miss = need.filter(([id]) => !$(id).value.trim());
    if (miss.length) { window.dalaToast('Vui lòng nhập ' + miss.map((m) => m[1]).join(', '), true); $(miss[0][0]).focus(); return; }
    btn.disabled = true; btn.firstChild.textContent = 'Đang tạo đơn… ';
    const body = { name: $('#name').value, phone: $('#phone').value, email: $('#email').value, address: $('#address').value, note: $('#note').value, to: t,
      items: window.dalaCart.items, voucher, use_points: usePoints, ref: window.dalaRef(), payment_method: pm(), rate_id: rateId, sid: window.dalaSid, utm: window.dalaUtm() || {}, website: $('#website').value };
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Không đặt được hàng');
      localStorage.setItem('dala_customer', JSON.stringify({ name: body.name, phone: body.phone, email: body.email, address: body.address, city: $('#city').value, district: $('#district').value, ward: $('#ward').value }));
      window.dalaCart.clear();
      if (window.fbq) window.fbq('track', 'Purchase', { value: d.total, currency: 'VND' });
      if (window.ttq) window.ttq.track('CompletePayment', { value: d.total, currency: 'VND' });
      if (window.gtag) window.gtag('event', 'purchase', { transaction_id: d.code, value: d.total, currency: 'VND' });
      location.href = `/don-hang/${d.code}?t=${d.token}&new=1`;
    } catch (err) {
      $('#errs').innerHTML = `<div class="err-box">${esc(err.message)}</div>`;
      window.dalaToast(esc(err.message), true);
      btn.disabled = false; refresh(true);
    }
  });
  window.dalaTrack && window.dalaTrack('begin_checkout');
  loadCities();
})();
