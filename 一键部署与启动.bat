@echo off
chcp 65001
title 小红书自动发布工具 - 部署与启动环境
echo ==========================================
echo       小红书图文/视频 AI 矩阵分发系统
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/4] 正在检查并清理旧进程...
taskkill /F /IM node.exe >nul 2>&1
echo 进程已清理.
echo.

echo [2/4] 正在检查运行环境和依赖...
if not exist "node_modules\" (
    echo 初次运行或缺少依赖，正在为您安装所需的环境包，请耐心等待（可能需要几分钟）...
    npm install
    echo 依赖环境包搭建完美！
) else (
    echo 运行依赖环境完整.
)
echo.

echo [3/4] 正在启动核心服务...
start "Redbook Auto-Publisher Backend" cmd /k "node server.js"
echo Node 后台服务成功唤起.
echo.

echo [4/4] 正在唤起应用控制台...
:: 给予 Node 服务器三秒钟时间完成端口监听启动
timeout /t 3 >nul
start http://localhost:3001
echo.
echo ==========================================
echo 一键部署与启动流程完成！
echo 所有的操作界面均已在浏览器弹出，请前往进行控制。
echo 注意：请不要关闭新弹出的黑色控制台黑匣子。
echo ==========================================
pause
