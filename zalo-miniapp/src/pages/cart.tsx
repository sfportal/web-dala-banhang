import { useEffect, useState } from 'react';
import { Page, useNavigate } from 'zmp-ui';
import { api, groupLines, img, Quote, vnd } from '../api';
import { useStore } from '../store';
import { Empty, Loading, Qty } from '../components/ui';

export default function CartPage() {
  const { cart, setQty } = useStore();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Giá luôn tính lại ở máy chủ (flash sale, tồn kho, combo) mỗi khi giỏ đổi
  useEffect(() => {
    if (!cart.length) { setQuote(null); return; }
    let live = true;
    const t = setTimeout(() => {
      api.quote({ items: cart }).then((q) => live && (setQuote(q), setErr(null))).catch((e) => live && setErr(e.message));
    }, 200);
    return () => { live = false; clearTimeout(t); };
  }, [cart]);

  if (!cart.length) {
    return (
      <Page className="page has-nav">
        <div className="title">Giỏ hàng</div>
        <Empty icon="🧺" text="Giỏ hàng đang trống"><button className="btn" onClick={() => navigate('/')}>Chọn sản phẩm</button></Empty>
      </Page>
    );
  }
  const lines = groupLines(quote?.lines || []);
  const after = quote ? quote.subtotal - quote.discount : 0;

  return (
    <Page className="page has-nav has-bar">
      <div className="title">Giỏ hàng</div>
      {!quote && !err && <Loading />}
      {err && <div className="err">{err}</div>}
      {quote && (
        <>
          <div className="section">
            {lines.map((l) => (
              <div key={l.sku} className="line-item">
                <img src={img(l.image, true)} alt="" />
                <div>
                  <div className="n">{l.name}</div>
                  <div className="s">{l.subtitle}{l.flashQty ? ' · ⚡ Flash' : ''}</div>
                  <div className="p">{vnd(l.amount)}</div>
                </div>
                <Qty value={cart.find((i) => i.sku === l.sku)?.qty || l.qty} onChange={(n) => setQty(l.sku, n)} />
              </div>
            ))}
            {quote.errors.map((e) => <div key={e} className="err">{e}</div>)}
          </div>
          <div className="section">
            {quote.free_gap ? <div className="note">Mua thêm <b>{vnd(quote.free_gap)}</b> để được miễn phí giao hàng.</div> : null}
            <div className="sum-row"><span>Tạm tính</span><b>{vnd(quote.subtotal)}</b></div>
            <div className="muted small">Phí giao hàng và mã giảm giá tính ở bước thanh toán.</div>
          </div>
          <div className="bar">
            <div className="bar-total"><small>Tạm tính</small><b>{vnd(after)}</b></div>
            <button className="btn" disabled={!quote.lines.length} onClick={() => navigate('/thanh-toan')}>Đặt hàng</button>
          </div>
        </>
      )}
    </Page>
  );
}
