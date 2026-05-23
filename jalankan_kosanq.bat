@echo off
title KosanQ Starter
echo [1/3] Menyiapkan Lingkungan Android...
set "PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools"
set "PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\emulator"

echo [2/3] Menyalakan Emulator (Medium_Phone_API_36.1)...
start "" emulator.exe -avd Medium_Phone_API_36.1 -no-snapshot-load

echo Sedang menunggu emulator siap (30 detik)...
timeout /t 30 /nobreak > nul

echo [3/3] Menjalankan Expo...
cd KosanQ.app
npx expo start --clear

pause
