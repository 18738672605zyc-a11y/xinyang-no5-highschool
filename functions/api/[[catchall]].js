/**
 * 信阳市第五高级中学官网 - Cloudflare Pages Functions API
 * 
 * 功能：
 *   POST /api/auth/login       - 管理员登录
 *   GET  /api/announcements    - 获取公告列表（可选参数: category）
 *   POST /api/announcements    - 发布公告（需认证）
 *   GET  /api/announcements/:id - 获取单条公告
 *   PUT  /api/announcements/:id - 修改公告（需认证）
 *   DELETE /api/announcements/:id - 删除公告（需认证）
 *   GET/POST /api/admin/users  - 管理员账户管理（需认证）
 *   POST /api/admin/seed       - 初始化默认管理员
 */

const ADMIN_TABLE = 'admins';
const ANNOUNCEMENTS_TABLE = 'announcements';

// ---- 数据库操作 ----
async function initDB(env) {
  const db = env.NO5_D1;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${ADMIN_TABLE} (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    await db.exec(`
      CREATE TABLE IF NOT EXISTS ${ANNOUNCEMENTS_TABLE} (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );
    `);
  } catch (e) { /* 表可能已存在 */ }
}

// ---- 密码哈希 ----
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'NO5_HIGH_SCHOOL_SALT_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Token ----
function makeToken(username) {
  const payload = btoa(JSON.stringify({ username, exp: Date.now() + 7 * 24 * 3600 * 1000 }));
  return payload + '.sig';
}

function verifyToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[0]));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

function requireAuth(request) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  const payload = verifyToken(token);
  if (!payload) throw new Error('Unauthorized');
  return payload;
}

function makeId() {
  return crypto.randomUUID();
}

// ---- Response ----
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

async function handleRequest({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });
  }

  try {
    await initDB(env);
    const db = env.NO5_D1;

    const announcementsMatch = path.match(/^\/announcements\/(.+)$/);

    if (path === '/auth/login' && method === 'POST') {
      return handleLogin(request, db);
    }
    if (path === '/announcements' && method === 'GET') {
      return handleGetAnnouncements(db, url);
    }
    if (path === '/announcements' && method === 'POST') {
      return handlePostAnnouncement(request, db);
    }
    if (announcementsMatch && method === 'GET') {
      return handleGetOne(announcementsMatch[1], db);
    }
    if (announcementsMatch && method === 'PUT') {
      return handlePutAnnouncement(request, db, announcementsMatch[1]);
    }
    if (announcementsMatch && method === 'DELETE') {
      return handleDeleteAnnouncement(request, db, announcementsMatch[1]);
    }
    if (path === '/admin/users' && method === 'GET') {
      return handleListAdmins(request, db);
    }
    if (path === '/admin/users' && method === 'POST') {
      return handleCreateAdmin(request, db);
    }
    if (path === '/admin/seed' && method === 'POST') {
      return handleSeedAdmin(request, db);
    }

    return json({ success: false, message: 'Not Found' }, 404);

  } catch (err) {
    if (err.message === 'Unauthorized') return json({ success: false, message: '请先登录' }, 401);
    console.error('API error:', err);
    return json({ success: false, message: err.message || 'Server Error' }, 500);
  }
}

// ---- Handlers ----
async function handleLogin(request, db) {
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: 'Invalid JSON' }, 400); }
  const { username, password } = body || {};
  if (!username || !password) return json({ success: false, message: '请输入账号和密码' }, 400);

  const stmt = await db.prepare(`SELECT * FROM ${ADMIN_TABLE} WHERE username = ?`).bind(username);
  const user = await stmt.first();
  if (!user) return json({ success: false, message: '账号或密码错误' }, 401);

  const hash = await hashPassword(password);
  if (hash !== user.password_hash) return json({ success: false, message: '账号或密码错误' }, 401);

  return json({ success: true, token: makeToken(username), user: { id: user.id, username: user.username } });
}

async function handleGetAnnouncements(db, url) {
  const category = url.searchParams.get('category');
  let stmt;
  if (category) {
    stmt = await db.prepare(`SELECT * FROM ${ANNOUNCEMENTS_TABLE} WHERE category = ? ORDER BY created_at DESC`).bind(category);
  } else {
    stmt = await db.prepare(`SELECT * FROM ${ANNOUNCEMENTS_TABLE} ORDER BY created_at DESC`);
  }
  const { results } = await stmt.all();
  return json({ success: true, result: results });
}

async function handleGetOne(id, db) {
  const stmt = await db.prepare(`SELECT * FROM ${ANNOUNCEMENTS_TABLE} WHERE id = ?`).bind(id);
  const item = await stmt.first();
  if (!item) return json({ success: false, message: '公告不存在' }, 404);
  return json({ success: true, result: item });
}

async function handlePostAnnouncement(request, db) {
  requireAuth(request);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: 'Invalid JSON' }, 400); }
  const { title, category, content } = body || {};
  if (!title || !category) return json({ success: false, message: '标题和分类不能为空' }, 400);
  if (!['通知', '新闻', '活动'].includes(category)) return json({ success: false, message: '分类无效' }, 400);

  const id = makeId();
  const created_at = new Date().toISOString();
  await db.prepare(
    `INSERT INTO ${ANNOUNCEMENTS_TABLE} (id, title, category, content, created_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, title.trim(), category, content || '', created_at).run();

  return json({ success: true, result: { id, title: title.trim(), category, content: content || '', created_at } }, 201);
}

async function handlePutAnnouncement(request, db, id) {
  requireAuth(request);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: 'Invalid JSON' }, 400); }
  const { title, category, content } = body || {};
  if (!title || !category) return json({ success: false, message: '标题和分类不能为空' }, 400);

  const updated_at = new Date().toISOString();
  await db.prepare(
    `UPDATE ${ANNOUNCEMENTS_TABLE} SET title = ?, category = ?, content = ?, updated_at = ? WHERE id = ?`
  ).bind(title.trim(), category, content || '', updated_at, id).run();

  const stmt = await db.prepare(`SELECT * FROM ${ANNOUNCEMENTS_TABLE} WHERE id = ?`).bind(id);
  const item = await stmt.first();
  return json({ success: true, result: item });
}

async function handleDeleteAnnouncement(request, db, id) {
  requireAuth(request);
  await db.prepare(`DELETE FROM ${ANNOUNCEMENTS_TABLE} WHERE id = ?`).bind(id).run();
  return json({ success: true });
}

async function handleListAdmins(request, db) {
  requireAuth(request);
  const { results } = await db.prepare(`SELECT id, username, created_at FROM ${ADMIN_TABLE}`).all();
  return json({ success: true, result: results });
}

async function handleCreateAdmin(request, db) {
  requireAuth(request);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: 'Invalid JSON' }, 400); }
  const { username, password } = body || {};
  if (!username || !password) return json({ success: false, message: '请提供账号和密码' }, 400);
  if (username.length < 3 || password.length < 6) return json({ success: false, message: '账号至少3位，密码至少6位' }, 400);

  const id = makeId();
  const hash = await hashPassword(password);
  try {
    await db.prepare(
      `INSERT INTO ${ADMIN_TABLE} (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`
    ).bind(id, username.trim(), hash, Date.now()).run();
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) return json({ success: false, message: '账号已存在' }, 409);
    throw err;
  }
  return json({ success: true, result: { id, username: username.trim(), created_at: Date.now() } }, 201);
}

async function handleSeedAdmin(request, db) {
  const { results } = await db.prepare(`SELECT id FROM ${ADMIN_TABLE} LIMIT 1`).all();
  if (results.length > 0) {
    return json({ success: false, message: '管理员已存在，无需再次初始化' }, 400);
  }
  let body = {};
  try { body = await request.json(); } catch {}
  const username = body.username || 'admin';
  const password = body.password || 'no52026';
  const id = makeId();
  const hash = await hashPassword(password);
  await db.prepare(
    `INSERT INTO ${ADMIN_TABLE} (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)`
  ).bind(id, username.trim(), hash, Date.now()).run();
  return json({ success: true, message: `管理员已创建：账号=${username}，密码=${password}，请立即修改密码！` });
}

export async function onRequest(context) {
  return handleRequest(context);
}
