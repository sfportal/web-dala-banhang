/* DaLa store: giỏ hàng, theo dõi nguồn (CTV, UTM), analytics, hiệu ứng chuyển động */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const vnd = (n) => Math.round(Number(n) || 0).toLocaleString('vi-VN') + 'đ';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BOOT = window.DALA || {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- nguồn truy cập
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const qs = new URLSearchParams(location.search);
  const days = (n) => Date.now() + n * 86400e3;
  if (qs.get('ref')) store.set('dala_ref', { code: qs.get('ref').toUpperCase().slice(0, 20), exp: days(BOOT.cookie_days || 30) });
  if (qs.get('utm_source') || qs.get('fbclid') || qs.get('ttclid')) {
    store.set('dala_utm', { source: qs.get('utm_source') || (qs.get('fbclid') ? 'facebook' : 'tiktok'), medium: qs.get('utm_medium') || (qs.get('utm_source') ? '' : 'paid'), campaign: qs.get('utm_campaign') || '', exp: days(30) });
  } else if (!store.get('dala_utm') && document.referrer && !document.referrer.includes(location.host)) {
    try { const h = new URL(document.referrer).hostname.replace('www.', ''); store.set('dala_utm', { source: h, medium: /google|bing|coccoc/.test(h) ? 'organic' : 'referral', campaign: '', exp: days(30) }); } catch {}
  }
  const ref = () => { const r = store.get('dala_ref'); return r && r.exp > Date.now() ? r.code : null; };
  const utm = () => { const u = store.get('dala_utm'); return u && u.exp > Date.now() ? u : null; };
  let sid = sessionStorage.getItem('dala_sid');
  if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('dala_sid', sid); }

  function track(type, extra = {}) {
    const u = utm() || {};
    const body = JSON.stringify({ type, sid, path: location.pathname, referrer: document.referrer.slice(0, 200), source: u.source, medium: u.medium, campaign: u.campaign, ref: ref(), ...extra });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }));
    else fetch('/api/t', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true });
    if (window.gtag) window.gtag('event', type, extra);
    if (window.fbq && type === 'add_to_cart') window.fbq('track', 'AddToCart');
    if (window.ttq && type === 'add_to_cart') window.ttq.track('AddToCart');
  }
  window.dalaTrack = track;
  track('page_view');
  const pid = document.body.dataset.productId || $('[data-product-id]')?.dataset.productId;
  if (pid) track('view_product', { product_id: Number(pid) });

  // ---------------------------------------------------------------- giỏ hàng
  const cart = {
    items: store.get('dala_cart', []),
    save() { store.set('dala_cart', this.items); updateCount(); },
    add(sku, qty = 1) { const it = this.items.find((i) => i.sku === sku); if (it) it.qty += qty; else this.items.push({ sku, qty }); this.save(); },
    set(sku, qty) { if (qty <= 0) this.items = this.items.filter((i) => i.sku !== sku); else { const it = this.items.find((i) => i.sku === sku); if (it) it.qty = qty; } this.save(); },
    count() { return this.items.reduce((s, i) => s + i.qty, 0); },
    clear() { this.items = []; this.save(); },
  };
  window.dalaCart = cart;
  window.dalaRef = ref; window.dalaUtm = utm; window.dalaSid = sid;

  function updateCount(bump) {
    const el = $('#cartCount'); if (!el) return;
    const n = cart.count();
    el.textContent = n; el.classList.toggle('on', n > 0);
    if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  }
  updateCount();

  function toast(msg, err) {
    const w = $('#toasts'); if (!w) return;
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.innerHTML = msg;
    w.appendChild(t); setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2600);
  }
  window.dalaToast = toast;

  function fly(fromEl, src) {
    const target = $('[data-open-cart]'); if (!target || !fromEl || reduce) return;
    const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
    const img = document.createElement('img'); img.className = 'fly'; img.src = src; img.alt = '';
    img.style.left = a.left + a.width / 2 - 40 + 'px'; img.style.top = a.top + a.height / 2 - 40 + 'px';
    document.body.appendChild(img);
    requestAnimationFrame(() => {
      img.style.transform = `translate(${b.left - a.left - a.width / 2 + 62}px, ${b.top - a.top - a.height / 2 + 62}px) scale(.25) rotate(25deg)`;
      img.style.opacity = '.4';
    });
    setTimeout(() => img.remove(), 850);
  }

  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      e.preventDefault(); e.stopPropagation();
      const sku = add.dataset.add;
      const qtyEl = add.dataset.qtyFrom ? $(add.dataset.qtyFrom) : null;
      const qty = qtyEl ? Math.max(1, Number(qtyEl.textContent || qtyEl.value) || 1) : 1;
      if (add.dataset.buyNow !== undefined) {
        cart.add(sku, qty); track('add_to_cart', { product_id: Number(add.dataset.pid) || null });
        location.href = '/thanh-toan'; return;
      }
      fly(add, add.dataset.img || add.closest('.card')?.querySelector('img')?.src);
      cart.add(sku, qty);
      setTimeout(() => updateCount(true), 650);
      add.classList.add('done'); setTimeout(() => add.classList.remove('done'), 900);
      track('add_to_cart', { product_id: Number(add.closest('[data-product]')?.dataset.product || add.dataset.pid) || null });
      toast(`Đã thêm vào giỏ · <a href="#" data-open-cart style="color:var(--sun);font-weight:800">Xem giỏ</a>`);
      if (document.body.classList.contains('cart-open')) renderCart();
      return;
    }
    if (e.target.closest('[data-open-cart]')) { e.preventDefault(); openCart(); return; }
    if (e.target.closest('[data-close-cart]')) { document.body.classList.remove('cart-open'); return; }
    const q = e.target.closest('[data-q]');
    if (q) { cart.set(q.dataset.sku, Math.max(0, (cart.items.find((i) => i.sku === q.dataset.sku)?.qty || 0) + Number(q.dataset.q))); renderCart(); return; }
    if (e.target.closest('[data-menu]')) { $('#nav')?.classList.toggle('open'); return; }
    const ch = e.target.closest('[data-channel]');
    if (ch) track('click_channel', { campaign: ch.dataset.channel });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('cart-open'); });

  async function quote(extra = {}) {
    const r = await fetch('/api/cart/quote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items: cart.items, ref: ref(), ...extra }) });
    return r.json();
  }
  window.dalaQuote = quote;

  function openCart() { document.body.classList.add('cart-open'); renderCart(); }

  // gộp các dòng tách theo Flash Sale thành một dòng hiển thị
  function groupLines(lines) {
    const m = new Map();
    for (const l of lines) {
      const g = m.get(l.sku) || { ...l, qty: 0, amount: 0, flashQty: 0 };
      g.qty += l.qty; g.amount += l.qty * l.price; if (l.flash) g.flashQty += l.qty;
      m.set(l.sku, g);
    }
    return [...m.values()];
  }
  window.dalaGroupLines = groupLines;

  async function renderCart() {
    const body = $('#cartBody'), foot = $('#cartFoot'); if (!body) return;
    if (!cart.items.length) {
      body.innerHTML = `<div class="empty"><div class="ico">🧺</div><p>Giỏ hàng đang trống.</p><a class="btn" href="/san-pham">Xem sản phẩm</a></div>`;
      foot.innerHTML = ''; return;
    }
    body.style.opacity = '.6';
    const q = await quote();
    body.style.opacity = '1';
    // đồng bộ số lượng nếu server giảm do hết hàng
    const lines = groupLines(q.lines || []);
    const free = q.free_threshold || BOOT.free_threshold || 0;
    const after = q.subtotal - q.discount;
    const pct = free ? Math.min(100, Math.round((after / free) * 100)) : 100;
    let html = '';
    if (free) html += `<div class="freeship">${q.free_gap > 0 ? `Mua thêm <b>${vnd(q.free_gap)}</b> để được <b>miễn phí giao hàng</b> 🚚` : '🎉 Đơn của bạn được <b>miễn phí giao hàng</b>'}<div class="bar"><i style="width:${pct}%"></i></div></div>`;
    for (const e of q.errors || []) html += `<div class="err-box">${esc(e)}</div>`;
    html += lines.map((l) => `<div class="line-item"><img src="${esc(l.image.replace('.webp', '-sm.webp'))}" alt="" onerror="this.src='${esc(l.image)}'"><div><div class="n">${esc(l.name)}</div><div class="s">${esc(l.subtitle || '')}${l.flashQty ? ` · <span style="color:var(--red);font-weight:700">⚡ ${l.flashQty} suất Flash</span>` : ''}</div>
      <div class="qty"><button data-q="-1" data-sku="${esc(l.sku)}" aria-label="Giảm">−</button><span>${l.qty}</span><button data-q="1" data-sku="${esc(l.sku)}" aria-label="Tăng">+</button></div></div><div class="p">${vnd(l.amount)}</div></div>`).join('');
    // gợi ý mua kèm khoai lang (chỉ bán kèm)
    if (!cart.items.some((i) => i.sku === 'KL-250' || i.sku.startsWith('COMBO'))) {
      html += `<div class="upsell"><img src="/assets/img/kl-250-sm.webp" alt=""><div><b style="font-size:.9rem">Mua kèm khoai lang sấy dẻo</b><div class="s muted" style="font-size:.8rem">Không đường · 250g · chỉ bán kèm đơn</div></div><button class="btn sm" data-add="KL-250" data-img="/assets/img/kl-250-sm.webp">+ 59.000đ</button></div>`;
    }
    body.innerHTML = html;
    foot.innerHTML = `<div class="sum-row"><span>Tạm tính</span><b>${vnd(q.subtotal)}</b></div>
      ${q.discount ? `<div class="sum-row" style="color:var(--green)"><span>${esc(q.discount_label || 'Giảm giá')}</span><b>−${vnd(q.discount)}</b></div>` : ''}
      <div class="sum-row muted" style="font-size:.85rem"><span>Phí giao hàng</span><span>tính theo địa chỉ ở bước sau</span></div>
      <a href="/thanh-toan" class="btn sun block" style="margin-top:12px" onclick="dalaTrack('begin_checkout')">Thanh toán · ${vnd(after)} <span class="shine"></span></a>
      <div style="text-align:center;font-size:.8rem;margin-top:8px" class="muted">Chuyển khoản QR tự xác nhận · hoặc COD</div>`;
  }
  window.dalaRenderCart = renderCart;

  // ---------------------------------------------------------------- đếm ngược Flash Sale
  function parseUtc(s) { return new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z')); }
  $$('[data-countdown]').forEach((el) => {
    const end = parseUtc(el.dataset.countdown).getTime();
    const mini = el.classList.contains('mini');
    const units = [['d', 'Ngày'], ['h', 'Giờ'], ['m', 'Phút'], ['s', 'Giây']];
    el.innerHTML = units.map(([k, l]) => `<div class="u"><b data-u="${k}">00</b><small>${l}</small></div>${mini && k !== 's' ? ':' : ''}`).join('');
    const prev = {};
    const tick = () => {
      let t = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const v = { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
      for (const [k] of units) {
        const s = String(v[k]).padStart(2, '0');
        if (prev[k] !== s) { const b = $(`[data-u="${k}"]`, el); b.textContent = s; b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); prev[k] = s; }
      }
      if (t <= 0) { clearInterval(iv); el.closest('[data-flash-wrap]')?.remove(); }
    };
    tick(); const iv = setInterval(tick, 1000);
  });

  // ---------------------------------------------------------------- hiệu ứng
  const hdr = $('#hdr');
  addEventListener('scroll', () => hdr && hdr.classList.toggle('scrolled', scrollY > 10), { passive: true });

  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('[data-reveal]').forEach((el) => io.observe(el));

  const cio = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target; cio.unobserve(el);
    const to = Number(el.dataset.count), dec = Number(el.dataset.dec || 0), suf = el.dataset.suffix || '';
    const t0 = performance.now(), dur = reduce ? 1 : 1400;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); const v = to * (1 - Math.pow(1 - k, 3)); el.textContent = v.toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: 0.5 });
  $$('[data-count]').forEach((el) => cio.observe(el));

  // hành trình: các bước sáng dần khi cuộn
  const steps = $('#steps');
  if (steps) {
    const items = $$('.step', steps);
    const onScroll = () => {
      const r = steps.getBoundingClientRect();
      const k = Math.min(1, Math.max(0, (innerHeight * 0.8 - r.top) / (r.height + innerHeight * 0.3)));
      const n = Math.round(k * items.length);
      items.forEach((s, i) => s.classList.toggle('on', i < Math.max(1, n)));
      steps.style.setProperty('--p', Math.round(k * 100) + '%');
    };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // parallax sân khấu hero theo chuột
  const stage = $('[data-parallax]');
  if (stage && !reduce && matchMedia('(pointer:fine)').matches) {
    const packs = $$('[data-depth]', stage);
    stage.parentElement.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
      packs.forEach((p) => { const d = Number(p.dataset.depth); p.style.transform = `translate(${x * d}px, ${y * d}px) rotate(${x * d * 0.15}deg)`; });
    });
  }
  // nghiêng ảnh sản phẩm chủ lực
  if (!reduce && matchMedia('(pointer:fine)').matches) {
    $$('[data-tilt]').forEach((box) => {
      const img = $('img', box);
      box.addEventListener('mousemove', (e) => { const r = box.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; img.style.transform = `perspective(900px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) scale(1.04)`; });
      box.addEventListener('mouseleave', () => { img.style.transform = ''; });
    });
  }

  // chọn chân dung khách
  $$('[data-persona]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-persona]').forEach((x) => x.classList.toggle('on', x === b));
    $$('[data-view]').forEach((v) => {
      const on = v.dataset.view === b.dataset.persona;
      v.style.display = on ? 'contents' : 'none';
      if (on) $$('.card, .persona-card', v).forEach((c, i) => { c.classList.add('in'); c.classList.remove('swap-in'); void c.offsetWidth; c.style.animationDelay = i * 0.06 + 's'; c.classList.add('swap-in'); });
    });
    track('persona', { campaign: b.dataset.persona });
  }));

  // thanh mua nhanh mobile (trang sản phẩm)
  const mb = $('.mobile-buy'), anchor = $('[data-buy-anchor]');
  if (mb && anchor) new IntersectionObserver(([e]) => mb.classList.toggle('on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(anchor);
})();
