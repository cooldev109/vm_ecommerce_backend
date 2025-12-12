@echo off
REM Load .env file and run seed script
setlocal enabledelayedexpansion

REM Read .env file and set environment variables
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "line=%%a"
    REM Skip comments and empty lines
    if not "!line:~0,1!"=="#" if not "%%a"=="" (
        set "%%a=%%b"
    )
)

REM Run seed script
npm run db:seed

endlocal
