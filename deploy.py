#!/usr/bin/env python3
"""
信阳市第五高级中学官网 - 一键部署脚本
运行方式: python deploy.py
"""
import subprocess
import re
import json
import sys
import os

def run(cmd, capture=True):
    print(f"  $ {cmd}")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
        output = result.stdout + result.stderr
        if result.returncode != 0:
            print(f"  [!] 命令失败 (exit {result.returncode})")
            print(output)
            return None, output
        return output, output
    except subprocess.TimeoutExpired:
        print("  [!] 命令超时")
        return None, ""
    except Exception as e:
        print(f"  [!] 错误: {e}")
        return None, ""

def green(msg): print(f"  [OK] {msg}")
def yellow(msg): print(f"  [!] {msg}")

print("[*] 开始部署信阳市第五高级中学官网...")
print()

# 1. 检查环境
print("[1/4] 检查环境...")
_, out = run("wrangler --version")
if out: green(out.strip())
else:
    print("  [-] 安装 Wrangler CLI...")
    run("npm install -g wrangler")

# 2. 创建 D1 数据库
print()
print("[2/4] 创建 D1 数据库...")
output, _ = run("wrangler d1 create no5_school_db")
db_id = None
if output:
    m = re.search(r'([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})', output)
    if m: db_id = m.group(1)
    if not db_id:
        m = re.search(r'(d1_[a-f0-9]{32,})', output)
        if m: db_id = m.group(1)

script_dir = os.path.dirname(os.path.abspath(__file__))
toml_path = os.path.join(script_dir, "wrangler.toml")

if db_id:
    green(f"D1 Database ID: {db_id}")
    with open(toml_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace('database_id = "YOUR_D1_DATABASE_ID_HERE"', f'database_id = "{db_id}"')
    with open(toml_path, "w", encoding="utf-8") as f:
        f.write(content)
    green("wrangler.toml 已更新")
else:
    yellow("无法自动提取 database_id，请手动运行以下命令并复制输出：")
    print("   wrangler d1 create no5_school_db")
    print("   然后把 database_id 填入 wrangler.toml")

# 3. 部署 Workers
print()
print("[3/4] 部署 Cloudflare Workers...")
os.chdir(script_dir)
output, _ = run("wrangler deploy")
workers_url = None
if output:
    m = re.search(r'(https://[^\s]+\.workers\.dev)', output)
    if m:
        workers_url = m.group(1).rstrip('/')
        green(f"Workers 已部署: {workers_url}")
    else:
        yellow("无法自动提取 Workers URL，请手动查看上方输出")

# 4. 初始化管理员
if workers_url:
    print()
    print("[4/4] 初始化管理员账户...")
    import urllib.request
    try:
        data = json.dumps({"username": "admin", "password": "no52026"}).encode()
        req = urllib.request.Request(
            f"{workers_url}/api/admin/seed",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
        if result.get("success"):
            green(result.get("message", "管理员初始化成功"))
        else:
            yellow(result.get("message", "可能已存在，可忽略"))
    except Exception as e:
        yellow(f"初始化跳过（可能已存在）: {e}")

print()
print("=" * 50)
print("  部署完成！")
if workers_url:
    print(f"  Workers API: {workers_url}")
    print(f"  管理后台:   {workers_url}/admin.html")
print()
print("  默认账号: admin  密码: no52026")
print("  [!] 首次登录后请立即修改密码！")
print()
print("  下一步：在 Cloudflare Pages 部署前端")
print("  1. 打开 dash.cloudflare.com")
print("  2. Workers and Pages - Pages - Create application")
print("  3. 上传本项目文件夹")
print("  4. Build output directory: /")
print("  5. Deploy！")
print("=" * 50)
