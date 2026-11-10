import { env } from 'cloudflare:workers';
import { handleApi } from '../../server/api.js';

export const prerender = false;
export const ALL = ({ request, locals }) => handleApi(request, env, locals?.cfContext || null);
