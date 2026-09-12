#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT=8123

# Ensure local server is running
if ! lsof -i :$PORT >/dev/null 2>&1; then
  echo "🚀 启动本地后台服务 (Port $PORT)..."
  python3 -m http.server $PORT >/dev/null 2>&1 &
  sleep 1
fi

echo "================================================="
echo "  🌟 中英双语对照圣经 · 公网共享链接启动器 🌟"
echo "================================================="
echo "正在建立全球 HTTPS 穿透通道..."
echo "按 Ctrl + C 可随时退出共享。"
echo ""
ssh -o StrictHostKeyChecking=no -R 80:localhost:$PORT nokey@localhost.run
