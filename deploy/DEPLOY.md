# 部署指南（多用户版）

目标：把本项目部署到公网服务器 `8.147.234.131`，用户通过浏览器访问，由 Node 后端同时托管前端页面、提供认证与统一大模型代理。

> ⚠️ **必须使用 HTTPS**：本项目依赖浏览器的 File System Access API（`showDirectoryPicker` 选择本地发票文件夹），该 API **只在安全上下文（HTTPS 或 localhost）下可用**。用 `http://公网IP` 直接访问会导致页面提示「浏览器不兼容」。因此正式部署需要：**域名 + HTTPS 证书**（Let's Encrypt 免费）。

---

## 一、需要提供的信息（部署前置）

| # | 信息 | 说明 |
|---|---|---|
| 1 | **SSH 登录方式** | 用户名（如 `root`/`ubuntu`）+ 密码，或 SSH 私钥；SSH 端口（默认 22，已探测开放） |
| 2 | **服务器系统与版本** | 如 `Ubuntu 22.04` / `Debian 12` / `CentOS 7`（决定安装命令） |
| 3 | **域名** | 你已有的个人域名，以及是否已把该域名的 A 记录解析到 `8.147.234.131` |
| 4 | **是否安装 Node.js** | 需要 **Node ≥ 22.5**（后端用了内置 `node:sqlite`）；没有我会装 |
| 5 | **云厂商安全组 / 防火墙** | 需放行 **80 + 443**（443 目前未开）；是否允许我改安全组（通常需你在控制台操作） |
| 6 | **管理员手机号** | 用于生成管理员账号（登录后可配置统一 API Key） |
| 7 | **代码上传方式** | A) 我把改动提交并推送到 GitHub，服务器 `git clone`（需服务器能访问 GitHub）；B) 直接 `scp` 上传整个项目 |
| 8 | **部署目录** | 默认建议 `/opt/reimbursement-helper` |
| 9 | **统一大模型 API Key** | DeepSeek Key（可部署后用管理员账号在网页里填，无需现在给） |

> 若暂时没有域名：可先用 `http://8.147.234.131` 做登录/账号功能联调，但**发票文件夹选择功能需 HTTPS 才可用**。

---

## 二、服务器准备（Ubuntu/Debian 示例）

```bash
# 1. 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
node -v   # 需 >= 22.5

# 2. 拉取/上传代码到 /opt/reimbursement-helper（见第一节第 7 项）
#    A) git clone https://github.com/charliefuchongguang/reimbursement-tool.git /opt/reimbursement-helper
#    B) 本地：scp -r ./* user@8.147.234.131:/opt/reimbursement-helper/
```

## 三、安装依赖与构建

```bash
cd /opt/reimbursement-helper
npm --prefix server install --omit=dev
npm --prefix src install
npm --prefix src run build        # 产出 src/dist，由后端托管
```

## 四、配置环境变量

```bash
cp server/.env.example server/.env
# 编辑 server/.env，务必修改：
#   JWT_SECRET=<足够长的随机字符串>
#   ADMIN_PHONE=<你的管理员手机号>
#   ADMIN_PASSWORD=<管理员初始密码，留空则为手机号后六位>
#   可选：DEFAULT_LLM_API_KEY / DEFAULT_LLM_MODEL / DEFAULT_LLM_BASE_URL
```

## 五、常驻运行（二选一）

**方案 A：systemd（推荐）**

```bash
sudo cp deploy/reimbursement.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now reimbursement
sudo systemctl status reimbursement
```

**方案 B：pm2**

```bash
sudo npm install -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup
```

## 六、Nginx 反向代理 + HTTPS

```bash
sudo cp deploy/nginx.reimbursement.conf /etc/nginx/sites-available/reimbursement
# 编辑该文件，把 server_name 改成你的域名
sudo ln -sf /etc/nginx/sites-available/reimbursement /etc/nginx/sites-enabled/reimbursement
sudo nginx -t && sudo systemctl reload nginx

# 申请证书并自动配置 HTTPS
sudo certbot --nginx -d your-domain.com
```

## 七、开放端口

- 云控制台安全组：放行 **80**、**443**
- 服务器防火墙（若启用 ufw）：`sudo ufw allow 80,443/tcp`

## 八、验证

1. 浏览器访问 `https://your-domain.com` → 应先看到登录页
2. 注册一个新账号（昵称+手机号+自定义密码）→ 直接登录使用
3. 用管理员账号登录 → 设置里填入统一 API Key → 测试连接
4. 进入「报销流程」→ 选择本地发票文件夹（验证 HTTPS 与文件系统权限）

## 九、更新发布

```bash
cd /opt/reimbursement-helper
git pull                      # 或重新上传
npm --prefix server install
npm --prefix src install && npm --prefix src run build
sudo systemctl restart reimbursement   # 或 pm2 restart reimbursement-helper
```

---

## 十、Alibaba Cloud Linux + 宝塔面板 实际部署记录（本机环境）

本次生产部署环境：

- 系统：**Alibaba Cloud Linux 3.2104**（dnf）
- 服务器 IP：`8.147.234.131`，域名 `www.ozranger.top`
- 已安装 Node v22.23.3、git，Web 服务为**宝塔面板自编译 Nginx**（prefix `/www/server/nginx`），站点配置目录 `/www/server/panel/vhost/nginx/`
- 应用目录：`/opt/reimbursement-helper`，systemd 服务名 `reimbursement`

关键点：

1. 私有仓库用 **GitHub Deploy Key**（只读）拉取，无需暴露账号 token
2. 管理员账号由 `.env` 的 `ADMIN_PHONE` 播种，首次登录强制改密
3. **大陆服务器需 ICP 备案**：未备案域名访问 80/443 会被阿里云拦截，返回 `Server: Beaver` + `Non-compliance ICP Filing`。备案前只能用 IP 访问（且 HTTPS 功能不可用）

### 备案通过后启用 HTTPS

```bash
# 在服务器执行（脚本已随仓库部署）
sudo bash /opt/reimbursement-helper/deploy/finalize-https.sh www.ozranger.top
```

脚本会：签发 Let's Encrypt 证书 → 配置 80 跳转 443 → 443 反代到 `127.0.0.1:3000` → 开启自动续期。

### 日常运维

```bash
sudo systemctl status reimbursement      # 查看状态
sudo systemctl restart reimbursement     # 重启
cd /opt/reimbursement-helper && git pull # 拉取更新
npm --prefix src run build               # 更新后重新构建前端
```