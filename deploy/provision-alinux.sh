#!/bin/bash
# 服务器初始化脚本：Alibaba Cloud Linux 3 / RHEL8 兼容（dnf）
# 作用：安装 Nginx 与 Certbot；Node.js 仅检查不安装（需 >= 22.5）。
# 注意：若服务器使用宝塔面板自带的 Nginx，则无需执行本脚本，直接在
#      /www/server/panel/vhost/nginx/ 下添加站点即可（见 deploy/finalize-https.sh）。
# 用法：sudo bash deploy/provision-alinux.sh
set -e

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 或 sudo 运行"
  exit 1
fi

echo "[1/3] 安装 Nginx ..."
dnf install -y nginx

echo "[2/3] 安装 Certbot（Let's Encrypt）..."
dnf install -y epel-release || true
dnf install -y certbot python3-certbot-nginx || {
  echo "dnf 安装 certbot 失败，尝试用 pip 安装 ..."
  dnf install -y python3-pip
  pip3 install --upgrade pip
  pip3 install certbot certbot-nginx
}

echo "[3/3] 启动 Nginx 并检查环境 ..."
systemctl enable --now nginx
node -v || echo "警告：未检测到 node，请安装 Node >= 22.5"
nginx -v

echo ""
echo "完成。请继续："
echo "  1) 克隆/上传代码到 /opt/reimbursement-helper"
echo "  2) npm --prefix server install --omit=dev && npm --prefix src install && npm --prefix src run build"
echo "  3) 配置 server/.env（JWT_SECRET / ADMIN_PHONE）"
echo "  4) 安装 deploy/reimbursement.service 与 deploy/nginx.reimbursement.conf"
echo "  5) sudo certbot --nginx -d ozranger.top"