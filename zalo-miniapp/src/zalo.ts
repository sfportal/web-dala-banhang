// Xin quyền và lấy thông tin từ Zalo. Zalo chỉ trả "token"; máy chủ DaLa đổi token ra số điện thoại / vị trí.
import { authorize, getAccessToken, getLocation, getPhoneNumber, getSetting, getUserInfo } from 'zmp-sdk/apis';
import { api, GeoAddress, GeoItem } from './api';

export type Scope = 'scope.userInfo' | 'scope.userPhonenumber' | 'scope.userLocation';

export async function granted(): Promise<Partial<Record<Scope, boolean>>> {
  try { return ((await getSetting({})) as any)?.authSetting || {}; } catch { return {}; }
}

// Hỏi các quyền chưa cấp; Zalo hiện hộp thoại cho từng quyền, khách có thể từ chối
export async function askPermissions(scopes: Scope[]) {
  const have = await granted();
  const need = scopes.filter((s) => !have[s]);
  if (!need.length) return have;
  try { return { ...have, ...((await authorize({ scopes: need })) as any) }; } catch { return have; }
}

export async function zaloName(): Promise<string> {
  try { const { userInfo } = await getUserInfo({}); return userInfo?.name || ''; } catch { return ''; }
}

// Đăng nhập tài khoản khách DaLa bằng số điện thoại Zalo
export async function loginWithPhone() {
  const { token } = await getPhoneNumber({});
  if (!token) throw new Error('Bạn chưa cho phép chia sẻ số điện thoại');
  const access_token = await getAccessToken({});
  return api.zaloLogin({ access_token, phone_token: token, name: await zaloName() });
}

export async function locate(): Promise<GeoAddress | null> {
  const { token } = await getLocation({});
  if (!token) throw new Error('Bạn chưa cho phép lấy vị trí');
  const access_token = await getAccessToken({});
  const d = await api.zaloLocation({ access_token, location_token: token });
  return d.address;
}

// So khớp tên địa chỉ từ bản đồ với danh sách tỉnh/quận/phường của cửa hàng
const PREFIX = /^(thanh pho|tinh|tp\.?|quan|huyen|thi xa|thi tran|phuong|xa|tx\.?|q\.?|p\.?)\s+/;
export const normPlace = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9 .]/g, ' ').replace(/\s+/g, ' ').trim().replace(PREFIX, '').replace(/^0+(\d)/, '$1');

export function matchPlace(items: GeoItem[], names: (string | null | undefined)[]): GeoItem | undefined {
  const want = names.filter(Boolean).map((n) => normPlace(String(n)));
  if (!want.length) return undefined;
  return items.find((i) => want.includes(normPlace(i.name)))
    || items.find((i) => { const n = normPlace(i.name); return n.length > 3 && want.some((w) => w.includes(n) || n.includes(w)); });
}
