import { App, AnimationRoutes, BottomNavigation, Route, SnackbarProvider, useLocation, useNavigate, ZMPRouter } from 'zmp-ui';
import { StoreProvider, useStore } from '../store';
import HomePage from '../pages/home';
import ProductPage from '../pages/product';
import CartPage from '../pages/cart';
import CheckoutPage from '../pages/checkout';
import OrderPage from '../pages/order';
import OrdersPage from '../pages/orders';
import FlashPage from '../pages/flash';
import AccountPage from '../pages/account';
import { Welcome } from './welcome';

const TABS = [
  { key: '/', label: 'Cửa hàng', icon: '🏡' },
  { key: '/flash-sale', label: 'Flash Sale', icon: '⚡' },
  { key: '/gio-hang', label: 'Giỏ hàng', icon: '🧺' },
  { key: '/don-hang', label: 'Đơn hàng', icon: '📦' },
  { key: '/tai-khoan', label: 'Tài khoản', icon: '👤' },
] as const;

function Nav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { count } = useStore();
  if (!TABS.some((t) => t.key === pathname)) return null;
  return (
    <BottomNavigation fixed activeKey={pathname} onChange={(k) => navigate(k, { animate: false })}>
      {TABS.map((t) => (
        <BottomNavigation.Item
          key={t.key}
          itemKey={t.key}
          label={t.label}
          icon={<span className="nav-ico">{t.icon}{t.key === '/gio-hang' && count > 0 && <b className="badge">{count}</b>}</span>}
        />
      ))}
    </BottomNavigation>
  );
}

export function Layout() {
  return (
    <App>
      <SnackbarProvider>
        <StoreProvider>
          <ZMPRouter>
            <AnimationRoutes>
              <Route path="/" element={<HomePage />} />
              <Route path="/flash-sale" element={<FlashPage />} />
              <Route path="/tai-khoan" element={<AccountPage />} />
              <Route path="/san-pham/:slug" element={<ProductPage />} />
              <Route path="/gio-hang" element={<CartPage />} />
              <Route path="/thanh-toan" element={<CheckoutPage />} />
              <Route path="/don-hang" element={<OrdersPage />} />
              <Route path="/don-hang/:code" element={<OrderPage />} />
            </AnimationRoutes>
            <Nav />
            <Welcome />
          </ZMPRouter>
        </StoreProvider>
      </SnackbarProvider>
    </App>
  );
}
