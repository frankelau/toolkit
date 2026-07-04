# Toolkit Windows 构建打包脚本
# 用途：构建 Tauri 应用，产出 .msi 和 .exe 安装包。
# 用法：在仓库根目录运行：
#   powershell -ExecutionPolicy Bypass -File scripts\win-build.ps1
# 前置：先跑过 scripts\win-setup.ps1 且环境齐全。

$ErrorActionPreference = "Stop"

function Test-Cmd($name) { return [bool](Get-Command $name -ErrorAction SilentlyContinue) }

# 定位仓库根目录（脚本在 scripts\ 下）
$root = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $root "desktool-app"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Toolkit Windows 打包" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

# 环境快检
foreach ($c in @("node", "npm", "rustc", "cargo")) {
  if (-not (Test-Cmd $c)) {
    Write-Host "[错误] 未找到 $c，请先运行 scripts\win-setup.ps1 安装依赖。" -ForegroundColor Red
    exit 1
  }
}
Write-Host "Node $(node --version) / Rust $(rustc --version)`n"

# 确保 msvc target
Write-Host "→ 确认 x86_64-pc-windows-msvc target …" -ForegroundColor Cyan
rustup target add x86_64-pc-windows-msvc 2>$null | Out-Null

Set-Location $appDir

# 安装前端依赖
if (Test-Path "package-lock.json") {
  Write-Host "→ npm ci …" -ForegroundColor Cyan
  npm ci
} else {
  Write-Host "→ npm install …" -ForegroundColor Cyan
  npm install
}

# 构建
Write-Host "`n→ 构建中（首次较慢，需编译 Rust 依赖）…`n" -ForegroundColor Cyan
npm run tauri build

if ($LASTEXITCODE -ne 0) {
  Write-Host "`n[错误] 构建失败，请检查上面的输出。" -ForegroundColor Red
  exit 1
}

# 收集产物
$bundle = Join-Path $appDir "src-tauri\target\release\bundle"
$msi = Get-ChildItem -Path (Join-Path $bundle "msi") -Filter *.msi -ErrorAction SilentlyContinue
$exe = Get-ChildItem -Path (Join-Path $bundle "nsis") -Filter *.exe -ErrorAction SilentlyContinue

$distDir = Join-Path $root "dist-installer"
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "  构建完成，安装包：" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
foreach ($f in @($msi, $exe)) {
  if ($f) {
    Copy-Item $f.FullName -Destination $distDir -Force
    $sizeMB = [math]::Round($f.Length / 1MB, 1)
    Write-Host ("  {0}  ({1} MB)" -f $f.Name, $sizeMB) -ForegroundColor Green
  }
}
Write-Host "`n已复制到：$distDir" -ForegroundColor Green

if (-not $msi -and -not $exe) {
  Write-Host "[警告] 未找到安装包产物，请检查 $bundle 目录。" -ForegroundColor Yellow
}
