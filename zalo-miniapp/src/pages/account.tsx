import { useCallback, useEffect, useState } from 'react';
import { Page, useNavigate, useSnackbar } from 'zmp-ui';
import { openShareSheet } from 'zmp-sdk/apis';
import { AccountMe, AffMe, AffOrder, api, API_BASE, GeoItem, vnd, when } from '../api';
import { useStore } from '../store';
import { Loading } from '../components/ui';
import { openPage, useZaloProfile } from '../components/welcome';
import { askPermissions } from '../zalo';

const APP_ID = import.meta.env.VITE_APP_ID || '430626676807016551';
const BANKS = ['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'MB Bank', 'Techcombank', 'ACB', 'VPBank', 'TPBank', 'Sacombank', 'VIB', 'HDBank', 'SHB', 'OCB', 'MSB', 'SeABank', 'Eximbank', 'LPBank', 'Nam A Bank', 'Bac A Bank'];
const ST: Record<string, string> = { pending: 'Chờ duyệt', available: 'Khả dụng', void: 'Đã huỷ', paid: 'Đã trả', requested: 'Đã yêu cầu', approved: 'Đã duyệt', rejected: 'Từ chối' };

function copy(text: string, done: () => void) { navigator.clipboard?.writeText(text).then(done).catch(() => {}); }

function Register({ me, onDone }: { me: AccountMe; onDone: () => void }) {
  const { openSnackbar } = useSnackbar();
  const { ref, located } = useStore();
  const [provinces, setProvinces] = useState<GeoItem[]>([]);
  const [f, setF] = useState({ name: me.customer?.name || '', birth_date: '', id_number: '', address: me.customer?.address || '', province: me.customer?.province || located?.province || '',
    email: me.customer?.email || '', channel_note: '', bank_name: '', bank_account: '', bank_holder: '', tax_code: '' });
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { api.cities().then((d) => setProvinces(d.items)); }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const d = await api.registerAffiliate({ ...f, ref, agree_policy: agree });
      openSnackbar({ text: d.status === 'active' ? `Chúc mừng! Mã cộng tác viên của bạn là ${d.code}` : 'Đã gửi đăng ký, DaLa sẽ duyệt sớm', type: 'success' });
      onDone();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="section">
      <h2>Đăng ký cộng tác viên</h2>
      <p className="muted small">Giới thiệu sản phẩm DaLa, nhận hoa hồng trên mỗi đơn khách mua qua mã hoặc link của bạn, cộng thêm hoa hồng từ đội nhóm. Thông tin CCCD, ngân hàng, mã số thuế chỉ dùng để chi trả và khấu trừ thuế.</p>
      {ref ? <div className="note">Người giới thiệu: <b>{ref}</b></div> : null}
      <label className="field"><span>Họ và tên theo CCCD</span><input value={f.name} onChange={set('name')} /></label>
      <label className="field"><span>Ngày sinh</span><input type="date" value={f.birth_date} onChange={set('birth_date')} /></label>
      <label className="field"><span>Số CCCD (12 số)</span><input inputMode="numeric" value={f.id_number} onChange={set('id_number')} /></label>
      <label className="field"><span>Tỉnh/thành</span>
        <select value={f.province} onChange={set('province')}><option value="">Chọn tỉnh/thành</option>
          {provinces.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
          {f.province && !provinces.some((p) => p.name === f.province) ? <option value={f.province}>{f.province}</option> : null}
        </select></label>
      <label className="field"><span>Địa chỉ</span><input value={f.address} onChange={set('address')} placeholder="Số nhà, đường, phường/xã" /></label>
      <label className="field"><span>Email (không bắt buộc)</span><input type="email" value={f.email} onChange={set('email')} /></label>
      <label className="field"><span>Kênh bán (không bắt buộc)</span><input value={f.channel_note} onChange={set('channel_note')} placeholder="Facebook, TikTok, nhóm Zalo, cửa hàng…" /></label>
      <label className="field"><span>Ngân hàng</span><input list="banks" value={f.bank_name} onChange={set('bank_name')} /></label>
      <datalist id="banks">{BANKS.map((b) => <option key={b} value={b} />)}</datalist>
      <label className="field"><span>Số tài khoản</span><input inputMode="numeric" value={f.bank_account} onChange={set('bank_account')} /></label>
      <label className="field"><span>Chủ tài khoản (đứng tên bạn)</span><input value={f.bank_holder} onChange={(e) => setF({ ...f, bank_holder: e.target.value.toUpperCase() })} /></label>
      <label className="field"><span>Mã số thuế cá nhân (10 hoặc 12 số)</span><input inputMode="numeric" value={f.tax_code} onChange={set('tax_code')} /></label>
      <label className="agree"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>Tôi đủ 18 tuổi, đã đọc và đồng ý <a href="#" className="green" onClick={(e) => { e.preventDefault(); openPage('/chinh-sach#ctv'); }}><b>Chính sách cộng tác viên</b></a> của DaLa.</span></label>
      {err && <div className="err">{err}</div>}
      <button className="btn block" disabled={busy || !agree} onClick={submit}>{busy ? 'Đang gửi…' : 'Đăng ký cộng tác viên'}</button>
    </div>
  );
}

function Affiliate({ status }: { status: string }) {
  const { openSnackbar } = useSnackbar();
  const [d, setD] = useState<AffMe | null>(null);
  const [rows, setRows] = useState<AffOrder[]>([]);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const load = useCallback(() => { api.affMe().then(setD).catch((e) => setErr(e.message)); api.affOrders().then(setRows).catch(() => {}); }, []);
  useEffect(load, [load]);
  if (err && !d) return <div className="section"><div className="err">{err}</div></div>;
  if (!d) return <div className="section"><Loading /></div>;
  const w = d.wallet;
  const share = () => openShareSheet({ type: 'zmp_deep_link', data: { title: 'DaLa · Nông sản Tây Nguyên', description: `Mua với mã ${d.me.code} để được ưu đãi`, thumbnail: API_BASE + '/assets/img/og.jpg', path: `/?ref=${d.me.code}` } })
    .catch(() => copy(`https://zalo.me/s/${APP_ID}/?ref=${d.me.code}`, () => openSnackbar({ text: 'Đã chép link giới thiệu' })));
  const withdraw = async () => {
    setBusy(true);
    try { await api.withdraw(Number(amount.replace(/\D/g, ''))); setAmount(''); openSnackbar({ text: 'Đã gửi yêu cầu rút tiền', type: 'success' }); load(); }
    catch (e: any) { openSnackbar({ text: e.message, type: 'error' }); } finally { setBusy(false); }
  };
  return (
    <>
      <div className="section">
        <div className="row-between"><h2>Cộng tác viên</h2><span className="pill small">Hạng {d.me.tier?.name}</span></div>
        {status === 'pending' && <div className="note">Hồ sơ đang chờ DaLa duyệt. Bạn vẫn có thể chia sẻ mã ngay.</div>}
        <div className="code-box"><div><small className="muted">Mã giới thiệu</small><br /><b>{d.me.code}</b></div>
          <div className="row-gap"><button className="btn ghost sm" onClick={() => copy(d.me.code, () => openSnackbar({ text: 'Đã chép mã' }))}>Chép</button><button className="btn sm" onClick={share}>Chia sẻ</button></div></div>
        <p className="muted small">Khách mua qua link hoặc nhập mã ở bước thanh toán{d.policy.buyer_discount_pct ? ` được giảm ${d.policy.buyer_discount_pct}%` : ''}, bạn nhận hoa hồng. Link có hiệu lực {d.policy.cookie_days || 30} ngày.</p>
        <div className="stat-grid">
          <div className="stat hi"><small>Số dư rút được</small><b>{vnd(w.balance)}</b></div>
          <div className="stat"><small>Đang chờ ({d.policy.hold_days ?? 7} ngày sau giao)</small><b>{vnd(w.pending)}</b></div>
          <div className="stat"><small>Doanh số tháng này</small><b>{vnd(d.month.sales)}</b></div>
          <div className="stat"><small>Hoa hồng tháng này</small><b>{vnd(d.month.comm)}</b></div>
          <div className="stat"><small>Đã rút</small><b>{vnd(w.paid)}</b></div>
          <div className="stat"><small>Đội nhóm F1 · F2</small><b>{d.team.f1} · {d.team.f2}</b></div>
        </div>
        {d.next_tier ? <p className="muted small">Lên hạng {d.next_tier.name} khi doanh số tháng đạt {vnd(d.next_tier.min_sales)}.</p> : null}
      </div>

      <div className="section">
        <h2>Rút hoa hồng</h2>
        {d.me.bank_account ? <p className="muted small">Về {d.me.bank_name} · {d.me.bank_account} · {d.me.bank_holder}. Tối thiểu {vnd(d.policy.min_withdraw)}, chi trả {d.policy.payout_days || 'định kỳ'}. DaLa khấu trừ thuế TNCN trước khi chuyển.</p>
          : <div className="note">Bạn chưa có tài khoản ngân hàng, cập nhật tại trang Cộng tác viên trên website.</div>}
        <div className="voucher"><input inputMode="numeric" placeholder="Số tiền muốn rút" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn sm" disabled={busy || !amount || !d.me.bank_account} onClick={withdraw}>Rút</button></div>
        {d.withdrawals.slice(0, 5).map((x) => <div key={x.id} className="comm-row"><span>{when(x.created_at)}</span><b>{vnd(x.amount)}</b><span className={'st ' + x.status}>{ST[x.status] || x.status}</span></div>)}
      </div>

      <div className="section">
        <h2>Hoa hồng gần đây</h2>
        {rows.length === 0 ? <p className="muted small">Chưa có đơn nào qua mã của bạn. Chia sẻ mã để bắt đầu nhé!</p> : rows.slice(0, 30).map((r, i) => (
          <div key={i} className="comm-row">
            <div><b>{r.code}</b> · {r.buyer}<div className="muted small">{when(r.created_at)} · {r.level_name} · {r.status_label}</div></div>
            <div style={{ textAlign: 'right' }}><b className="green">+{vnd(r.amount)}</b><div><span className={'st ' + r.cstatus}>{ST[r.cstatus] || r.cstatus}</span></div></div>
          </div>
        ))}
        <button className="link" onClick={() => openPage('/ctv')}>Xem đầy đủ trên website ›</button>
      </div>
    </>
  );
}

export default function AccountPage() {
  const { session, setSession, customer, setCustomer } = useStore();
  const navigate = useNavigate();
  const { login } = useZaloProfile();
  const [me, setMe] = useState<AccountMe | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!session) { setMe({ guest: true }); return; }
    setMe(null);
    api.me().then((d) => {
      if (d.guest) setSession('');
      else if (d.customer && (!customer.phone || !customer.name)) setCustomer({ ...customer, name: customer.name || d.customer.name || '', phone: customer.phone || d.customer.phone });
      setMe(d);
    }).catch((e) => { if (e.status === 401) setSession(''); setMe({ guest: true }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, setSession]);
  useEffect(load, [load]);

  const signIn = async () => {
    setBusy(true);
    const g = await askPermissions(['scope.userInfo', 'scope.userPhonenumber']);
    if (g['scope.userPhonenumber']) await login();
    setBusy(false);
  };
  const signOut = async () => { await api.logout().catch(() => {}); setSession(''); };

  return (
    <Page className="page has-nav">
      <div className="title">Tài khoản</div>
      {!me ? <Loading /> : me.guest ? (
        <div className="section center">
          <div className="big">👤</div>
          <h2>Đăng nhập bằng số điện thoại Zalo</h2>
          <p className="muted small">Xem điểm tích luỹ, đơn đã mua trên website và Zalo, đăng ký cộng tác viên để nhận hoa hồng. Không cần mật khẩu.</p>
          <button className="btn block" disabled={busy} onClick={signIn}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập bằng số Zalo'}</button>
          <p className="muted small">Bằng việc đăng nhập, bạn đồng ý <a href="#" className="green" onClick={(e) => { e.preventDefault(); openPage('/dieu-khoan-zalo'); }}>Điều khoản sử dụng</a> của DaLa.</p>
        </div>
      ) : (
        <>
          <div className="section">
            <div className="row-between"><div><b>{me.customer?.name || customer.name || 'Khách DaLa'}</b><div className="muted small">{me.customer?.phone}</div></div>
              <button className="link" onClick={signOut}>Đăng xuất</button></div>
            <div className="stat-grid">
              {me.loyalty?.enabled ? <div className="stat hi"><small>Điểm tích luỹ</small><b>{me.loyalty.points} điểm</b><small>≈ {vnd(me.loyalty.value)}</small></div> : null}
              <div className="stat"><small>Đơn đã mua</small><b>{me.stats?.n || 0} đơn</b><small>{vnd(me.stats?.spent)}</small></div>
            </div>
            <div className="row-gap"><button className="btn ghost sm" onClick={() => navigate('/don-hang')}>Đơn trên Zalo</button><button className="btn ghost sm" onClick={() => openPage('/tai-khoan')}>Tài khoản trên website</button></div>
          </div>
          {me.affiliate ? <Affiliate status={me.affiliate.status} /> : <Register me={me} onDone={load} />}
        </>
      )}
      <div className="section">
        <button className="link" onClick={() => openPage('/dieu-khoan-zalo')}>Điều khoản sử dụng và dữ liệu cá nhân ›</button><br />
        <button className="link" onClick={() => openPage('/chinh-sach')}>Chính sách mua hàng, đổi trả ›</button>
      </div>
    </Page>
  );
}
