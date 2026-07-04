#!/bin/bash
# 一键安装脚本：复制 Toolkit 到「应用程序」，清除隔离属性，绕过"已损坏"提示。
# 双击运行即可，无需手动输入终端命令。

APP_NAME="Toolkit.app"
DEST="/Applications"

# 脚本所在目录（DMG 挂载点）
DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$DIR/$APP_NAME"

echo "================================================"
echo "  Toolkit 安装程序"
echo "================================================"
echo ""

if [ ! -d "$SRC" ]; then
  echo "❌ 未找到 $APP_NAME，请确认本脚本与应用在同一目录。"
  echo ""
  read -n 1 -s -r -p "按任意键退出…"
  exit 1
fi

# 若已安装，先移除旧版本
if [ -d "$DEST/$APP_NAME" ]; then
  echo "→ 检测到已安装版本，正在移除旧版本…"
  rm -rf "$DEST/$APP_NAME"
fi

echo "→ 正在复制到 应用程序 …"
cp -R "$SRC" "$DEST/"

echo "→ 正在清除隔离属性（解决"已损坏"提示）…"
xattr -cr "$DEST/$APP_NAME" 2>/dev/null
xattr -dr com.apple.quarantine "$DEST/$APP_NAME" 2>/dev/null

echo ""
echo "✅ 安装完成！正在打开 Toolkit …"
open "$DEST/$APP_NAME"

echo ""
echo "你可以关闭此窗口了。"
sleep 1
