// pm2 配置：在项目根目录执行 `pm2 start deploy/ecosystem.config.cjs`
module.exports = {
  apps: [
    {
      name: 'reimbursement-helper',
      cwd: '/opt/reimbursement-helper/server',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}