// Trang /tai-khoan: đăng nhập bằng SĐT, đơn đã mua (kể cả đơn trước khi tạo tài khoản), thông tin nhận hàng
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const { api, mount, otpField, esc, toast } = window.DalaAuth;
  const vnd = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
  const date = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('vi-VN') : '');
  const ST = { new: 'b-sun', confirmed: 'b-green', shipping: 'b-blue', completed: 'b-green', cancelled: 'b-gray', returned: 'b-gray' };

  async function load() {
    const d = await api('/me');
    if (d.guest) {
      $('#accGuest').hidden = false; $('#accMe').hidden = true;
      const tab = new URLSearchParams(location.search).get('tab') === 'dang-ky' ? 'reg' : 'login';
      mount($('#accAuth'), { flags: d.flags, defaultTab: tab, onDone: () => { const n = new URLSearchParams(location.search).get('next'); if (n && n.startsWith('/')) location.href = n; else load(); } });
      return;
    }
    $('#accGuest').hidden = true; $('#accMe').hidden = false;
    const c = d.customer;
    $('#accName').textContent = c.name || c.phone;
    $('#accSub').textContent = `${c.phone} · ${d.stats.n} đơn · đã mua ${vnd(d.stats.spent)}`;
    $('#apName').value = c.name || ''; $('#apEmail').value = c.email || ''; $('#apAddr').value = c.address || ''; $('#apProv').value = c.province || '';

    // Xác thực SĐT để xem chi tiết đơn
    const v = $('#accVerify');
    if (!c.phone_verified && d.flags.otp_available) {
      const f = otpField('avOtp', 'signup', () => c.phone, '/verify-phone/send');
      v.innerHTML = `<form class="panel verify-box" novalidate><div><b>Xác thực số điện thoại</b><p class="muted" style="margin:4px 0 10px">Xác thực ${esc(c.phone)} để xem đầy đủ địa chỉ và chi tiết các đơn đã mua.</p></div>${f.html}<button type="submit" class="btn sm">Xác thực</button></form>`;
      f.bind(v);
      v.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try { await api('/verify-phone', { otp: $('#avOtp').value }); toast('Đã xác thực số điện thoại'); load(); } catch (err) { toast(err.message, true); }
      });
    } else v.innerHTML = '';

    // CTV
    const a = d.affiliate;
    $('#accCtv').innerHTML = a
      ? `<h3>Cộng tác viên</h3><p class="muted">Mã <b>${esc(a.code)}</b>${a.status === 'pending' ? ' · đang chờ DaLa duyệt' : a.status === 'blocked' ? ' · đang tạm khoá' : ''}</p><a class="btn sun block" href="/ctv">Mở trang cộng tác viên</a>`
      : `<h3>Kiếm thêm cùng DaLa</h3><p class="muted">Đăng ký làm cộng tác viên để có link riêng và nhận hoa hồng mỗi đơn.</p><a class="btn sun block" href="/ctv#dang-ky">Đăng ký cộng tác viên</a>`;

    const o = await api('/orders');
    $('#accOrders').innerHTML = o.orders.length ? o.orders.map((r) => `
      <article class="panel acc-order">
        <header><div><b>${esc(r.code)}</b> <span class="muted">· ${date(r.created_at)}</span></div><span class="badge ${ST[r.status] || ''}">${esc(r.status_label)}</span></header>
        <ul>${r.items.map((i) => `<li><span>${esc(i.name)} × ${i.qty}</span><span>${vnd(i.price * i.qty)}</span></li>`).join('')}</ul>
        <footer><span class="muted">${esc(r.payment_label)}${r.payment_method === 'cod' ? ' · COD' : ''}${r.address ? ' · ' + esc(r.address) : ''}${r.tracking_code ? ` · Vận đơn ${r.tracking_url ? `<a href="${esc(r.tracking_url)}" target="_blank" rel="noopener">${esc(r.tracking_code)}</a>` : esc(r.tracking_code)}` : ''}</span><b>${vnd(r.total)}</b></footer>
        ${r.link ? `<a class="btn ghost sm" href="${esc(r.link)}">Xem chi tiết</a>` : ''}
      </article>`).join('') + (!o.verified ? `<p class="muted small">${d.flags.otp_available ? 'Xác thực số điện thoại ở trên để xem chi tiết từng đơn.' : 'Địa chỉ được ẩn bớt để bảo vệ thông tin. Liên hệ DaLa nếu cần chi tiết đơn.'}</p>` : '')
      : '<div class="panel"><p class="muted" style="margin:0">Chưa có đơn hàng nào với số điện thoại này. <a href="/san-pham">Mua sắm ngay</a></p></div>';
  }

  $('#accLogout').addEventListener('click', async () => { await api('/logout', {}).catch(() => {}); location.reload(); });
  $('#accProfile').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/profile', { name: $('#apName').value, email: $('#apEmail').value, address: $('#apAddr').value, province: $('#apProv').value, password: $('#apOld').value, new_password: $('#apNew').value }, 'PUT');
      $('#apOld').value = ''; $('#apNew').value = ''; toast('Đã lưu');
    } catch (err) { toast(err.message, true); }
  });
  load().catch((e) => toast(e.message, true));
})();
