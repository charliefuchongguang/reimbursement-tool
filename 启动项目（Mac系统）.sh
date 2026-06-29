#!/bin/bash

echo "============================================"
echo "   出差报销辅助工具 - 启动中..."
echo "============================================"
echo ""

# 进入项目目录
cd "$(dirname "$0")/src"

# 检查 npm 是否可用
if ! command -v npm &> /dev/null; then
    echo "[错误] 未找到 npm 命令，请确认 Node.js 已安装。"
    echo "可通过以下方式安装："
    echo "  brew install node"
    echo "  或访问 https://nodejs.org/ 下载安装"
    echo ""
    read -p "按回车键退出..."
    exit 1
fi

# 清理占用端口
echo "[1/2] 清理端口占用..."
lsof -ti:5173 2>/dev/null | xargs kill -9 2>/dev/null
lsof -ti:5174 2>/dev/null | xargs kill -9 2>/dev/null

# 启动开发服务
echo "[2/2] 启动开发服务器..."
echo ""
echo "启动后请在浏览器访问：http://localhost:5173/"
echo "（请使用 Chrome 或 Edge 浏览器）"
echo ""
echo "按 Ctrl+C 即可停止服务"
echo "============================================"
npm run dev

echo ""
echo "============================================"
echo "服务已停止。如果上面有报错信息，请将内容截图给我。"
echo "============================================"
