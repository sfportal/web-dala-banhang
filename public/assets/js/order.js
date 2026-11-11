/* Trang đơn hàng: hiện mã VietQR, tự kiểm tra tiền về (SePay qua web thu chi), chúc mừng khi thanh toán xong */
(function () {
  const box = document.getElementById('order');
  const code = box.dataset.code;
  const t = new URLSearchParams(location.search).get('t') || '';
  const vnd = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let celebrated = false, timer;
  const steps = [['new', '📝', 'Đặt hàng'], ['confirmed', '✅', 'Xác nhận'], ['shipping', '🚚', 'Đang giao'], ['completed', '🎉', 'Hoàn tất']];

  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#f2a516', '#2e7827', '#5b2a86', '#e8811a', '#7db43a'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('i'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.background = colors[i % colors.length];
      c.style.animationDuration = 2 + Math.random() * 2 + 's'; c.style.animationDelay = Math.random() * 0.6 + 's';
      c.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      document.body.appendChild(c); setTimeout(() => c.remove(), 4800);
    }
  }
  const SRC = { goship: 'Đơn vị vận chuyển', admin: 'DaLa', sepay: 'Ngân hàng', web: 'Website' };
  const when = (t) => { const d = new Date(String(t).replace(' ', 'T') + (/[zZ+]/.test(t) ? '' : 'Z')); return isNaN(d) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }); };
  function history(o) {
    const ev = (o.timeline || []).slice().reverse();
    if (!ev.length) return '';
    return `<div class="panel"><h2>Lịch sử đơn hàng</h2>
      ${o.eta ? `<div class="eta-box${o.eta.late ? ' late' : ''}">🚚 <span>Dự kiến giao <b>${esc(o.eta.text)}</b>${o.eta.late ? '<br><small>Đơn đang chậm hơn dự kiến, DaLa đang theo dõi với đơn vị vận chuyển.</small>' : ''}</span></div>` : ''}
      <ol class="track">${ev.map((e, i) => `<li class="${i === 0 ? 'now' : ''} k-${esc(e.kind)}"><time>${esc(when(e.at))}</time><b>${esc(e.title)}</b>
        ${e.detail ? `<div>${esc(e.detail)}</div>` : ''}${e.location ? `<div class="muted">📍 ${esc(e.location)}</div>` : ''}${e.source && SRC[e.source] && e.kind === 'ship' ? `<small class="muted">${SRC[e.source]}</small>` : ''}</li>`).join('')}</ol>
      ${o.tracking_code ? `<p class="muted small" style="margin:10px 0 0">Mã vận đơn <b>${esc(o.tracking_code)}</b>${o.shipping_carrier ? ' · ' + esc(o.shipping_carrier) : ''}${o.tracking_url ? ` · <a href="${esc(o.tracking_url)}" target="_blank" rel="noopener">Xem trên trang hãng ↗</a>` : ''}</p>` : ''}
    </div>`;
  }
  function copy(text, btn) { navigator.clipboard?.writeText(text); btn.textContent = 'Đã chép'; setTimeout(() => (btn.textContent = 'Chép'), 1500); }
  window.dalaCopy = copy;

  function render(o) {
    const paid = o.payment_status === 'paid';
    const cancelled = o.status === 'cancelled' || o.status === 'returned';
    const idx = steps.findIndex((s) => s[0] === o.status);
    const timeline = cancelled ? '' : `<div class="timeline">${steps.map((s, i) => `<div class="${i <= idx ? 'on' : ''}"><i>${s[1]}</i>${s[2]}</div>`).join('')}</div>`;
    const items = o.items.map((i) => `<div class="line-item"><img src="${esc((i.image || '').replace('.webp', '-sm.webp'))}" alt="" onerror="this.src='${esc(i.image || '')}'"><div><div class="n">${esc(i.name)}</div><div class="s">SL ${i.qty} × ${vnd(i.price)}</div></div><div class="p">${vnd(i.price * i.qty)}</div></div>`).join('');
    let head;
    if (cancelled) head = `<div class="success"><div style="font-size:3rem">⚠️</div><h1 style="font-size:1.8rem">Đơn ${esc(o.code)} đã huỷ</h1><p class="muted">${o.payment_method === 'sepay' && !paid ? 'Đơn quá hạn thanh toán nên đã tự huỷ. Bạn có thể đặt lại bất cứ lúc nào.' : 'Liên hệ DaLa nếu cần hỗ trợ.'}</p><a class="btn" href="/san-pham">Mua lại</a></div>`;
    else if (o.payment_method === 'sepay' && !paid) {
      const remain = o.total - (o.paid_amount || 0);
      const exp = new Date(o.created_at.replace(' ', 'T') + 'Z').getTime() + o.expire_minutes * 60000;
      head = `<h1 style="font-size:clamp(1.6rem,3.5vw,2.2rem);text-align:center">Quét mã để thanh toán đơn ${esc(o.code)}</h1>
        <p class="muted" style="text-align:center">${o.eta ? `Thanh toán ngay để nhận hàng dự kiến <b>${esc(o.eta.text)}</b>. ` : ''}Mở app ngân hàng bất kỳ, quét mã VietQR. Hệ thống tự xác nhận khi tiền về, bạn không cần chụp màn hình.</p>
        <div class="pay-grid" style="margin-top:24px">
          <div class="qr-box"><span class="pulse"></span>${o.payment_qr ? `<img src="${esc(o.payment_qr)}" alt="Mã VietQR thanh toán">` : '<div class="note-box">Chưa cấu hình tài khoản nhận tiền. DaLa sẽ liên hệ để xác nhận đơn.</div>'}</div>
          <div>
            <dl class="kv">
              <dt>Số tiền</dt><dd style="color:var(--red);font-size:1.5rem">${vnd(remain)}</dd><button class="copy" onclick="dalaCopy('${remain}',this)">Chép</button>
              <dt>Nội dung CK</dt><dd>${esc(o.payment_code)}</dd><button class="copy" onclick="dalaCopy('${esc(o.payment_code)}',this)">Chép</button>
              ${o.payment_account ? `<dt>Số tài khoản</dt><dd>${esc(o.payment_account)}</dd><button class="copy" onclick="dalaCopy('${esc(o.payment_account)}',this)">Chép</button>` : ''}
              ${o.payment_bank ? `<dt>Ngân hàng</dt><dd>${esc(o.payment_bank)}</dd><span></span>` : ''}
              ${o.bank_holder ? `<dt>Chủ tài khoản</dt><dd>${esc(o.bank_holder)}</dd><span></span>` : ''}
            </dl>
            <div class="note-box" style="margin-top:16px">⏳ <b id="waitTxt">Đang chờ tiền về…</b> Giữ nguyên trang này, trạng thái tự cập nhật. Đơn giữ chỗ đến <b id="expTxt"></b>.</div>
            ${o.paid_amount ? `<div class="err-box">Đã nhận ${vnd(o.paid_amount)}, vui lòng chuyển thêm ${vnd(remain)} với cùng nội dung.</div>` : ''}
            ${o.manual_payment ? '<p class="muted" style="font-size:.85rem">Giao dịch sẽ được DaLa xác nhận thủ công trong giờ làm việc.</p>' : ''}
          </div>
        </div>`;
      setTimeout(() => { const e = document.getElementById('expTxt'); if (e) e.textContent = new Date(exp).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); });
    } else {
      head = `<div class="success"><div class="check"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><path d="M5 12l5 5L20 7"/></svg></div>
        <h1 style="font-size:clamp(1.8rem,4vw,2.6rem)">${paid ? 'Thanh toán thành công!' : 'Đặt hàng thành công!'}</h1>
        <p class="lead" style="margin:0 auto">Cảm ơn ${esc(o.name)}. Đơn <b>${esc(o.code)}</b> ${paid ? 'đã được thanh toán và' : 'sẽ được thu tiền khi giao, và'} ${o.status === 'shipping' ? 'đang trên đường giao tới bạn.' : 'đang được DaLa chuẩn bị.'}</p>${o.eta ? `<p class="eta-pill">🚚 Dự kiến giao <b>${esc(o.eta.text)}</b></p>` : ''}</div>`;
      if (!celebrated && (new URLSearchParams(location.search).get('new') || paid)) { celebrated = true; confetti(); }
    }
    box.innerHTML = `<div class="panel">${head}${timeline}</div>${history(o)}
      <div class="panel"><h2>Chi tiết đơn ${esc(o.code)}</h2>${items}
        <div style="margin-top:12px"><div class="sum-row"><span>Tạm tính</span><b>${vnd(o.subtotal)}</b></div>
        ${o.discount ? `<div class="sum-row" style="color:var(--green)"><span>Giảm giá</span><b>−${vnd(o.discount)}</b></div>` : ''}
        <div class="sum-row"><span>Phí giao hàng</span><b>${o.shipping_fee ? vnd(o.shipping_fee) : 'Miễn phí'}</b></div>
        <div class="sum-row total"><span>Tổng cộng</span><span>${vnd(o.total)}</span></div></div>
        <p class="muted" style="margin-top:14px;font-size:.9rem">Giao tới: ${esc(o.name)} · ${esc(o.phone)} · ${esc(o.address)}${o.province ? ', ' + esc(o.province) : ''}<br>Thanh toán: ${o.payment_method === 'cod' ? 'Tiền mặt khi nhận hàng (COD)' : 'Chuyển khoản QR'} · ${esc(o.payment_label)}${o.tracking_code ? `<br>Mã vận đơn: <b>${esc(o.tracking_code)}</b> ${o.tracking_url ? `<a href="${esc(o.tracking_url)}" target="_blank" rel="noopener">Theo dõi</a>` : ''} ${o.ship_status_text ? '· ' + esc(o.ship_status_text) : ''}` : ''}</p>
      </div>
      <div class="panel" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><b>Nhận hàng xong, quét QR trên bao bì</b><div class="muted" style="font-size:.9rem">để xem vườn trồng và phiếu kiểm nghiệm của chính lô bạn mua.</div></div><a class="btn ghost sm" href="/ctv">Giới thiệu bạn bè, nhận hoa hồng</a></div>`;
    return o.payment_method === 'sepay' && !paid && !cancelled;
  }

  async function load(check) {
    try {
      const r = await fetch(`/api/orders/${code}?t=${encodeURIComponent(t)}${check ? '&check=1' : ''}`);
      const o = await r.json();
      if (!r.ok) { box.innerHTML = `<div class="panel" style="text-align:center"><h2>Không mở được đơn hàng</h2><p class="muted">${esc(o.error || '')}</p><a class="btn" href="/">Về trang chủ</a></div>`; return; }
      const waiting = render(o);
      clearTimeout(timer);
      if (waiting) timer = setTimeout(() => load(true), 4000);
    } catch { timer = setTimeout(() => load(true), 6000); }
  }
  load(true);
})();
