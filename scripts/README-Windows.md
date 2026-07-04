# Windows 打包说明

在 Windows 电脑上把本仓库拉取下来，按以下两步操作即可产出安装包。

## 1. 准备环境（首次）

用 PowerShell 在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\win-setup.ps1
```

脚本会检查并（通过 winget）自动安装缺失的：

- Node.js LTS
- Rust（rustup）
- Visual Studio Build Tools（含 C++ 工作负载、Windows SDK）
- 检查 WebView2（Win10/11 通常自带）

> 安装完成后请**关闭并重新打开 PowerShell**，让 PATH 生效。
> 没有 winget 时脚本会给出手动下载链接。

## 2. 构建打包

```powershell
powershell -ExecutionPolicy Bypass -File scripts\win-build.ps1
```

完成后安装包会复制到仓库根目录的 `dist-installer\`：

- `Toolkit_<版本>_x64_en-US.msi` — MSI 安装包
- `Toolkit_<版本>_x64-setup.exe` — NSIS 安装程序

两种装一种即可，分发给用户双击安装。

## 常见问题

- **构建很慢**：首次要编译全部 Rust 依赖，属正常，后续走缓存会快很多。
- **link.exe / MSVC 报错**：说明 VS Build Tools 没装全，重跑 `win-setup.ps1`，或手动在 Visual Studio Installer 勾选「使用 C++ 的桌面开发」。
- **应用打开白屏**：目标机器缺 WebView2 Runtime，去微软官网装 "Evergreen" 版即可。
- **未签名提示**：和 macOS 类似，Windows 上会弹 SmartScreen，点「更多信息 → 仍要运行」。要消除需购买代码签名证书。
