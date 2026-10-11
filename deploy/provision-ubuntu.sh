#!/bin/bash
# 服务器初始化脚本（Ubuntu/Debian）：安装 Node.js 22、Nginx、Certbot
# 用法：sudo bash deploy/provision-ubuntu.sh
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 或 sudo 运行"
  exit 1
fi

echo "[1/3] 安装 Node.js 22 ..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

echo "[2/3] 安装 Nginx 与 Certbot ..."
apt-get install -y nginx certbot python3-certbot-nginx

echo "[3/3] 版本确认"
node -v
npm -v
nginx -v

echo ""
echo "完成。Node ${NODE_VER} 就绪。请继续："
echo "  1) 上传/克隆代码到 /opt/reimbursement-helper"
echo "  2) npm --prefix server install --omit=dev && npm --prefix src install && npm --prefix src run build"
echo "  3) 配置 server/.env"
echo "  4) 部署 deploy/reimbursement.service 与 deploy/nginx.reimbursement.conf"
echo "  5) sudo certbot --nginx -d your-domain.com"