@echo off
echo ================================
echo   GYMLOG - Subir a GitHub
echo ================================
echo.

cd /d "%~dp0"

git init
git add .
git commit -m "GymLog v3 - version inicial"
git branch -M main
git remote add origin https://github.com/epsilom84/gymlog.git
git push -u origin main

echo.
echo ================================
echo  Listo! Revisa github.com/epsilom84/gymlog
echo ================================
pause
