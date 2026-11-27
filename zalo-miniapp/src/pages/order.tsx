import { useEffect, useRef, useState } from 'react';
import { Header, Page, useNavigate, useParams, useSearchParams, useSnackbar } from 'zmp-ui';
import { saveImageToGallery } from 'zmp-sdk/apis';
import { api, img, Order, vnd, when } from '../api';
import { useStore } from '../store';
import { Empty, Loading } from '../components/ui';

const STEPS: [string, string, string][] = [['new', '📝', 'Đặt hàng'], ['confirmed', '✅', 'Xác nhận'], ['shipping', '🚚', 'Đang giao'], ['completed', '🎉', 'Hoàn tất']];

export default function OrderPage() {
  const { code = '' } = useParams();
  const [sp] = useSearchParams();
  const { orders } = useStore();
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const token = sp.get('t') || orders.find((o) => o.code === code)?.token || '';
  const [o, setO] = useState<Order | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Đơn chuyển khoản: hỏi lại mỗi 4 giây, máy chủ đối soát SePay và tự xác nhận khi tiền về
  useEffect(() => {
    let live = true;
    const load = async (check: boolean) => {
      try {
        const d = await api.order(code, token, check);
        if (!live) return;
        setO(d); setErr(null);
        const waiting = d.payment_method === 'sepay' && d.payment_status !== 'paid' && !['cancelled', 'returned'].includes(d.status);
        if (waiting) timer.current = setTimeout(() => load(true), 4000);
      } catch (e: any) {
        if (!live) return;
        setErr(e.message);
      }
    };
    load(true);
    return () => { live = false; clearTimeout(timer.current); };
  }, [code, token]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => openSnackbar({ text: 'Đã chép', duration: 1200 })).catch(() => {});
  };
  const saveQr = (url: string) => saveImageToGallery({ imageUrl: url })
    .then(() => openSnackbar({ text: 'Đã lưu mã QR vào thư viện ảnh', type: 'success' }))
    .catch(() => openSnackbar({ text: 'Chưa lưu được ảnh, hãy chụp màn hình', type: 'warning' }));

  if (err && !o) return <Page className="page"><Header title={`Đơn ${code}`} /><Empty icon="⚠️" text={err}><button className="btn" onClick={() => navigate('/')}>Về cửa hàng</button></Empty></Page>;
  if (!o) return <Page className="page"><Header title={`Đơn ${code}`} /><Loading /></Page>;

  const paid = o.payment_status === 'paid';
  const cancelled = o.status === 'cancelled' || o.status === 'returned';
  const waiting = o.payment_method === 'sepay' && !paid && !cancelled;
  const remain = o.total - (o.paid_amount || 0);
  const idx = STEPS.findIndex((s) => s[0] === o.status);

  return (
    <Page className="page">
      <Header title={`Đơn ${o.code}`} />
      <div className="section center">
        {cancelled ? (
          <>
            <div className="big">⚠️</div>
            <h1>Đơn {o.code} đã huỷ</h1>
            <p className="muted">{o.payment_method === 'sepay' && !paid ? 'Đơn quá hạn thanh toán nên đã tự huỷ. Bạn có thể đặt lại bất cứ lúc nào.' : 'Liên hệ DaLa nếu cần hỗ trợ.'}</p>
          </>
        ) : waiting ? (
          <>
            <h1>Quét mã để thanh toán</h1>
            <p className="muted">Mở app ngân hàng, quét VietQR. Hệ thống tự xác nhận khi tiền về.</p>
            {o.payment_qr ? (
              <>
                <img className="qr" src={o.payment_qr} alt="Mã VietQR" />
                <button className="btn ghost sm" onClick={() => saveQr(o.payment_qr!)}>Lưu mã QR vào máy</button>
              </>
            ) : <div className="note">Chưa cấu hình tài khoản nhận tiền. DaLa sẽ liên hệ để xác nhận đơn.</div>}
            <dl className="kv">
              <dt>Số tiền</dt><dd className="red">{vnd(remain)}</dd><button className="link" onClick={() => copy(String(remain))}>Chép</button>
              {o.payment_code && <><dt>Nội dung CK</dt><dd>{o.payment_code}</dd><button className="link" onClick={() => copy(o.payment_code!)}>Chép</button></>}
              {o.payment_account && <><dt>Số tài khoản</dt><dd>{o.payment_account}</dd><button className="link" onClick={() => copy(o.payment_account!)}>Chép</button></>}
              {o.payment_bank && <><dt>Ngân hàng</dt><dd>{o.payment_bank}</dd><span /></>}
              {o.bank_holder && <><dt>Chủ tài khoản</dt><dd>{o.bank_holder}</dd><span /></>}
            </dl>
            <div className="note"><span className="spin" /> Đang chờ tiền về… Giữ nguyên màn hình này, trạng thái tự cập nhật.</div>
            {o.paid_amount ? <div className="err">Đã nhận {vnd(o.paid_amount)}, vui lòng chuyển thêm {vnd(remain)} với cùng nội dung.</div> : null}
            {o.manual_payment ? <p className="muted small">Giao dịch sẽ được DaLa xác nhận thủ công trong giờ làm việc.</p> : null}
          </>
        ) : (
          <>
            <div className="big">🎉</div>
            <h1>{paid ? 'Thanh toán thành công!' : 'Đặt hàng thành công!'}</h1>
            <p>Cảm ơn {o.name}. Đơn <b>{o.code}</b> {paid ? 'đã được thanh toán và' : 'sẽ thu tiền khi giao, và'} {o.status === 'shipping' ? 'đang trên đường giao tới bạn.' : 'đang được DaLa chuẩn bị.'}</p>
            {o.eta && <p className="pill">🚚 Dự kiến giao <b>{o.eta.text}</b></p>}
          </>
        )}
        {!cancelled && (
          <div className="steps">{STEPS.map((s, i) => <div key={s[0]} className={i <= idx ? 'on' : ''}><i>{s[1]}</i>{s[2]}</div>)}</div>
        )}
      </div>

      {o.timeline?.length ? (
        <div className="section">
          <h2>Lịch sử đơn hàng</h2>
          {o.eta && <div className={'note' + (o.eta.late ? ' warn' : '')}>🚚 Dự kiến giao <b>{o.eta.text}</b>{o.eta.late ? ' · đơn đang chậm hơn dự kiến, DaLa đang theo dõi.' : ''}</div>}
          <ol className="track">
            {o.timeline.slice().reverse().map((e, i) => (
              <li key={i} className={i === 0 ? 'now' : ''}>
                <time>{when(e.at)}</time><b>{e.title}</b>
                {e.detail && <div>{e.detail}</div>}
                {e.location && <div className="muted">📍 {e.location}</div>}
              </li>
            ))}
          </ol>
          {o.tracking_code && <p className="muted small">Mã vận đơn <b>{o.tracking_code}</b>{o.shipping_carrier ? ' · ' + o.shipping_carrier : ''}</p>}
        </div>
      ) : null}

      <div className="section">
        <h2>Chi tiết đơn</h2>
        {o.items.map((i) => (
          <div key={i.sku + i.price} className="line-item">
            <img src={img(i.image, true)} alt="" />
            <div><div className="n">{i.name}</div><div className="s">SL {i.qty} × {vnd(i.price)}</div></div>
            <div className="p">{vnd(i.price * i.qty)}</div>
          </div>
        ))}
        <div className="sum-row"><span>Tạm tính</span><b>{vnd(o.subtotal)}</b></div>
        {o.discount ? <div className="sum-row green"><span>Giảm giá</span><b>−{vnd(o.discount)}</b></div> : null}
        <div className="sum-row"><span>Phí giao hàng</span><b>{o.shipping_fee ? vnd(o.shipping_fee) : 'Miễn phí'}</b></div>
        <div className="sum-row total"><span>Tổng cộng</span><b>{vnd(o.total)}</b></div>
        <p className="muted small">
          Giao tới: {o.name} · {o.phone} · {o.address}{o.province ? ', ' + o.province : ''}<br />
          Thanh toán: {o.payment_method === 'cod' ? 'Tiền mặt khi nhận hàng (COD)' : 'Chuyển khoản QR'} · {o.payment_label}
        </p>
      </div>
      <div className="section">
        <b>Nhận hàng xong, quét QR trên bao bì</b>
        <div className="muted small">để xem vườn trồng và phiếu kiểm nghiệm của chính lô bạn mua.</div>
      </div>
      <div className="section"><button className="btn ghost block" onClick={() => navigate('/', { replace: true })}>Tiếp tục mua sắm</button></div>
    </Page>
  );
}
