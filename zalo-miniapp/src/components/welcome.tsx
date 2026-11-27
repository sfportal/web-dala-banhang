// Màn hình chào lần đầu: đọc và đồng ý điều khoản, rồi Zalo hỏi quyền tên, số điện thoại, vị trí (khách có thể từ chối)
import { useState } from 'react';
import { openWebview } from 'zmp-sdk/apis';
import { useSnackbar } from 'zmp-ui';
import { API_BASE } from '../api';
import { useStore } from '../store';
import { askPermissions, locate, loginWithPhone } from '../zalo';
import logo from '../logo.png';

export const openPage = (path: string) => openWebview({ url: API_BASE + path }).catch(() => { window.open(API_BASE + path, '_blank'); });

// Dùng chung: đăng nhập bằng SĐT Zalo và lấy vị trí theo quyền khách đã cấp
export function useZaloProfile() {
  const { customer, setCustomer, setSession, setLocated } = useStore();
  const { openSnackbar } = useSnackbar();
  const login = async (silent = false) => {
    try {
      const d = await loginWithPhone();
      setSession(d.token);
      setCustomer({ ...customer, name: customer.name || d.customer.name || '', phone: d.customer.phone });
      if (!silent) openSnackbar({ text: 'Đã đăng nhập bằng số Zalo ' + d.customer.phone, type: 'success' });
      return true;
    } catch (e: any) {
      if (!silent) openSnackbar({ text: e?.message || 'Chưa lấy được số điện thoại Zalo', type: 'warning' });
      return false;
    }
  };
  const findMe = async (silent = false) => {
    try {
      const a = await locate();
      if (!a) throw new Error('Chưa xác định được địa chỉ từ vị trí');
      setLocated({ ...a, at: Date.now() });
      if (!silent) openSnackbar({ text: 'Đã lấy vị trí: ' + [a.ward, a.district, a.province].filter(Boolean).join(', '), type: 'success' });
      return a;
    } catch (e: any) {
      if (!silent) openSnackbar({ text: e?.message || 'Chưa lấy được vị trí', type: 'warning' });
      return null;
    }
  };
  return { login, findMe };
}

export function Welcome() {
  const { consent, acceptConsent } = useStore();
  const { login, findMe } = useZaloProfile();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  if (consent) return null;

  const start = async () => {
    setBusy(true);
    acceptConsent();
    const g = await askPermissions(['scope.userInfo', 'scope.userPhonenumber', 'scope.userLocation']);
    await Promise.all([g['scope.userPhonenumber'] ? login(true) : null, g['scope.userLocation'] ? findMe(true) : null]);
    setBusy(false);
  };

  return (
    <div className="welcome">
      <img src={logo} alt="DaLa" className="logo" />
      <h1>Chào mừng đến DaLa</h1>
      <p className="center muted">Nông sản Tây Nguyên của Hợp tác xã DaLa. Quét QR trên bao bì để thấy vườn trồng và phiếu kiểm nghiệm.</p>

      <div className="section" style={{ margin: '14px 0 0' }}>
        <h2>Để mua nhanh hơn, DaLa xin phép</h2>
        <div className="perm"><i>👤</i><div><b>Tên Zalo</b><small>Điền sẵn họ tên người nhận</small></div></div>
        <div className="perm"><i>📱</i><div><b>Số điện thoại Zalo</b><small>Điền sẵn SĐT nhận hàng, đăng nhập tài khoản để xem điểm, đơn và hoa hồng cộng tác viên</small></div></div>
        <div className="perm"><i>📍</i><div><b>Vị trí hiện tại</b><small>Điền sẵn tỉnh/thành, quận/huyện, phường/xã giao hàng. DaLa không lưu toạ độ</small></div></div>
        <p className="muted small">Zalo sẽ hỏi bạn từng quyền. Bạn có thể từ chối và tự nhập thông tin khi đặt hàng.</p>
      </div>

      <label className="agree">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>Tôi đã đọc và đồng ý <a onClick={(e) => { e.preventDefault(); openPage('/dieu-khoan-zalo'); }} href="#" className="green"><b>Điều khoản sử dụng và xử lý dữ liệu cá nhân</b></a> cùng <a onClick={(e) => { e.preventDefault(); openPage('/chinh-sach'); }} href="#" className="green"><b>Chính sách mua hàng</b></a> của DaLa.</span>
      </label>
      <button className="btn block" disabled={!agree || busy} onClick={start}>{busy ? 'Đang thiết lập…' : 'Đồng ý và bắt đầu mua sắm'}</button>
    </div>
  );
}
