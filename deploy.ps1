# 信阳市第五高级中学官网 - 部署脚本
$ErrorActionPreference = "Stop"
$WORKDIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[*] 开始部署..." -ForegroundColor Cyan
Write-Host ""

# 1. 检查 wrangler
Write-Host "[1/4] 检查环境..." -ForegroundColor Yellow
if (-not (Get-Command wrangler -ErrorAction SilentlyContinue)) {
    Write-Host "  [-] 安装 Wrangler CLI..." -ForegroundColor Gray
    npm install -g wrangler
}
Write-Host ("  [OK] " + (wrangler --version)) -ForegroundColor Green

# 2. 创建 D1 数据库
Write-Host ""
Write-Host "[2/4] 创建 D1 数据库..." -ForegroundColor Yellow
$D1_OUTPUT = wrangler d1 create no5_school_db 2>&1 | Out-String
$DB_ID = $null
if ($D1_OUTPUT -imatch 'uuid.+?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})') {
    $DB_ID = $Matches[1]
} elseif ($D1_OUTPUT -imatch 'd1_[a-f0-9]{32,}') {
    $DB_ID = $Matches[0]
}
if ($DB_ID) {
    Write-Host ("  [OK] D1 ID: " + $DB_ID) -ForegroundColor Green
    $tomlPath = Join-Path $WORKDIR "wrangler.toml"
    $content = Get-Content $tomlPath -Raw
    $newContent = $content.Replace('database_id = "YOUR_D1_DATABASE_ID_HERE"', ("database_id = `"$DB_ID`""))
    Set-Content -Path $tomlPath -Value $newContent -NoNewline
    Write-Host "  [OK] wrangler.toml 已更新" -ForegroundColor Green
} else {
    Write-Host "  [!] 无法自动提取 database_id，请手动运行 wrangler d1 create no5_school_db" -ForegroundColor Yellow
}

# 3. 部署 Workers
Write-Host ""
Write-Host "[3/4] 部署 Cloudflare Workers..." -ForegroundColor Yellow
Set-Location $WORKDIR
$DEPLOY_OUTPUT = wrangler deploy 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [!] 部署失败" -ForegroundColor Red
    Write-Host $DEPLOY_OUTPUT
    exit 1
}
if ($DEPLOY_OUTPUT -match 'https://[^\s]+workers\.dev') {
    $WORKERS_URL = $Matches[0].TrimEnd('/')
    Write-Host ("  [OK] Workers: " + $WORKERS_URL) -ForegroundColor Green
} else {
    $WORKERS_URL = $null
    Write-Host "  [!] 请手动查看上方输出确认 Workers URL" -ForegroundColor Yellow
}

# 4. 初始化管理员
if ($WORKERS_URL) {
    Write-Host ""
    Write-Host "[4/4] 初始化管理员账户..." -ForegroundColor Yellow
    try {
        $resp = Invoke-RestMethod -Uri ($WORKERS_URL + "/api/admin/seed") -Method Post `
            -ContentType "application/json" `
            -Body '{"username":"admin","password":"no52026"}' -ErrorAction Stop
        if ($resp.success) { Write-Host ("  [OK] " + $resp.message) -ForegroundColor Green }
        else { Write-Host ("  [!] " + $resp.message) -ForegroundColor Gray }
    } catch {
        Write-Host "  [!] 初始化跳过（可能已存在，可忽略）" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  部署完成！" -ForegroundColor Cyan
if ($WORKERS_URL) {
    Write-Host ("  Workers API: " + $WORKERS_URL) -ForegroundColor White
    Write-Host ("  管理后台:   " + $WORKERS_URL + "/admin.html") -ForegroundColor White
}
Write-Host ""
Write-Host "  默认账号: admin  密码: no52026" -ForegroundColor Yellow
Write-Host "  [!] 首次登录后请立即修改密码！" -ForegroundColor Red
Write-Host ""
Write-Host "  下一步：在 Cloudflare Pages 部署前端" -ForegroundColor Cyan
Write-Host "  dash.cloudflare.com -> Workers & Pages -> Pages -> Create -> 上传项目" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Cyan
