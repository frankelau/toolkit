# Toolkit Windows 环境准备脚本
# 用途：检查并安装构建 Tauri 应用所需的工具（Node.js / Rust / VS Build Tools / WebView2）
# 用法：右键以 PowerShell 运行，或在 PowerShell 中执行：
#   powershell -ExecutionPolicy Bypass -File scripts\win-setup.ps1

$ErrorActionPreference = "Stop"

function Test-Cmd($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Has-Winget() { return Test-Cmd "winget" }

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Toolkit Windows 构建环境检查" -ForegroundColor Cyan
Write-Host "================================================`n" -ForegroundColor Cyan

$missing = @()

# 1. Node.js
if (Test-Cmd "node") {
  Write-Host "[OK] Node.js $(node --version)" -ForegroundColor Green
} else {
  Write-Host "[缺失] Node.js" -ForegroundColor Yellow
  $missing += "OpenJS.NodeJS.LTS"
}

# 2. Rust
if (Test-Cmd "rustc") {
  Write-Host "[OK] Rust $(rustc --version)" -ForegroundColor Green
} else {
  Write-Host "[缺失] Rust" -ForegroundColor Yellow
  $missing += "Rustlang.Rustup"
}

# 3. MSVC 构建工具（检查 link.exe 或 VS 安装）
$hasMsvc = $false
if (Test-Cmd "cl") { $hasMsvc = $true }
$vsPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio"
if ((Test-Path $vsPath) -or (Test-Path "${env:ProgramFiles}\Microsoft Visual Studio")) { $hasMsvc = $true }
if ($hasMsvc) {
  Write-Host "[OK] Visual Studio 构建工具" -ForegroundColor Green
} else {
  Write-Host "[缺失] VS Build Tools (MSVC + Windows SDK)" -ForegroundColor Yellow
  $missing += "Microsoft.VisualStudio.2022.BuildTools"
}

# 4. WebView2（Win10/11 通常自带）
$wv2 = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
if (Test-Path $wv2) {
  Write-Host "[OK] WebView2 Runtime" -ForegroundColor Green
} else {
  Write-Host "[提示] 未检测到 WebView2，Win10/11 一般自带；如构建后无法运行再单独安装。" -ForegroundColor Yellow
}

Write-Host ""

if ($missing.Count -eq 0) {
  Write-Host "环境齐全，可直接运行 scripts\win-build.ps1 构建。" -ForegroundColor Green
  exit 0
}

if (-not (Has-Winget)) {
  Write-Host "缺少以下组件，且未检测到 winget，请手动安装：" -ForegroundColor Red
  Write-Host "  - Node.js LTS : https://nodejs.org/" -ForegroundColor Red
  Write-Host "  - Rust        : https://rustup.rs/" -ForegroundColor Red
  Write-Host "  - VS Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Red
  Write-Host "    (安装时勾选 'Desktop development with C++' / 使用 C++ 的桌面开发)" -ForegroundColor Red
  exit 1
}

Write-Host "将通过 winget 安装：$($missing -join ', ')`n" -ForegroundColor Cyan
foreach ($pkg in $missing) {
  Write-Host "→ 安装 $pkg …" -ForegroundColor Cyan
  if ($pkg -eq "Microsoft.VisualStudio.2022.BuildTools") {
    # 带上 C++ 工作负载
    winget install --id $pkg -e --accept-source-agreements --accept-package-agreements `
      --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
  } else {
    winget install --id $pkg -e --accept-source-agreements --accept-package-agreements
  }
}

Write-Host "`n安装完成。请【关闭并重新打开】PowerShell 让 PATH 生效，再运行 scripts\win-build.ps1。" -ForegroundColor Green
