/**
 * Cloudflare Pages Functions - API 代理
 * 将 /api/* 请求代理到 Cloudflare Workers
 */

const WORKERS_BASE = 'https://xinyang-no5-school.946292886.workers.dev';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  const proxyUrl = WORKERS_BASE + path + url.search;

  const headers = {};
  for (const [key, value] of request.headers.entries()) {
    // 跳过 host 头，让 fetch 自动处理
    if (key.toLowerCase() === 'host') continue;
    headers[key] = value;
  }

  const res = await fetch(proxyUrl, {
    method: request.method,
    headers,
    body: ['POST', 'PUT', 'PATCH'].includes(request.method) ? request.body : undefined,
    redirect: 'manual'
  });

  const newHeaders = new Headers();
  for (const [key, value] of res.headers.entries()) {
    if (!['content-encoding', 'transfer-encoding', 'via'].includes(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  }
  // 允许跨域
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return new Response(res.body, {
    status: res.status,
    headers: newHeaders
  });
}
