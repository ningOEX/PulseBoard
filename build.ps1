# 本地编译脚本（Windows PowerShell）
# 编译前后端产物，供 Docker 直接运行（服务器上不再编译）

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== 编译后端 (server) ===" -ForegroundColor Cyan
Push-Location (Join-Path $root "server")
npm run build
if ($LASTEXITCODE -ne 0) { throw "后端编译失败" }
Pop-Location

Write-Host "=== 编译前端 (web) ===" -ForegroundColor Cyan
Push-Location (Join-Path $root "web")
npm run build
if ($LASTEXITCODE -ne 0) { throw "前端编译失败" }
Pop-Location

Write-Host "=== 编译完成 ===" -ForegroundColor Green
Write-Host "产物目录："
Write-Host "  server/dist"
Write-Host "  web/dist"
Write-Host ""
Write-Host "下一步：将整个项目目录上传到服务器，然后执行 docker compose up -d --build"
