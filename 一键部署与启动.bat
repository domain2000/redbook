@echo off
chcp 65001 >nul
title 小红书自动发布工具 - 部署与启动环境
echo ==========================================
echo       小红书图文/视频 AI 矩阵分发系统
echo ==========================================
echo.

cd /d "%~dp0"
:: 声明浏览器内核的下载地在脚本本地，从而实现真正的全独立绿色版打包共享
set PLAYWRIGHT_BROWSERS_PATH=%~dp0pw-browsers

echo [1/4] 正在检查并清理旧进程...
taskkill /F /IM node.exe >nul 2>&1
echo 进程已清理.
echo.

echo [2/4] 正在检查 Node.js 基础运行引擎...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [致命错误] 检测到您的电脑尚未安装 Node.js 运行环境！
    echo 本自动化系统必须依赖 Node.js 才可以启动。
    echo 请前往官方中文镜像站下载并安装（请一路点击下一步默认安装即可）：
    echo 下载地址: https://nodejs.pku.edu.cn/download/
    echo 安装完成后，请重新打开本程序！
    echo ==========================================
    pause
    exit /b
)
echo Node.js 引擎检测通过。
echo.

echo [3/4] 正在检查依赖包与防封浏览器内核...

if exist "node_modules\" goto skip_npm_install
echo 初次运行或缺少环境依赖，即将为您全自动部署...
echo 正在极速拉取所需运行库 (可能需要几十秒，请保持网络畅通)...
call npm install --registry=https://registry.npmmirror.com
:skip_npm_install

if exist "pw-browsers\" goto skip_browser_install
echo 正在为您全速下载内置无头浏览器内核 (防系统缺失浏览器环境)...
call npx playwright install chromium
:skip_browser_install

echo 运行依赖环境与浏览器内核完整点亮！
echo.

echo [4/4] 正在启动核心服务...
start "Redbook Auto-Publisher Backend" cmd /k "node server.js"
echo Node 后台服务成功唤起.
echo.

echo [5/5] 正在唤起应用控制台...
:: 给予 Node 服务器三秒钟时间完成端口监听启动
timeout /t 3 >nul
start http://localhost:3001
echo.
echo ==========================================
echo 一键部署与启动流程完成！
echo.
echo [提示] 所有的操作界面均已在浏览器弹出，请前往进行控制。
echo [注意] 请不要关闭新弹出的黑色控制台黑匣子。
echo ==========================================
pause
