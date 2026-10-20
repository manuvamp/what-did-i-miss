# One-command demo on the Android TV emulator (stand-in for a Fire TV).
# Starts the backend, boots the "tv1080" emulator, installs the debug APK and opens the app.
#   powershell -ExecutionPolicy Bypass -File scripts\run_demo.ps1 [-Build]
# Uses port 3100 (3000 is often taken) and the 720p stream the emulator's decoder can play.
param([switch]$Build, [int]$Port = 3100)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
# JDK 17 and the Android SDK live under $env:WDIM_DEV (default: %USERPROFILE%\dev)
$dev = if ($env:WDIM_DEV) { $env:WDIM_DEV } else { "$env:USERPROFILE\dev" }
$env:JAVA_HOME = "$dev\jdk17"
$env:ANDROID_SDK_ROOT = "$dev\android-sdk"
$emulator = "$dev\android-sdk\emulator\emulator.exe"
$apk = "$root\app\build\outputs\apk\debug\app-debug.apk"

# 1. Backend
$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
    Write-Host "Starting backend on :$Port"
    $cmd = "set PORT=$Port&& npx tsx src/server.ts > `"$env:TEMP\wdim-backend.log`" 2>&1"
    Start-Process -WindowStyle Hidden -WorkingDirectory "$root\backend" cmd.exe -ArgumentList "/c", $cmd
} else { Write-Host "Backend already on :$Port" }

# 2. APK
if ($Build -or -not (Test-Path $apk)) {
    Push-Location $root
    & .\gradlew.bat assembleDebug "-PbackendUrl=http://10.0.2.2:$Port" "-PstreamPath=sintel-720"
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }
    Pop-Location
}

# 3. Emulator
if (-not ((adb devices) -match "emulator-\d+\s+device")) {
    Write-Host "Booting tv1080 emulator"
    Start-Process $emulator -ArgumentList "-avd", "tv1080", "-no-snapshot-save", "-no-boot-anim"
    adb wait-for-device
    do { Start-Sleep 3 } until ((adb shell getprop sys.boot_completed 2>$null) -match "1")
}

# 4. Install and launch
adb install -r $apk | Out-Null
adb shell monkey -p com.example.whatdidimiss -c android.intent.category.LEANBACK_LAUNCHER 1 | Out-Null
Write-Host ""
Write-Host "Running. Remote: FF/REW skip 15s | M = What did I miss? | 2 / 5 / 0 = visual recap of last 2 / 5 / 10 min"
Write-Host "In the montage: OK/right = next moment, BACK = skip to the text recap. MENU toggles the debug overlay."
