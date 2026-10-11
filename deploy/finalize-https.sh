#!/bin/bash
# 备案通过后，在服务器一键启用 HTTPS（Let's Encrypt）
# 用法：sudo bash finalize-https.sh [域名]   默认 www.ozranger.top
# 说明：域名备案通过后，80/443 不再被阿里云拦截，本脚本即可签发证书并开启 HTTPS。
set -e

DOMAIN=${1:-www.ozranger.top}
WEBROOT=/www/wwwroot/ozranger-acme
VHOST=/www/server/panel/vhost/nginx/ozranger.top.conf
NGINX=/www/server/nginx/sbin/nginx

if [ ! -x "$NGINX" ]; then
  NGINX=$(command -v nginx)
fi

mkdir -p "$WEBROOT"

echo "=== 1. 确保 HTTP + ACME 站点 ==="
cat > "$VHOST" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ { root $WEBROOT; }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF
$NGINX -t && $NGINX -s reload

echo "=== 2. 申请证书 ==="
certbot certonly --webroot -w "$WEBROOT" -d "$DOMAIN" \
  --non-interactive --agree-tos --register-unsafely-without-email --no-eff-email

echo "=== 3. 写入 HTTP 跳转 + HTTPS 反代 ==="
cat > "$VHOST" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location /.well-known/acme-challenge/ { root $WEBROOT; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    http2 on;
    server_name $DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF
$NGINX -t && $NGINX -s reload

echo "=== 4. 证书自动续期 ==="
systemctl enable --now certbot-renew.timer 2>/dev/null || echo "（请确认 certbot 续期任务已存在）"

echo ""
echo "HTTPS 已启用：https://$DOMAIN"