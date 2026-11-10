// Đăng nhập / tạo tài khoản / quên mật khẩu bằng số điện thoại, dùng chung cho /tai-khoan và /ctv
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, e) => window.dalaToast && window.dalaToast(esc(m), e);

  async function api(path, body, method) {
    const r = await fetch('/api/account' + path, { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'Có lỗi xảy ra'); e.status = r.status; throw e; }
    return j;
  }
  function busy(form, on) { const b = form.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.style.opacity = on ? 0.6 : ''; } }

  // Nút "Gửi mã" có đếm ngược 60 giây
  function otpField(id, purpose, getPhone, sendPath) {
    return {
      html: `<div class="field otp-field"><label for="${id}">Mã xác thực</label><div class="otp-row"><input id="${id}" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 số" /><button type="button" class="btn ghost sm" data-otp-send="${id}">Gửi mã</button></div><span class="muted otp-hint" data-otp-hint="${id}">Mã gửi qua Zalo, nếu không nhận được sẽ gửi SMS.</span></div>`,
      bind(root) {
        const b = root.querySelector(`[data-otp-send="${id}"]`);
        const hint = root.querySelector(`[data-otp-hint="${id}"]`);
        b.addEventListener('click', async () => {
          const phone = getPhone();
          if (!/^0\d{9}$/.test(String(phone || '').replace(/\D/g, '').replace(/^84/, '0'))) { toast('Vui lòng nhập số điện thoại trước', true); return; }
          b.disabled = true;
          try {
            const r = await api(sendPath || '/otp', { phone, purpose });
            hint.textContent = `Đã gửi mã qua ${r.channel === 'zalo' ? 'Zalo' : r.channel === 'sms' ? 'SMS' : 'kênh thử'} tới ${phone}, hiệu lực ${r.ttl} phút.${r.dev_code ? ' Mã thử: ' + r.dev_code : ''}`;
            let t = 60; b.textContent = `Gửi lại (${t}s)`;
            const iv = setInterval(() => { t--; b.textContent = t > 0 ? `Gửi lại (${t}s)` : 'Gửi lại mã'; if (t <= 0) { clearInterval(iv); b.disabled = false; } }, 1000);
            root.querySelector('#' + id).focus();
          } catch (e) { toast(e.message, true); b.disabled = false; }
        });
      },
    };
  }

  // mount(el, { flags, onDone, intro, defaultTab })
  function mount(el, opts = {}) {
    const flags = opts.flags || {};
    const regOtp = flags.otp_signup ? otpField('aOtp', 'signup', () => el.querySelector('#aRPhone').value) : null;
    const rstOtp = flags.otp_available ? otpField('aXOtp', 'reset', () => el.querySelector('#aXPhone').value) : null;
    el.innerHTML = `
      ${opts.intro ? `<p class="muted" style="margin:0 0 14px">${opts.intro}</p>` : ''}
      <div class="auth-tabs" role="tablist"><button type="button" data-tab="login">Đăng nhập</button><button type="button" data-tab="reg">Tạo tài khoản</button></div>
      <form data-pane="login" novalidate>
        <div class="field"><label for="aLPhone">Số điện thoại</label><input id="aLPhone" inputmode="tel" autocomplete="tel" required placeholder="09xxxxxxxx" /></div>
        <div class="field"><label for="aLPass">Mật khẩu</label><input id="aLPass" type="password" autocomplete="current-password" required /></div>
        <button type="submit" class="btn block">Đăng nhập</button>
        <p class="muted" style="font-size:.82rem;margin:10px 0 0">${rstOtp ? '<a href="#" data-tab="reset">Quên mật khẩu?</a>' : 'Quên mật khẩu? <a href="/lien-he">Liên hệ DaLa</a> để được hỗ trợ.'}</p>
      </form>
      <form data-pane="reg" novalidate hidden>
        <div class="field"><label for="aRName">Họ tên</label><input id="aRName" autocomplete="name" required /></div>
        <div class="field"><label for="aRPhone">Số điện thoại</label><input id="aRPhone" inputmode="tel" autocomplete="tel" required placeholder="Dùng số đã mua hàng để xem lại đơn cũ" /></div>
        <div class="field"><label for="aRPass">Mật khẩu</label><input id="aRPass" type="password" autocomplete="new-password" required minlength="6" placeholder="Tối thiểu 6 ký tự" /></div>
        ${regOtp ? regOtp.html : ''}
        <button type="submit" class="btn sun block">Tạo tài khoản <span class="shine"></span></button>
        <p class="muted" style="font-size:.82rem;margin:10px 0 0">Đã từng đặt hàng bằng số này? Tạo tài khoản xong bạn sẽ thấy lại các đơn cũ.</p>
      </form>
      ${rstOtp ? `<form data-pane="reset" novalidate hidden>
        <div class="field"><label for="aXPhone">Số điện thoại</label><input id="aXPhone" inputmode="tel" autocomplete="tel" required /></div>
        ${rstOtp.html}
        <div class="field"><label for="aXPass">Mật khẩu mới</label><input id="aXPass" type="password" autocomplete="new-password" minlength="6" required /></div>
        <button type="submit" class="btn block">Đặt lại mật khẩu</button>
        <p class="muted" style="font-size:.82rem;margin:10px 0 0"><a href="#" data-tab="login">Quay lại đăng nhập</a></p>
      </form>` : ''}`;
    const show = (t) => {
      el.querySelectorAll('.auth-tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
      el.querySelectorAll('[data-pane]').forEach((f) => (f.hidden = f.dataset.pane !== t));
    };
    el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); show(b.dataset.tab); }));
    show(opts.defaultTab || 'login');
    regOtp && regOtp.bind(el);
    rstOtp && rstOtp.bind(el);
    const done = (r, kind) => { opts.onDone && opts.onDone(r, kind); };

    el.querySelector('[data-pane=login]').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.currentTarget; busy(f, true);
      try { const r = await api('/login', { phone: el.querySelector('#aLPhone').value, password: el.querySelector('#aLPass').value }); done(r, 'login'); }
      catch (err) { toast(err.message, true); } finally { busy(f, false); }
    });
    el.querySelector('[data-pane=reg]').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.currentTarget; busy(f, true);
      try {
        const r = await api('/register', { name: el.querySelector('#aRName').value, phone: el.querySelector('#aRPhone').value, password: el.querySelector('#aRPass').value, otp: regOtp ? el.querySelector('#aOtp').value : undefined });
        window.dalaTrack && window.dalaTrack('sign_up', {});
        toast(r.past_orders ? `Đã tạo tài khoản, tìm thấy ${r.past_orders} đơn đã mua` : 'Đã tạo tài khoản');
        done(r, 'register');
      } catch (err) { toast(err.message, true); } finally { busy(f, false); }
    });
    const rf = el.querySelector('[data-pane=reset]');
    rf && rf.addEventListener('submit', async (e) => {
      e.preventDefault(); busy(rf, true);
      try { const r = await api('/reset', { phone: el.querySelector('#aXPhone').value, otp: el.querySelector('#aXOtp').value, password: el.querySelector('#aXPass').value }); toast('Đã đặt lại mật khẩu'); done(r, 'reset'); }
      catch (err) { toast(err.message, true); } finally { busy(rf, false); }
    });
  }

  window.DalaAuth = { api, mount, otpField, esc, toast };
})();
