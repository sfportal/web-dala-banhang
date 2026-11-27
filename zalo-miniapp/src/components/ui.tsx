import { ReactNode, useEffect, useState } from 'react';
import { Product, img, vnd } from '../api';

export function Price({ p }: { p: Product }) {
  return (
    <div className="price">
      <b>{vnd(p.effective_price)}</b>
      {p.ref_price ? <s>{vnd(p.ref_price)}</s> : null}
      {p.save_pct ? <span className="pct">−{p.save_pct}%</span> : null}
    </div>
  );
}

export function ProductCard({ p, onOpen, onAdd }: { p: Product; onOpen: () => void; onAdd: () => void }) {
  const out = p.stock <= 0;
  return (
    <div className="card pcard" onClick={onOpen}>
      <div className="pimg">
        <img src={img(p.image, true)} alt={p.name} loading="lazy" onError={(e) => { const t = e.currentTarget; if (t.src !== img(p.image)) t.src = img(p.image); }} />
        {p.flash && <span className="tag flash">⚡ Flash</span>}
        {out && <span className="tag out">Hết hàng</span>}
      </div>
      <div className="pbody">
        <div className="pname">{p.name}</div>
        <div className="psub">{p.subtitle}</div>
        <Price p={p} />
        <button className="btn sm" disabled={out} onClick={(e) => { e.stopPropagation(); onAdd(); }}>
          {out ? 'Hết hàng' : 'Thêm vào giỏ'}
        </button>
      </div>
    </div>
  );
}

// Đếm ngược Flash Sale (giờ máy chủ lưu theo UTC dạng 'YYYY-MM-DD HH:MM:SS')
export function Countdown({ to }: { to: string }) {
  const end = Date.parse(to.replace(' ', 'T') + 'Z');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((end - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return <span className="cd">{pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}</span>;
}

export function Empty({ icon, text, children }: { icon: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <p>{text}</p>
      {children}
    </div>
  );
}

export function Loading() {
  return <div className="loading"><span className="spin" /> Đang tải…</div>;
}

export function Qty({ value, onChange, max = 99 }: { value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="qty">
      <button onClick={() => onChange(value - 1)} aria-label="Giảm">−</button>
      <span>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} aria-label="Tăng">+</button>
    </div>
  );
}
