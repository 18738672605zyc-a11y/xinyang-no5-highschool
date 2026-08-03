# 信阳市第五高级中学 官网

> 现代大厂风格学校官网，公告系统（访客可看，管理员可发），基于 Cloudflare Pages + Workers + D1 部署。

---

## 📁 项目结构

```
xinyang-no5-highschool/
├── index.html          # 官网首页
├── admin.html          # 管理后台（登录/发公告/管理）
├── wrangler.toml       # Cloudflare Workers 配置
├── public/
│   ├── _redirects      # Cloudflare Pages SPA 路由
│   └── _headers        # 安全头配置
├── css/
│   ├── style.css       # 官网样式（现代大厂风格）
│   └── admin.css       # 管理后台样式
├── js/
│   ├── main.js         # 官网交互（公告加载/动画/导航）
│   └── admin.js        # 管理后台逻辑
└── src/
    └── index.js        # Cloudflare Workers 后端 API
```

---

## 🚀 部署步骤（按顺序执行）

### 第一步：创建 D1 数据库

```bash
# 进入项目目录
cd xinyang-no5-highschool

# 创建 D1 数据库
npx wrangler d1 create no5_school_db
```

> 执行后会输出 `database_id`，复制它，填入 `wrangler.toml` 中的 `database_id` 字段。

### 第二步：更新 wrangler.toml

编辑 `wrangler.toml`，把 `YOUR_D1_DATABASE_ID_HERE` 替换为上一步复制的 ID：

```toml
[[d1_databases]]
binding = "NO5_D1"
database_name = "no5_school_db"
database_id = "你的实际database_id"
```

### 第三步：部署 Workers

```bash
# 部署到 Cloudflare Workers
npx wrangler deploy

# 部署成功后会输出 Workers URL，例如：
# https://xinyang-no5-school.xxx.workers.dev
```

### 第四步：部署前端到 Cloudflare Pages

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. 上传本项目文件夹，或连接 GitHub 仓库
4. **Build settings:**
   - Build command: （留空，纯静态）
   - Build output directory: `/`（或 `.`）
5. 点击 **Deploy**

> 部署完成后，你会获得一个 `*.pages.dev` 域名（或你自己的绑定域名）。

### 第五步：初始化默认管理员

Workers 部署成功后，用以下命令创建第一个管理员账户：

```bash
# 将 YOUR_WORKERS_URL 替换为第三步获得的 Workers URL
curl -X POST "https://YOUR_WORKERS_URL/api/admin/seed" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"no52026"}'
```

**✅ 初始化管理员账号：`admin` / `no52026`**
> ⚠️ 首次登录后请立即修改密码！

---

## 🔧 后台 API 地址配置

Workers 部署后，需要告诉前端 `api.js`（或 `main.js`）API 在哪里。

### 方式 A：通过代理（推荐，SPA 跨域友好）

在 Cloudflare Pages 项目中，添加一个 **Functions** 代理：

在项目根目录创建 `functions/api/[[catchall]].js`：

```javascript
export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const apiUrl = 'https://YOUR_WORKERS_URL' + path + url.search;
  const res = await fetch(apiUrl, {
    method: request.method,
    headers: { ...Object.fromEntries(request.headers) },
    body: request.body
  });
  return new Response(res.body, { status: res.status, headers: res.headers });
}
```

> 这样前端 `fetch('/api/...')` 即可自动代理到 Workers，无需修改 `API_BASE`。

### 方式 B：直接配置 Workers URL（简单）

编辑 `js/main.js` 和 `js/admin.js`，把：
```javascript
const API_BASE = '/api';
```
改为：
```javascript
const API_BASE = 'https://YOUR_WORKERS_URL/api';
```

---

## 🛡️ 安全建议

- [ ] **API Key 安全**：不要把 Cloudflare API Token 提交到 Git 仓库，加入 `.gitignore`
- [ ] **重置默认密码**：首次登录后立即修改 `admin` 账号密码
- [ ] **添加更多管理员**：`POST /api/admin/users`（需已登录）
- [ ] **绑定自己的域名**：在 Cloudflare Pages 设置中绑定已备案域名
- [ ] **关闭 Workers 日志**：生产环境关闭 `wrangler dev` 调试日志

---

## 🔑 默认管理员

| 账号 | 密码 |
|------|------|
| admin | no52026 |

> 首次部署后立即登录并修改密码！

---

## 📝 主要功能

| 功能 | 说明 |
|------|------|
| 学校简介 | 学校历史、荣誉、联系方式 |
| 校园动态 | 公告列表（访客可查看） |
| 特色教育 | 美术、播音主持、音乐、体育 |
| 管理后台 | 登录后发布/编辑/删除公告 |
| 响应式 | 完美适配手机、平板、桌面 |

---

## 🛠️ 本地开发

```bash
# 本地预览前端
npx wrangler pages dev .

# 本地测试 Workers
npx wrangler dev

# 查看 D1 数据
npx wrangler d1 execute no5_school_db --local --command "SELECT * FROM announcements"
```
