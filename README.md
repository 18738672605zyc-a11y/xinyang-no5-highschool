# 信阳市第五高级中学 官网

> 现代大厂风格学校官网，公告系统（访客可看，管理员可发），基于 Cloudflare Pages + Workers/Pages Functions + D1 部署。

---

## 功能一览

| 功能 | 说明 |
|------|------|
| 学校简介 | 学校历史、荣誉、联系方式 |
| 校园动态 | 公告列表（访客可查看，支持分类筛选） |
| 特色教育 | 美术、播音主持、音乐、体育 |
| 管理后台 | 登录后发布 / 编辑 / 删除公告 |
| 响应式 | 完美适配手机、平板、桌面 |

---

## 项目结构

```
xinyang-no5-highschool/
├── index.html              # 官网首页
├── admin.html              # 管理后台
├── wrangler.toml           # Cloudflare 配置（含 D1 数据库绑定）
├── public/
│   ├── _redirects          # Cloudflare Pages SPA 路由
│   └── _headers            # 安全头配置
├── css/
│   ├── style.css           # 官网样式
│   └── admin.css           # 管理后台样式
├── js/
│   ├── main.js             # 官网交互
│   └── admin.js            # 管理后台逻辑
├── functions/
│   └── api/
│       └── [[catchall]].js # Pages Functions API（处理所有 /api/* 请求）
└── src/
    └── index.js            # Cloudflare Workers 备用后端
```

---

## 部署步骤

### 第一步：上传到 GitHub ✅（已完成）

仓库地址：https://github.com/18738672605zyc-a11y/xinyang-no5-highschool

### 第二步：创建 D1 数据库

1. 打开 [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** → 选择你的 Pages 项目 → **Settings** → **Functions**
3. 找到 **D1 Database Bindings**，点击 **Bind a D1 Database**
4. 点击 **Create new D1 Database**，名字填写 `no5_school_db`，点击 **Create**
5. 绑定完成后，把绑定名称填写为 **`NO5_D1`**，点击 **Save**

> 同时在这里找到新创建 D1 的 **Database ID**（格式 `9312fcc7-831e-42fd-8ba3-efe019298ca2`），填入 `wrangler.toml` 中的 `database_id` 字段。

### 第三步：连接 GitHub 并部署

1. 在 Cloudflare Dashboard 中进入你的 Pages 项目
2. **Deployments** → **Retry deployment**（或重新 Connect GitHub 仓库）
3. 等待部署完成

### 第四步：初始化管理员

部署成功后，在浏览器访问你的域名，执行一次初始化：

```
https://你的域名/api/admin/seed
```

返回示例：
```json
{"success":true,"message":"管理员已创建：账号=admin，密码=no52026，请立即修改密码！"}
```

### 第五步：登录管理后台

```
https://你的域名/admin.html
```

- 账号：`admin`
- 密码：`no52026`

> ⚠️ 首次登录后请立即修改密码或创建新管理员账户！

---

## 默认管理员

| 账号 | 密码 |
|------|------|
| admin | no52026 |

---

## 主要 API 接口

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/announcements` | 获取公告列表 | 否 |
| GET | `/api/announcements?category=通知` | 按分类筛选 | 否 |
| GET | `/api/announcements/:id` | 获取单条公告 | 否 |
| POST | `/api/auth/login` | 管理员登录 | 否 |
| POST | `/api/announcements` | 发布公告 | ✅ |
| PUT | `/api/announcements/:id` | 修改公告 | ✅ |
| DELETE | `/api/announcements/:id` | 删除公告 | ✅ |
| POST | `/api/admin/seed` | 初始化管理员 | 否 |
| GET | `/api/admin/users` | 列出管理员 | ✅ |
| POST | `/api/admin/users` | 创建管理员 | ✅ |

---

## 本地开发

```bash
# 预览前端
npx wrangler pages dev .

# 查看 D1 数据（需先配置 CLOUDFLARE_API_TOKEN）
npx wrangler d1 execute no5_school_db --local --command "SELECT * FROM announcements"
```

---

## 安全建议

- [ ] 首次登录后立即修改 `admin` 密码
- [ ] 不要把 Cloudflare API Token 提交到 Git
- [ ] D1 数据库绑定只给 `NO5_D1` 名称，不要暴露其他信息
