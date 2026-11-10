// Điểm vào Worker: Astro xử lý HTTP, thêm cron đồng bộ thanh toán SePay, nhả hoa hồng, huỷ đơn quá hạn
import { handle } from '@astrojs/cloudflare/handler';
import { cronTick } from './lib/orders.js';

export default {
  fetch: handle,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(cronTick(env).then((r) => console.log('cron', JSON.stringify(r))).catch((e) => console.error('cron', e)));
  },
};
