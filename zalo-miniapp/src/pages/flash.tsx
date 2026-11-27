import { Page, useNavigate, useSnackbar } from 'zmp-ui';
import { img, Product, vnd } from '../api';
import { useStore } from '../store';
import { Countdown, Empty, Loading, ProductCard } from '../components/ui';

function FlashRow({ p, onOpen, onAdd }: { p: Product; onOpen: () => void; onAdd: () => void }) {
  const f = p.flash!;
  const pct = f.quota ? Math.min(100, Math.round((f.sold / f.quota) * 100)) : 0;
  const out = p.stock <= 0 || f.left === 0;
  return (
    <div className="line-item" onClick={onOpen}>
      <img src={img(p.image, true)} alt="" />
      <div>
        <div className="n">{p.name}</div>
        <div className="s">{p.subtitle}</div>
        <div className="price"><b>{vnd(f.price)}</b><s>{vnd(p.price)}</s>{p.save_pct ? <span className="pct">−{p.save_pct}%</span> : null}</div>
        {f.quota ? <><div className="meter"><i style={{ width: pct + '%' }} /></div><div className="meter-t">{f.left === 0 ? 'Đã hết suất' : `Đã bán ${f.sold}/${f.quota} suất`}{f.per_order ? ` · tối đa ${f.per_order}/đơn` : ''}</div></> : null}
      </div>
      <button className="btn sm" disabled={out} onClick={(e) => { e.stopPropagation(); onAdd(); }}>{out ? 'Hết' : 'Mua'}</button>
    </div>
  );
}

export default function FlashPage() {
  const { catalog, add } = useStore();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const items = (catalog?.products || []).filter((p) => p.flash);
  const others = (catalog?.products || []).filter((p) => !p.flash && p.kind !== 'addon').slice(0, 4);
  const buy = (p: Product) => { add(p.sku); openSnackbar({ text: `Đã thêm ${p.name} vào giỏ`, type: 'success', duration: 1800 }); };

  return (
    <Page className="page has-nav">
      <div className="flash-hero">
        <h1>⚡ Flash Sale</h1>
        {catalog?.flash ? (
          <div>{catalog.flash.name} · kết thúc sau <Countdown to={catalog.flash.ends_at} /></div>
        ) : catalog?.next_flash ? (
          <div>{catalog.next_flash.name} · bắt đầu sau <Countdown to={catalog.next_flash.starts_at} /></div>
        ) : <div>Giá sốc, số suất có hạn. Hết suất về giá thường.</div>}
      </div>

      {!catalog ? <Loading /> : catalog.flash && items.length ? (
        <div className="section">
          {items.map((p) => <FlashRow key={p.sku} p={p} onOpen={() => navigate('/san-pham/' + p.slug)} onAdd={() => buy(p)} />)}
          <p className="muted small">Giá Flash áp dụng cho số suất còn lại tại thời điểm đặt; vượt suất hoặc hết giờ sẽ tính giá thường.</p>
        </div>
      ) : (
        <>
          <Empty icon="⚡" text={catalog.next_flash ? 'Đợt Flash Sale tiếp theo sắp bắt đầu, quay lại đúng giờ để giành suất nhé.' : 'Hiện chưa có Flash Sale. Quan tâm OA DaLa để nhận thông báo đợt tiếp theo.'} />
          {others.length ? <><div className="title" style={{ paddingTop: 0 }}>Gợi ý cho bạn</div>
            <div className="grid">{others.map((p) => <ProductCard key={p.sku} p={p} onOpen={() => navigate('/san-pham/' + p.slug)} onAdd={() => buy(p)} />)}</div></> : null}
        </>
      )}
    </Page>
  );
}
