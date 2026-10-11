@echo off
chcp 65001 >nul
title 报销辅助工具
color 0A

echo ============================================
echo    出差报销辅助工具 - 启动中...
echo ============================================
echo.

:: 检查 Node.js（多用户版后端需要 Node 22.5 及以上，内置 node:sqlite）
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 node 命令，请确认 Node.js 已安装并加入系统 PATH（需 22.5 及以上）。
    echo.
    pause
    exit /b 1
)

:: 进入项目根目录
cd /d "%~dp0"

:: 首次运行：从示例生成后端 .env（请按需修改 JWT_SECRET / ADMIN_PHONE）
if not exist "server\.env" (
    if exist "server\.env.example" (
        echo [提示] 未找到 server\.env，正在从 .env.example 生成，请按需修改管理员手机号与 JWT_SECRET。
        copy /Y "server\.env.example" "server\.env" >nul
    )
)

echo [1/4] 检查并安装前端依赖...
if not exist "src\node_modules\vite" (
    call npm --prefix "src" install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败，请检查网络连接。
        pause
        exit /b 1
    )
) else (
    echo      前端依赖已就绪。
)

echo [2/4] 检查并安装后端依赖...
if not exist "server\node_modules\express" (
    call npm --prefix "server" install
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败，请检查网络连接。
        pause
        exit /b 1
    )
) else (
    echo      后端依赖已就绪。
)

echo [3/4] 构建前端...
call npm --prefix "src" run build
if %errorlevel% neq 0 (
    echo [错误] 前端构建失败。
    pause
    exit /b 1
)

echo [4/4] 启动服务（后端同时托管前端页面）...
echo.
echo 启动后请在浏览器访问：http://localhost:3000/
echo （请使用 Chrome 或 Edge 浏览器；关闭本窗口即可停止服务）
echo ============================================
call npm --prefix "server" start

echo.
echo ============================================
echo 服务已停止。如果上面有报错信息，请将内容截图给我。
echo ============================================
pause