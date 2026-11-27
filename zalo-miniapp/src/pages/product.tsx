import { useState } from 'react';
import { Header, Page, useNavigate, useParams, useSnackbar } from 'zmp-ui';
import { openShareSheet } from 'zmp-sdk/apis';
import { img, vnd } from '../api';
import { useStore } from '../store';
import { Countdown, Empty, Loading, Price, Qty } from '../components/ui';

export default function ProductPage() {
  const { slug } = useParams();
  const { catalog, add, count } = useStore();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [qty, setQty] = useState(1);
  const p = catalog?.products.find((x) => x.slug === slug);

  if (!catalog) return <Page className="page has-header"><Header title="Sản phẩm" /><Loading /></Page>;
  if (!p) return <Page className="page has-header"><Header title="Sản phẩm" /><Empty icon="🔍" text="Sản phẩm không còn bán" /></Page>;
  const out = p.stock <= 0;

  const share = () => openShareSheet({ type: 'text', data: { text: `${p.name} · ${p.subtitle || ''} - ${vnd(p.effective_price)} tại DaLa` } }).catch(() => {});

  return (
    <Page className="page has-header has-bar">
      <Header title={p.name} />
      <div className="pd-img"><img src={img(p.image)} alt={p.name} /></div>
      <div className="section">
        <h1 className="pd-name">{p.name}</h1>
        <div className="psub">{p.subtitle}{p.weight ? ` · ${p.weight}` : ''}</div>
        <Price p={p} />
        {p.flash && (
          <div className="flash-bar">
            <b>⚡ Giá Flash Sale</b>
            <span>{p.flash.left != null ? `Còn ${p.flash.left} suất · ` : ''}kết thúc sau <Countdown to={p.flash.ends_at} /></span>
          </div>
        )}
        {p.badges?.length ? <div className="badges">{p.badges.map((b) => <span key={b}>{b}</span>)}</div> : null}
        {p.kind === 'addon' && <div className="note">Sản phẩm này chỉ bán kèm với sản phẩm khác.</div>}
        {p.short_desc && <p>{p.short_desc}</p>}
      </div>

      {p.components?.length ? (
        <div className="section">
          <h2>Trong bộ có</h2>
          {p.components.map((c) => (
            <div key={c.sku} className="line-item">
              <img src={img(c.image, true)} alt="" />
              <div><div className="n">{c.name}</div><div className="s">{c.subtitle} · SL {c.qty}</div></div>
            </div>
          ))}
        </div>
      ) : null}
      {p.benefits?.length ? <div className="section"><h2>Điểm nổi bật</h2><ul>{p.benefits.map((b) => <li key={b}>{b}</li>)}</ul></div> : null}
      {p.usage && <div className="section"><h2>Cách dùng</h2><p>{p.usage}</p></div>}
      {p.ingredients && <div className="section"><h2>Thành phần</h2><p>{p.ingredients}</p></div>}
      {p.story && <div className="section"><h2>Câu chuyện</h2><p>{p.story}</p></div>}
      <div className="section muted small">Sản phẩm là thực phẩm, không phải thuốc và không có tác dụng thay thế thuốc chữa bệnh.</div>

      <div className="bar">
        <button className="btn ghost icon" onClick={share} aria-label="Chia sẻ">↗</button>
        <Qty value={qty} onChange={(n) => setQty(Math.max(1, n))} max={Math.max(1, p.stock)} />
        <button className="btn ghost" disabled={out} onClick={() => { add(p.sku, qty); openSnackbar({ text: 'Đã thêm vào giỏ', type: 'success', duration: 1500 }); }}>
          Thêm{count ? ` (${count})` : ''}
        </button>
        <button className="btn" disabled={out} onClick={() => { add(p.sku, qty); navigate('/gio-hang'); }}>{out ? 'Hết hàng' : 'Mua ngay'}</button>
      </div>
    </Page>
  );
}
