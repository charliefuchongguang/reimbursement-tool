@echo off
title 报销辅助工具
color 0A

echo ============================================
echo    出差报销辅助工具 - 启动中...
echo ============================================
echo.

:: 进入项目目录
cd /d "%~dp0src"

:: 检查 npm 是否可用
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 npm 命令，请确认 Node.js 已安装并添加到系统环境变量 PATH 中。
    echo.
    pause
    exit /b 1
)

:: 清理占用端口（使用 netstat，无需额外依赖）
echo [1/2] 清理端口占用...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)

:: 启动开发服务
echo [2/2] 启动开发服务器...
echo.
echo 启动后请在浏览器访问：http://localhost:5173/
echo （请使用 Chrome 或 Edge 浏览器）
echo.
echo 关闭本窗口即可停止服务
echo ============================================
call npm run dev

echo.
echo ============================================
echo 服务已停止。如果上面有报错信息，请将内容截图给我。
echo ============================================
pause
