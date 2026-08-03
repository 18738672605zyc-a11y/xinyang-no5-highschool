/* =============================================
   信阳市第五高级中学 - 管理后台逻辑
   ============================================= */

const API_BASE = '/api';
const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

// ---- Auth ----
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}

function requireAuth() {
  const token = getToken();
  if (!token) { showLogin(); return false; }
  return true;
}

function showLogin() {
  document.getElementById('loginPanel').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}
function showDashboard() {
  document.getElementById('loginPanel').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('loginBtn');
  const errorEl = document.getElementById('loginError');

  if (!username || !password) { showError(errorEl, '请输入账号和密码'); return; }

  btn.disabled = true;
  btn.textContent = '登录中...';
  errorEl.style.display = 'none';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || '账号或密码错误');
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    showDashboard();
    loadAnnouncements();
  } catch (err) {
    showError(errorEl, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '登 录';
  }
}

function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  showLogin();
}

// ---- Tabs ----
function switchTab(tab) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(`tab-${tab}`).style.display = 'block';

  if (tab === 'list') loadAnnouncements();
  if (tab === 'edit') loadEditList();
  if (tab === 'post') {
    document.getElementById('postForm').reset();
    document.getElementById('charCount').textContent = '0';
    document.getElementById('postError').style.display = 'none';
  }
}

// ---- Announcements ----
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) { handleLogout(); throw new Error('登录已过期，请重新登录'); }
  if (res.status === 403) throw new Error('无权限操作');
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `请求失败 (${res.status})`);
  return data;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

function renderAdminCard(item, showActions = false) {
  const catClass = item.category;
  const actions = showActions ? `
    <button class="dash-btn dash-btn-warning" onclick="editAnnouncement('${item.id}')">✏️ 编辑</button>
    <button class="dash-btn dash-btn-danger" onclick="confirmDelete('${item.id}')">🗑️ 删除</button>
  ` : '';
  return `
    <div class="admin-card">
      <div class="admin-card-meta">
        <div class="admin-card-date">${formatDate(item.created_at)}</div>
      </div>
      <div class="admin-card-body">
        <span class="admin-card-category ${catClass}">${item.category}</span>
        <div class="admin-card-title">${escapeHtml(item.title)}</div>
        <div class="admin-card-excerpt">${escapeHtml(item.content || '')}</div>
      </div>
      <div class="admin-card-actions">${actions}</div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadAnnouncements() {
  const list = document.getElementById('adminList');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>';
  try {
    const data = await apiFetch('/announcements');
    const items = (data.result || data || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无公告</p></div>';
    } else {
      list.innerHTML = items.map(item => renderAdminCard(item, false)).join('');
    }
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

async function loadEditList() {
  const list = document.getElementById('editList');
  list.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>加载中...</p></div>';
  try {
    const data = await apiFetch('/announcements');
    const items = (data.result || data || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    if (!items.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>暂无公告</p></div>';
    } else {
      list.innerHTML = items.map(item => renderAdminCard(item, true)).join('');
    }
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

// ---- Post ----
const postContent = document.getElementById('postContent');
if (postContent) {
  postContent.addEventListener('input', () => {
    document.getElementById('charCount').textContent = postContent.value.length;
  });
}

async function handlePost(e) {
  e.preventDefault();
  const title = document.getElementById('postTitle').value.trim();
  const category = document.getElementById('postCategory').value;
  const content = document.getElementById('postContent').value.trim();
  const btn = document.getElementById('postBtn');
  const errorEl = document.getElementById('postError');

  if (!title || !content) { showError(errorEl, '请填写完整信息'); return; }

  btn.disabled = true;
  btn.textContent = '发布中...';
  errorEl.style.display = 'none';

  try {
    await apiFetch('/announcements', {
      method: 'POST',
      body: JSON.stringify({ title, category, content })
    });
    showToast('✅ 公告发布成功！', 'success');
    switchTab('list');
  } catch (err) {
    showError(errorEl, err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '发布公告';
  }
}

// ---- Edit ----
let editingId = null;

async function editAnnouncement(id) {
  // Load and show edit form inline
  const list = document.getElementById('editList');
  try {
    const data = await apiFetch(`/announcements/${id}`);
    const item = data.result || data;

    const existingForm = document.getElementById('editFormContainer');
    if (existingForm) existingForm.remove();

    const catOptions = ['通知','新闻','活动'].map(c =>
      `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`
    ).join('');

    const container = document.createElement('div');
    container.id = 'editFormContainer';
    container.className = 'edit-form-card';
    container.innerHTML = `
      <h3>✏️ 编辑公告</h3>
      <form id="editForm" onsubmit="handleEdit(event, '${id}')">
        <div class="form-group">
          <label>公告标题 <span class="required">*</span></label>
          <input type="text" id="editTitle" value="${escapeHtml(item.title)}" required maxlength="100" />
        </div>
        <div class="form-group">
          <label>分类 <span class="required">*</span></label>
          <select id="editCategory" required>${catOptions}</select>
        </div>
        <div class="form-group">
          <label>正文内容 <span class="required">*</span></label>
          <textarea id="editContent" required rows="10" maxlength="5000">${escapeHtml(item.content || '')}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="dash-btn dash-btn-ghost" onclick="cancelEdit()">取消</button>
          <button type="submit" class="dash-btn dash-btn-primary" id="editBtn">保存修改</button>
        </div>
      </form>
    `;
    list.appendChild(container);
    window.scrollTo({ top: container.offsetTop - 80, behavior: 'smooth' });
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function handleEdit(e, id) {
  e.preventDefault();
  const title = document.getElementById('editTitle').value.trim();
  const category = document.getElementById('editCategory').value;
  const content = document.getElementById('editContent').value.trim();
  const btn = document.getElementById('editBtn');
  btn.disabled = true; btn.textContent = '保存中...';
  try {
    await apiFetch(`/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, category, content })
    });
    showToast('✅ 修改成功！', 'success');
    cancelEdit();
    loadEditList();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '保存修改';
  }
}

function cancelEdit() {
  const f = document.getElementById('editFormContainer');
  if (f) f.remove();
}

// ---- Delete ----
function confirmDelete(id) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.id = 'confirmOverlay';
  overlay.innerHTML = `
    <div class="confirm-box">
      <h3>确认删除</h3>
      <p>确定要删除这条公告吗？此操作不可撤销。</p>
      <div class="confirm-box-actions">
        <button class="dash-btn dash-btn-ghost" onclick="closeConfirm()">取消</button>
        <button class="dash-btn dash-btn-danger" onclick="doDelete('${id}')">确认删除</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function closeConfirm() {
  document.getElementById('confirmOverlay')?.remove();
}

async function doDelete(id) {
  closeConfirm();
  try {
    await apiFetch(`/announcements/${id}`, { method: 'DELETE' });
    showToast('✅ 删除成功', 'success');
    loadEditList();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

// ---- Toast ----
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

// ---- Init ----
(function init() {
  if (requireAuth()) showDashboard();
})();
