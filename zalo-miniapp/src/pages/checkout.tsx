import { useEffect, useRef, useState } from 'react';
import { Header, Page, useNavigate, useSnackbar } from 'zmp-ui';
import { api, Destination, GeoAddress, GeoItem, groupLines, img, Quote, vnd } from '../api';
import { useStore } from '../store';
import { useZaloProfile } from '../components/welcome';
import { askPermissions, matchPlace } from '../zalo';
import { Empty, Loading } from '../components/ui';

type Pay = 'cod' | 'sepay';

function Sel({ label, value, items, ph, onChange, disabled }: { label: string; value: string; items: GeoItem[]; ph: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        <option value="">{ph}</option>
        {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </label>
  );
}

export default function CheckoutPage() {
  const { cart, clear, customer, setCustomer, addOrder, located, ref } = useStore();
  const { login, findMe } = useZaloProfile();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [f, setF] = useState({ name: customer.name || '', phone: customer.phone || '', address: customer.address || '', note: '' });
  const [geoSource, setGeoSource] = useState<'goship' | 'static'>('static');
  const [cities, setCities] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [wards, setWards] = useState<GeoItem[]>([]);
  const [city, setCity] = useState(customer.city || '');
  const [district, setDistrict] = useState(customer.district || '');
  const [ward, setWard] = useState(customer.ward || '');
  const [pay, setPay] = useState<Pay>('cod');
  const [rateId, setRateId] = useState<string | null>(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucher, setVoucher] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const first = useRef(true);
  // Địa chỉ lấy từ vị trí hiện tại, khớp lần lượt tỉnh → quận → phường khi danh sách tải xong
  const pending = useRef<GeoAddress | null>(null);
  const autoLoc = useRef(false);
  const [locating, setLocating] = useState(false);

  // Địa chỉ: dùng danh sách Goship khi website đã kết nối, nếu không chỉ chọn tỉnh và ghi phường/xã vào địa chỉ
  useEffect(() => {
    api.cities().then((d) => {
      setCities(d.items || []);
      setGeoSource(d.source === 'goship' && d.items?.length ? 'goship' : 'static');
    });
  }, []);
  useEffect(() => {
    if (geoSource !== 'goship' || !city) { setDistricts([]); return; }
    api.districts(city).then((d) => {
      if (!d.items.length) { setGeoSource('static'); return; }
      setDistricts(d.items);
      const a = pending.current;
      if (a) {
        const m = matchPlace(d.items, [a.district, ...a.names]);
        if (m) setDistrict(m.id); else pending.current = null;
      }
    });
    if (!first.current) { setDistrict(''); setWard(''); }
  }, [city, geoSource]);
  useEffect(() => {
    if (geoSource !== 'goship' || !district) { setWards([]); return; }
    api.wards(district).then((d) => {
      setWards(d.items);
      const a = pending.current;
      if (a) { const m = matchPlace(d.items, [a.ward, ...a.names]); if (m) setWard(m.id); pending.current = null; }
    });
    if (!first.current) setWard('');
    first.current = false;
  }, [district, geoSource]);

  const applyLocation = (a: GeoAddress | null) => {
    if (!a || !cities.length) return false;
    const c = matchPlace(cities, [a.province, ...a.names]);
    if (!c) { openSnackbar({ text: 'Chưa khớp được tỉnh/thành từ vị trí, vui lòng chọn tay', type: 'warning' }); return false; }
    pending.current = geoSource === 'goship' ? a : null;
    first.current = false;
    if (c.id === city && geoSource === 'goship') { // cùng tỉnh: khớp lại quận ngay
      const d = matchPlace(districts, [a.district, ...a.names]);
      if (d) setDistrict(d.id);
    }
    setCity(c.id);
    if (!f.address.trim()) {
      const parts = geoSource === 'goship' ? [a.road] : [a.road, a.ward, a.district];
      const addr = parts.filter(Boolean).join(', ');
      if (addr) setF((x) => ({ ...x, address: x.address || addr }));
    }
    return true;
  };
  // Lần đầu mở trang: chưa có địa chỉ đã lưu thì dùng vị trí đã lấy ở màn hình chào
  useEffect(() => {
    if (autoLoc.current || !cities.length) return;
    autoLoc.current = true;
    if (!city && located) applyLocation({ display: null, ...located, province: located.province || null, district: located.district || null, ward: located.ward || null, road: located.road || null, names: located.names || [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);
  // Đăng nhập bằng SĐT Zalo xong thì điền vào ô còn trống
  useEffect(() => {
    setF((x) => ({ ...x, name: x.name || customer.name || '', phone: x.phone || customer.phone || '' }));
  }, [customer.name, customer.phone]);

  const useMyLocation = async () => {
    setLocating(true);
    const g = await askPermissions(['scope.userLocation']);
    if (g['scope.userLocation']) { const a = await findMe(); if (a) applyLocation({ ...a }); }
    else openSnackbar({ text: 'Bạn chưa cho phép lấy vị trí', type: 'warning' });
    setLocating(false);
  };

  const name = (list: GeoItem[], id: string) => list.find((i) => i.id === id)?.name || '';
  const to = (): Destination | null => {
    if (!city) return null;
    if (geoSource === 'goship') {
      const cn = name(cities, city);
      return { city, district, ward, province: cn, city_name: cn, district_name: name(districts, district), ward_name: name(wards, ward) };
    }
    return { province: city };
  };

  const dest = to();
  const destKey = JSON.stringify(dest);
  useEffect(() => {
    if (!cart.length) return;
    let live = true;
    const t = setTimeout(() => {
      api.quote({ items: cart, voucher, ref, phone: f.phone, to: dest, payment_method: pay, rate_id: rateId })
        .then((q) => { if (!live) return; setQuote(q); setRateId(q.shipping?.selected?.id || null); })
        .catch((e) => live && setErr(e.message));
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, voucher, destKey, pay, rateId, f.phone, ref]);

  const fillFromZalo = async () => {
    const g = await askPermissions(['scope.userInfo', 'scope.userPhonenumber']);
    if (g['scope.userPhonenumber']) await login();
    else openSnackbar({ text: 'Bạn chưa cho phép chia sẻ số điện thoại Zalo', type: 'warning' });
  };

  const submit = async () => {
    const miss = [[f.name.trim(), 'họ tên'], [f.phone.trim(), 'số điện thoại'], [city, 'tỉnh/thành'], ...(geoSource === 'goship' ? [[district, 'quận/huyện']] : []), [f.address.trim(), 'địa chỉ']]
      .filter(([v]) => !v).map(([, l]) => l);
    if (miss.length) { openSnackbar({ text: 'Vui lòng nhập ' + miss.join(', '), type: 'error' }); return; }
    setSubmitting(true); setErr(null);
    try {
      const d = await api.checkout({
        ...f, to: dest, items: cart, voucher, ref, payment_method: pay, rate_id: rateId,
        channel: 'zalo', utm: { source: 'zalo', medium: 'miniapp' },
      });
      setCustomer({ name: f.name, phone: f.phone, address: f.address, city, district, ward });
      addOrder({ code: d.code, token: d.token, total: d.total, at: new Date().toISOString() });
      clear();
      navigate(`/don-hang/${d.code}?t=${d.token}&new=1`, { replace: true });
    } catch (e: any) {
      setErr(e.message);
      openSnackbar({ text: e.message, type: 'error' });
    } finally { setSubmitting(false); }
  };

  if (!cart.length) return <Page className="page has-header"><Header title="Thanh toán" /><Empty icon="🧺" text="Giỏ hàng trống" /></Page>;
  const sh = quote?.shipping;
  const total = quote ? (dest ? quote.total : quote.subtotal - quote.discount) : 0;

  return (
    <Page className="page has-header has-bar">
      <Header title="Thanh toán" />
      <div className="section">
        <div className="row-between"><h2>Người nhận</h2><button className="link" onClick={fillFromZalo}>Dùng thông tin Zalo</button></div>
        <label className="field"><span>Họ tên</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></label>
        <label className="field"><span>Số điện thoại</span><input value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="10 số, bắt đầu bằng 0" /></label>
        <div className="row-between" style={{ marginBottom: 6 }}><span className="muted small">Địa chỉ nhận hàng</span><button className="link loc-btn" disabled={locating} onClick={useMyLocation}>{locating ? <><span className="spin" /> Đang lấy vị trí…</> : '📍 Dùng vị trí hiện tại'}</button></div>
        <Sel label="Tỉnh/thành" value={city} items={cities} ph="Chọn tỉnh/thành" onChange={setCity} />
        {geoSource === 'goship' && (
          <>
            <Sel label="Quận/huyện" value={district} items={districts} ph={city ? 'Chọn quận/huyện' : 'Chọn tỉnh trước'} onChange={setDistrict} disabled={!city} />
            <Sel label="Phường/xã" value={ward} items={wards} ph={district ? 'Chọn phường/xã' : 'Chọn quận trước'} onChange={setWard} disabled={!district} />
          </>
        )}
        <label className="field"><span>Địa chỉ {geoSource === 'static' ? '(ghi rõ phường/xã)' : ''}</span>
          <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder={geoSource === 'static' ? 'Số nhà, đường, phường/xã' : 'Số nhà, tên đường'} /></label>
        <label className="field"><span>Ghi chú</span><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Không bắt buộc" /></label>
      </div>

      <div className="section">
        <h2>Thanh toán</h2>
        <label className={'opt' + (pay === 'cod' ? ' on' : '')}><input type="radio" checked={pay === 'cod'} onChange={() => setPay('cod')} /><div><b>Tiền mặt khi nhận hàng (COD)</b></div></label>
        <label className={'opt' + (pay === 'sepay' ? ' on' : '')}><input type="radio" checked={pay === 'sepay'} onChange={() => setPay('sepay')} /><div><b>Chuyển khoản VietQR</b><small>Quét mã bằng app ngân hàng, đơn tự xác nhận khi tiền về</small></div></label>
      </div>

      {dest && sh?.options?.length ? (
        <div className="section">
          <h2>Giao hàng</h2>
          {sh.options.map((o) => (
            <label key={o.id} className={'opt' + (o.id === rateId ? ' on' : '')}>
              <input type="radio" checked={o.id === rateId} onChange={() => setRateId(o.id)} />
              <div><b>{o.carrier}{o.service ? ' · ' + o.service : ''}</b>{o.eta ? <small>Dự kiến giao {o.eta.text}</small> : o.expected ? <small>{o.expected}</small> : null}</div>
              <b>{sh.shop_pays ? 'Miễn phí' : vnd(o.fee)}</b>
            </label>
          ))}
        </div>
      ) : null}

      <div className="section">
        <h2>Đơn hàng</h2>
        {!quote ? <Loading /> : groupLines(quote.lines).map((l) => (
          <div key={l.sku} className="line-item">
            <img src={img(l.image, true)} alt="" />
            <div><div className="n">{l.name}</div><div className="s">{l.subtitle} · SL {l.qty}{l.flashQty ? ' · ⚡ Flash' : ''}</div></div>
            <div className="p">{vnd(l.amount)}</div>
          </div>
        ))}
        <div className="voucher">
          <input value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} placeholder="Mã giảm giá hoặc mã CTV" />
          <button className="btn ghost sm" onClick={() => setVoucher(voucherInput.trim())}>Áp dụng</button>
        </div>
        {quote && (
          <>
            {quote.free_gap ? <div className="note">Mua thêm <b>{vnd(quote.free_gap)}</b> để được miễn phí giao hàng.</div> : null}
            <div className="sum-row"><span>Tạm tính</span><b>{vnd(quote.subtotal)}</b></div>
            {quote.discount ? <div className="sum-row green"><span>{quote.discount_label || 'Giảm giá'}</span><b>−{vnd(quote.discount)}</b></div> : null}
            <div className="sum-row"><span>Phí giao hàng</span><b>{!dest ? '—' : sh?.shop_pays ? 'Miễn phí' : vnd(sh?.fee)}</b></div>
            {dest && sh?.selected?.eta ? <div className="sum-row"><span>Dự kiến giao</span><b>{sh.selected.eta.text}</b></div> : null}
            <div className="sum-row total"><span>Tổng cộng</span><b>{vnd(total)}</b></div>
            {quote.affiliate ? <div className="note">🤝 Đơn được giới thiệu bởi cộng tác viên <b>{quote.affiliate.name}</b> ({quote.affiliate.code})</div> : null}
            {quote.errors.map((e) => <div key={e} className="err">{e}</div>)}
          </>
        )}
        {err && <div className="err">{err}</div>}
      </div>

      <div className="bar">
        <div className="bar-total"><small>Tổng cộng</small><b>{vnd(total)}</b></div>
        <button className="btn" disabled={submitting || !quote?.lines.length} onClick={submit}>
          {submitting ? 'Đang tạo đơn…' : pay === 'cod' ? 'Đặt hàng COD' : 'Đặt hàng & lấy mã QR'}
        </button>
      </div>
    </Page>
  );
}
