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
if %errorlevel% neq 0 goto install_node
echo Node.js 引擎检测通过。
goto skip_install_node

:install_node
echo.
echo [提示] 检测到您的电脑尚未安装 Node.js 引擎！                                                                     
echo [提示] 正在为您全自动下载 Node.js 官方安装程序，请稍候...                                                                     
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile 'node_installer.msi'"
if not exist "node_installer.msi" goto download_node_failed

echo [提示] 下载完成！即将自动弹起安装程序。                                                                     
echo [注意] 请在弹出的安装界面中，一直勾选并点击 "Next (下一步)"，直到点击 Finish 完成。                                                                     
echo [注意] 安装完毕并关闭界面后，在这个黑框里按任意键继续...                                                                     
start /wait node_installer.msi
del node_installer.msi
echo.
echo [提示] 安装流程结束，尝试重新挂载引擎...                                                                     
set "PATH=%PATH%;C:\Program Files\nodejs"
node -v >nul 2>&1
if %errorlevel% neq 0 goto node_check_failed
echo Node.js 引擎已成功挂载！                                                                     
goto skip_install_node

:download_node_failed
echo [错误] 自动下载失败，请手动前往 https://nodejs.org 下载安装。                                                                     
pause
exit /b

:node_check_failed
echo [错误] 似乎没有正确安装，或者环境变量未生效。                                                                     
echo [建议] 请关闭本黑色窗口，然后在文件夹里重新双击运行本脚本！                                                                     
pause
exit /b

:skip_install_node
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
