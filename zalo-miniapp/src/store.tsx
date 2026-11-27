// Giỏ hàng, đơn đã đặt và thông tin người nhận, lưu trong bộ nhớ của Zalo (nativeStorage); chạy ngoài Zalo thì dùng localStorage
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { nativeStorage } from 'zmp-sdk/apis';
import { api, CartItem, Catalog, setSessionToken } from './api';

function load<T>(key: string, d: T): T {
  try {
    const v = nativeStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : d; } catch { return d; }
  }
}
function save(key: string, v: unknown) {
  const s = JSON.stringify(v);
  try { nativeStorage.setItem(key, s); } catch { try { localStorage.setItem(key, s); } catch { /* bỏ qua */ } }
}

export type SavedOrder = { code: string; token: string; total: number; at: string };
export type Customer = { name?: string; phone?: string; email?: string; address?: string; city?: string; district?: string; ward?: string };
export type Located = { province?: string | null; district?: string | null; ward?: string | null; road?: string | null; names?: string[]; at: number };
export const CONSENT_VERSION = '2026-11-27';

// Mã giới thiệu CTV: lấy từ link mở mini app (?ref=MÃ), giữ 30 ngày
function initialRef(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('ref');
    if (q && /^[A-Za-z0-9]{3,20}$/.test(q)) { const v = { code: q.toUpperCase(), at: Date.now() }; save('dala_ref', v); return v.code; }
  } catch { /* bỏ qua */ }
  const v = load<{ code: string; at: number } | null>('dala_ref', null);
  return v && Date.now() - v.at < 30 * 864e5 ? v.code : '';
}

type Store = {
  catalog: Catalog | null; catalogError: string | null; reloadCatalog: () => void;
  cart: CartItem[]; count: number; add: (sku: string, qty?: number) => void; setQty: (sku: string, qty: number) => void; clear: () => void;
  orders: SavedOrder[]; addOrder: (o: SavedOrder) => void;
  customer: Customer; setCustomer: (c: Customer) => void;
  session: string; setSession: (t: string) => void;
  consent: boolean; acceptConsent: () => void;
  located: Located | null; setLocated: (l: Located | null) => void;
  ref: string;
};
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => load('dala_cart', []));
  const [orders, setOrders] = useState<SavedOrder[]>(() => load('dala_orders', []));
  const [customer, setCustomerState] = useState<Customer>(() => load('dala_customer', {}));
  const [session, setSessionState] = useState<string>(() => { const t = load('dala_session', ''); setSessionToken(t); return t; });
  const [consent, setConsent] = useState<boolean>(() => load<string>('dala_consent', '') === CONSENT_VERSION);
  const [located, setLocatedState] = useState<Located | null>(() => load('dala_located', null));
  const [ref] = useState(initialRef);

  const reloadCatalog = useCallback(() => {
    setCatalogError(null);
    api.catalog().then(setCatalog).catch((e) => setCatalogError(e.message));
  }, []);
  useEffect(reloadCatalog, [reloadCatalog]);
  useEffect(() => save('dala_cart', cart), [cart]);
  useEffect(() => save('dala_orders', orders), [orders]);

  const value = useMemo<Store>(() => ({
    catalog, catalogError, reloadCatalog,
    cart,
    count: cart.reduce((s, i) => s + i.qty, 0),
    add: (sku, qty = 1) => setCart((c) => {
      const f = c.find((i) => i.sku === sku);
      return f ? c.map((i) => (i.sku === sku ? { ...i, qty: Math.min(99, i.qty + qty) } : i)) : [...c, { sku, qty }];
    }),
    setQty: (sku, qty) => setCart((c) => (qty <= 0 ? c.filter((i) => i.sku !== sku) : c.map((i) => (i.sku === sku ? { ...i, qty: Math.min(99, qty) } : i)))),
    clear: () => setCart([]),
    orders,
    addOrder: (o) => setOrders((l) => [o, ...l.filter((x) => x.code !== o.code)].slice(0, 30)),
    customer,
    setCustomer: (c) => { setCustomerState(c); save('dala_customer', c); },
    session,
    setSession: (t) => { setSessionToken(t); setSessionState(t); save('dala_session', t); },
    consent,
    acceptConsent: () => { setConsent(true); save('dala_consent', CONSENT_VERSION); },
    located,
    setLocated: (l) => { setLocatedState(l); save('dala_located', l); },
    ref,
  }), [catalog, catalogError, reloadCatalog, cart, orders, customer, session, consent, located, ref]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore phải nằm trong StoreProvider');
  return s;
}
