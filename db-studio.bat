@echo off
REM Load .env file and run Prisma Studio
setlocal enabledelayedexpansion

REM Read .env file and set environment variables
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "line=%%a"
    REM Skip comments and empty lines
    if not "!line:~0,1!"=="#" if not "%%a"=="" (
        set "%%a=%%b"
    )
)

REM Run Prisma Studio
npx prisma studio

endlocal
