import { useMemo, useState } from 'react';
import { Page, useNavigate, useSnackbar } from 'zmp-ui';
import { useStore } from '../store';
import { Product } from '../api';
import { Countdown, Empty, Loading, ProductCard } from '../components/ui';
import logo from '../logo.png';

// Cùng bộ lọc với trang /san-pham của website
const LINES: [string, string][] = [
  ['', 'Tất cả'], ['chu-luc', 'Chủ lực'], ['combo', 'Combo & hộp quà'], ['dung-thu', 'Cỡ dùng thử'], ['chuoi', 'Bột chuối xanh'], ['chanhleo', 'Chanh leo'], ['quan', 'Cho quán'],
];
const match = (p: Product, f: string) => !f ? true : f === 'chu-luc' ? p.kind === 'main' || p.kind === 'b2b' : f === 'combo' ? ['combo', 'gift'].includes(p.kind)
  : f === 'dung-thu' ? p.kind === 'trial' : f === 'quan' ? p.kind === 'b2b' || !!p.personas?.includes('quan-tra') : p.line === f;

export default function HomePage() {
  const { catalog, catalogError, reloadCatalog, add } = useStore();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [line, setLine] = useState('');
  const [q, setQ] = useState('');

  const products = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (catalog?.products || []).filter((p) => match(p, line) && (!kw || `${p.name} ${p.subtitle || ''}`.toLowerCase().includes(kw)));
  }, [catalog, line, q]);
  const flashItems = (catalog?.products || []).filter((p) => p.flash);

  const addToCart = (sku: string, name: string) => {
    add(sku);
    openSnackbar({ text: `Đã thêm ${name} vào giỏ`, type: 'success', duration: 1800 });
  };

  return (
    <Page className="page has-nav">
      <div className="hero">
        <img src={logo} alt="DaLa" className="logo" />
        <div>
          <div className="hero-t">Nắng cao nguyên</div>
          <div className="hero-s">Quét QR thấy vườn · Hợp tác xã DaLa</div>
        </div>
      </div>
      <div className="search">
        <input placeholder="Tìm sản phẩm" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {catalog?.flash && flashItems.length > 0 && (
        <div className="flash-bar">
          <b>⚡ {catalog.flash.name}</b>
          <span>Kết thúc sau <Countdown to={catalog.flash.ends_at} /></span>
        </div>
      )}

      <div className="chips">
        {LINES.map(([k, label]) => (
          <button key={k} className={'chip' + (line === k ? ' on' : '')} onClick={() => setLine(k)}>{label}</button>
        ))}
      </div>

      {catalogError ? (
        <Empty icon="📶" text={catalogError}><button className="btn" onClick={reloadCatalog}>Thử lại</button></Empty>
      ) : !catalog ? (
        <Loading />
      ) : products.length === 0 ? (
        <Empty icon="🔍" text="Chưa có sản phẩm phù hợp" />
      ) : (
        <div className="grid">
          {products.map((p) => (
            <ProductCard key={p.sku} p={p} onOpen={() => navigate('/san-pham/' + p.slug)} onAdd={() => addToCart(p.sku, p.name)} />
          ))}
        </div>
      )}
    </Page>
  );
}
