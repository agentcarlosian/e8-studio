@echo off
REM Start a local HTTP server in the dist/ folder and open the browser
echo Starting E8 Studio in your browser...
cd /d "%~dp0dist"
start "" http://127.0.0.1:8772/index.html
python -m http.server 8772 --bind 127.0.0.1
