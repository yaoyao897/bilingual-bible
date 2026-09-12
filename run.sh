#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT=8123
echo "✨ 启动中英双语对照圣经阅读器..."
echo "📍 访问地址: http://localhost:$PORT"
open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null
python3 -m http.server $PORT
