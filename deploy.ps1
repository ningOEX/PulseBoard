# PulseBoard 一键部署脚本（Windows PowerShell）
# 本地编译 -> 创建服务器目录 -> 上传产物 -> 远程启动 Docker
#
# 用法：
#   .\deploy.ps1                              # 使用默认值
#   .\deploy.ps1 -ServerUser ubuntu           # 指定 SSH 用户
#   .\deploy.ps1 -RemotePath /data/PulseBoard # 指定远程目录
#
# 前提：本地已配置好 SSH 免密登录（或能输入密码）

param(
    [string]$ServerHost = "123.57.41.200",
    [string]$ServerUser = "root",
    [string]$RemotePath = "/opt/PulseBoard"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sshTarget = "$ServerUser@$ServerHost"

function Run-Step($name, $scriptBlock) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
    & $scriptBlock
    if ($LASTEXITCODE -ne 0) { throw "$name 失败" }
}

# ---------- 1. 本地编译 ----------
Run-Step "编译后端" {
    Push-Location (Join-Path $root "server")
    npm run build
    Pop-Location
}

Run-Step "编译前端" {
    Push-Location (Join-Path $root "web")
    npm run build
    Pop-Location
}

# ---------- 2. 创建远程目录 ----------
Run-Step "创建远程目录 $RemotePath" {
    ssh $sshTarget "mkdir -p $RemotePath/server $RemotePath/web"
}

# ---------- 3. 上传文件 ----------
Run-Step "上传后端文件" {
    scp -r (Join-Path $root "server\dist") "$sshTarget`:$RemotePath/server/"
    scp (Join-Path $root "server\Dockerfile") "$sshTarget`:$RemotePath/server/"
    scp (Join-Path $root "server\package.json") "$sshTarget`:$RemotePath/server/"
    scp (Join-Path $root "server\package-lock.json") "$sshTarget`:$RemotePath/server/"
    scp (Join-Path $root "server\.dockerignore") "$sshTarget`:$RemotePath/server/"
}

Run-Step "上传前端文件" {
    scp -r (Join-Path $root "web\dist") "$sshTarget`:$RemotePath/web/"
    scp (Join-Path $root "web\Dockerfile") "$sshTarget`:$RemotePath/web/"
    scp (Join-Path $root "web\nginx.conf") "$sshTarget`:$RemotePath/web/"
    scp (Join-Path $root "web\.dockerignore") "$sshTarget`:$RemotePath/web/"
}

Run-Step "上传 docker-compose.yml" {
    scp (Join-Path $root "docker-compose.yml") "$sshTarget`:$RemotePath/"
}

# ---------- 4. 远程启动 ----------
Run-Step "远程构建并启动容器" {
    ssh $sshTarget "cd $RemotePath && docker compose up -d --build"
}

# ---------- 5. 验证 ----------
Run-Step "检查容器状态" {
    ssh $sshTarget "cd $RemotePath && docker compose ps"
}

Write-Host ""
Write-Host "=== 部署完成 ===" -ForegroundColor Green
Write-Host "后端日志查看： ssh $sshTarget 'cd $RemotePath && docker compose logs -f server'"
Write-Host "健康检查：     ssh $sshTarget 'curl http://127.0.0.1:8082/board/api/health'"
Write-Host ""
Write-Host "⚠️  如未配置主 Nginx 的 /board/ 反代，请先配置后再通过浏览器访问："
Write-Host "    http://$ServerHost/board/"
