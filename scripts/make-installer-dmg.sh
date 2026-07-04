#!/bin/bash
# 构建带"一键安装脚本"的分发 DMG。
# 用法：bash scripts/make-installer-dmg.sh [universal|aarch64]
set -e

ARCH="${1:-universal}"
APP_DIR="src-tauri/target/release/bundle/macos"
[ "$ARCH" = "universal" ] && APP_DIR="src-tauri/target/universal-apple-darwin/release/bundle/macos"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/desktool-app"

APP="$APP_DIR/Toolkit.app"
if [ ! -d "$APP" ]; then
  echo "❌ 未找到 $APP，请先构建：PATH=\"\$HOME/.cargo/bin:\$PATH\" npm run tauri build -- --target universal-apple-darwin"
  exit 1
fi

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.1.0")
STAGE="$(mktemp -d)/Toolkit"
mkdir -p "$STAGE"

echo "→ 准备 DMG 内容…"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/应用程序"
cp "$ROOT/scripts/install-template.command" "$STAGE/① 双击安装.command"
chmod +x "$STAGE/① 双击安装.command"

# 说明文档
cat > "$STAGE/使用说明.txt" << 'TXT'
Toolkit 安装说明
==================

【推荐】双击「① 双击安装.command」自动安装：
  会自动复制到「应用程序」并清除隔离属性，安装后自动打开。
  · 首次双击若提示"无法验证开发者"，请右键点击该文件 →「打开」→「打开」。

【手动】也可直接把 Toolkit.app 拖入「应用程序」文件夹：
  若提示"已损坏/无法打开"，打开「终端」执行：
    xattr -cr /Applications/Toolkit.app
  然后正常打开即可。

原因：本应用未经 Apple 付费签名/公证，macOS 会对从网络下载的应用加隔离标记。
上述操作仅清除该标记，应用本身安全。
TXT

OUT_DIR="$ROOT/dist-installer"
mkdir -p "$OUT_DIR"
DMG="$OUT_DIR/Toolkit_${VERSION}_${ARCH}_installer.dmg"
rm -f "$DMG"

echo "→ 生成 DMG…"
hdiutil create -volname "Toolkit 安装" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null

echo "✅ 完成：$DMG"
ls -lh "$DMG"
