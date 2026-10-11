#!/bin/bash
set -e

echo "============================================"
echo "   出差报销辅助工具 - 启动中..."
echo "============================================"
echo ""

# 进入项目根目录
cd "$(dirname "$0")"

# 检查 Node.js（多用户版后端需要 Node 22.5 及以上，内置 node:sqlite）
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 node 命令，请先安装 Node.js（需 22.5 及以上）。"
    echo "  可通过以下方式安装："
    echo "    brew install node"
    echo "  或访问 https://nodejs.org/ 下载安装"
    echo ""
    read -p "按回车键退出..." _
    exit 1
fi

# 首次运行：从示例生成后端 .env
if [ ! -f "server/.env" ] && [ -f "server/.env.example" ]; then
    echo "[提示] 未找到 server/.env，正在从 .env.example 生成，请按需修改管理员手机号与 JWT_SECRET。"
    cp "server/.env.example" "server/.env"
fi

echo "[1/4] 检查并安装前端依赖..."
if [ ! -d "src/node_modules/vite" ]; then
    npm --prefix "src" install
else
    echo "     前端依赖已就绪。"
fi

echo "[2/4] 检查并安装后端依赖..."
if [ ! -d "server/node_modules/express" ]; then
    npm --prefix "server" install
else
    echo "     后端依赖已就绪。"
fi

echo "[3/4] 构建前端..."
npm --prefix "src" run build

echo "[4/4] 启动服务（后端同时托管前端页面）..."
echo ""
echo "启动后请在浏览器访问：http://localhost:3000/"
echo "（请使用 Chrome 或 Edge 浏览器；按 Ctrl+C 即可停止服务）"
echo "============================================"
npm --prefix "server" start

echo ""
echo "============================================"
echo "服务已停止。"
echo "============================================"