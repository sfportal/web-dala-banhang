import { Page, useNavigate } from 'zmp-ui';
import { followOA, openChat, openPhone } from 'zmp-sdk/apis';
import { HOTLINE, OA_ID, vnd, when } from '../api';
import { useStore } from '../store';
import { Empty } from '../components/ui';

export default function OrdersPage() {
  const { orders } = useStore();
  const navigate = useNavigate();

  return (
    <Page className="page has-nav">
      <div className="title">Đơn hàng của bạn</div>
      {orders.length === 0 ? (
        <Empty icon="📦" text="Bạn chưa đặt đơn nào trên Zalo"><button className="btn" onClick={() => navigate('/')}>Mua sắm ngay</button></Empty>
      ) : (
        <div className="section">
          {orders.map((o) => (
            <button key={o.code} className="order-row" onClick={() => navigate(`/don-hang/${o.code}?t=${o.token}`)}>
              <div><b>Đơn {o.code}</b><div className="muted small">{when(o.at)}</div></div>
              <b>{vnd(o.total)}</b>
              <span className="chev">›</span>
            </button>
          ))}
          <p className="muted small">Danh sách lưu trên điện thoại này. Đơn đặt trên website xem tại trang Tài khoản của website.</p>
        </div>
      )}

      {(OA_ID || HOTLINE) && (
        <div className="section">
          <h2>Cần hỗ trợ?</h2>
          <div className="row-gap">
            {OA_ID && <button className="btn ghost" onClick={() => openChat({ type: 'oa', id: OA_ID, message: 'Chào DaLa, mình cần hỗ trợ đơn hàng' }).catch(() => {})}>💬 Chat với DaLa</button>}
            {OA_ID && <button className="btn ghost" onClick={() => followOA({ id: OA_ID }).catch(() => {})}>➕ Quan tâm OA</button>}
            {HOTLINE && <button className="btn ghost" onClick={() => openPhone({ phoneNumber: HOTLINE }).catch(() => {})}>📞 {HOTLINE}</button>}
          </div>
        </div>
      )}
    </Page>
  );
}
