<#
    scripts/runAndroid.ps1

    Arrenca un emulador d'Android i hi instal-la la build escollida de l'app
    (debug o release). Configura automaticament JAVA_HOME (JDK d'Android Studio)
    i ANDROID_HOME, selecciona l'entorn (.env.production per defecte) i espera
    que l'emulador acabi d'arrencar abans de compilar.

  Us:
    powershell -ExecutionPolicy Bypass -File scripts/runAndroid.ps1
    powershell -ExecutionPolicy Bypass -File scripts/runAndroid.ps1 -Avd troBar_play -Env dev
    powershell -ExecutionPolicy Bypass -File scripts/runAndroid.ps1 -Variant release

    Parametres:
        -Avd              Nom de l'emulador (AVD). Per veure'ls: emulator -list-avds
        -Env              Entorn: prod (per defecte) | dev
        -Variant          Build: debug (per defecte) | release
        -RestartEmulator  Tanca i reinicia l'emulador per forcar estat net
        -CleanInstall     Desinstal-la l'app abans d'instal-lar la build
        -SkipBuild        No compila ni instal-la; nomes obre l'app ja instal-lada
        -ColdBoot         Forca cold boot (sense snapshots). Per defecte usa fast boot per anar rapid.
        -RamMb            RAM de l'emulador en MB (per defecte 4096)
        -Gpu              Mode GPU de l'emulador: auto (recomanat) | host | angle_indirect | swiftshader_indirect
        -BootTimeoutSec   Temps maxim d'arrencada abans de timeout (per defecte 600s)
#>

param(
    [string]$Avd = "trobar_lite",
    [ValidateSet("prod", "dev")]
    [string]$Env = "prod",
    [ValidateSet("debug", "release")]
    [string]$Variant = "debug",
    [switch]$RestartEmulator,
    [switch]$CleanInstall,
    [switch]$SkipBuild,
    [switch]$ColdBoot,
    [ValidateRange(2048, 8192)]
    [int]$RamMb = 4096,
    [ValidateSet("auto", "host", "angle_indirect", "swiftshader_indirect")]
    [string]$Gpu = "auto",
    [ValidateRange(180, 1200)]
    [int]$BootTimeoutSec = 600
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# 1) JDK que ve amb Android Studio
$jbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $jbr) {
    $env:JAVA_HOME = $jbr
} elseif (-not $env:JAVA_HOME) {
    throw "No s'ha trobat cap JDK. Instal-la Android Studio o defineix JAVA_HOME."
}

# 2) Android SDK
$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
if (-not (Test-Path $sdk)) {
    throw "No s'ha trobat l'Android SDK a $sdk"
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$sdk\platform-tools;$sdk\emulator;$env:JAVA_HOME\bin;$env:Path"

$adb = Join-Path $sdk "platform-tools\adb.exe"
$emulator = Join-Path $sdk "emulator\emulator.exe"
& $adb start-server | Out-Null

# 3) Selecciona l'entorn (.env.$Env -> .env)
Write-Host "==> Activant entorn: $Env" -ForegroundColor Cyan
npm run "env:$Env"

# 4) Arrenca l'emulador si no n'hi ha cap engegat
# adb pot escriure errors transitoris ("error: closed") mentre arrenca; els ignorem.
function Get-Prop([string]$name) {
    try {
        $prev = $ErrorActionPreference
        $ErrorActionPreference = "SilentlyContinue"
        $out = (& $adb shell getprop $name 2>$null | Out-String).Trim()
        $ErrorActionPreference = $prev
        return $out
    } catch {
        return ""
    }
}

function Start-Emulator([string]$GpuMode) {
    Write-Host "==> Arrencant emulador: $Avd (gpu=$GpuMode, ram=${RamMb}MB)" -ForegroundColor Cyan
    $args = @("-avd", $Avd, "-memory", "$RamMb", "-gpu", "$GpuMode", "-no-audio", "-no-boot-anim")
    if ($ColdBoot) {
        $args += @("-no-snapshot-load", "-no-snapshot-save")
    }
    return Start-Process -FilePath $emulator -ArgumentList $args -PassThru
}

function Get-AdbState() {
    $prev = $ErrorActionPreference
    try {
        # En alguns entorns, `adb get-state` amb "offline" escriu a stderr i
        # genera NativeCommandError. Ho executem via cmd i amb stderr anul-lat.
        $ErrorActionPreference = "Continue"
        $s = (& cmd /c "`"$adb`" get-state 2>nul" | Out-String).Trim()
        return $s
    } catch {
        return ""
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Wait-EmulatorReady([int]$TimeoutSec, [int]$EmuPid = 0) {
    $ticks = [Math]::Ceiling($TimeoutSec / 2)
    for ($i = 0; $i -lt $ticks; $i++) {
        if ($EmuPid -gt 0) {
            $proc = Get-Process -Id $EmuPid -ErrorAction SilentlyContinue
            if (-not $proc) {
                # L'emulador ha mort abans d'exposar cap device adb.
                return $false
            }
        }
        $boot = Get-Prop "sys.boot_completed"
        $bootAnim = Get-Prop "init.svc.bootanim"
        $state = Get-AdbState
        if ($state -eq "offline") {
            & $adb reconnect offline 2>$null | Out-Null
        }
        if ($boot -eq "1" -and $bootAnim -eq "stopped" -and $state -eq "device") {
            return $true
        }
        Start-Sleep -Seconds 2
    }
    return $false
}

$running = (& $adb devices 2>$null | Select-String "emulator-")
if ($RestartEmulator -and $running) {
    Write-Host "==> Reiniciant emulador..." -ForegroundColor Cyan
    & $adb emu kill | Out-Null
    Start-Sleep -Seconds 4
    $running = $null
}

if (-not $running) {
    $bootOk = $false
    $gpuCandidates = @($Gpu, "angle_indirect", "swiftshader_indirect") | Select-Object -Unique
    foreach ($gpuMode in $gpuCandidates) {
        $emuProc = Start-Emulator -GpuMode $gpuMode
        Write-Host "==> Esperant que l'emulador arrenqui..." -ForegroundColor Cyan
        if (Wait-EmulatorReady -TimeoutSec $BootTimeoutSec -EmuPid $emuProc.Id) {
            $bootOk = $true
            break
        }

        Write-Host "==> Arrencada fallida amb gpu=$gpuMode. Provant seguent mode..." -ForegroundColor Yellow
        try { & $adb emu kill | Out-Null } catch {}
        try { Stop-Process -Id $emuProc.Id -Force -ErrorAction SilentlyContinue } catch {}
        Start-Sleep -Seconds 4
    }

    if (-not $bootOk) {
        throw "L'emulador no ha pogut arrencar amb cap mode GPU (auto/angle/swiftshader)."
    }
} else {
    Write-Host "==> Esperant que l'emulador arrenqui..." -ForegroundColor Cyan
    if (-not (Wait-EmulatorReady -TimeoutSec $BootTimeoutSec)) {
        throw "L'emulador existent no ha entrat en estat llest a temps."
    }
}

# Espera extra: Android pot reportar boot_completed=1 abans que UI/serveis estiguin estables.
for ($i = 0; $i -lt 60; $i++) {
    if ((Get-Prop "init.svc.bootanim") -eq "stopped") { break }
    Start-Sleep -Seconds 2
}

# Espera que PackageManager estigui operatiu i redueix la probabilitat d'ANR del Launcher.
for ($i = 0; $i -lt 40; $i++) {
    $pmReady = (& $adb shell pm path android 2>$null | Out-String)
    if ($pmReady -match "package:") { break }
    Start-Sleep -Seconds 2
}

# Dona uns segons finals a Google services/launcher per acabar tasques d'arrencada.
for ($i = 0; $i -lt 8; $i++) {
    Start-Sleep -Seconds 1
}

Write-Host "==> Emulador llest." -ForegroundColor Green

if ($CleanInstall -and -not $SkipBuild) {
    Write-Host "==> Netejant instal-lacio anterior..." -ForegroundColor Cyan
    & $adb uninstall com.trobar.app | Out-Null
}

# 5) Compila + instal-la (opcional) i arrenca l'app
if (-not $SkipBuild) {
    $assembleTask = if ($Variant -eq "release") { "app:assembleRelease" } else { "app:assembleDebug" }
    Write-Host "==> Compilant l'app ($Variant; pot trigar la primera vegada)..." -ForegroundColor Cyan
    Push-Location (Join-Path $repoRoot "android")
    try {
        # Sense --no-daemon per accelerar compilacions consecutives.
        cmd /c gradlew.bat $assembleTask -PreactNativeArchitectures=x86_64
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle ha fallat durant $assembleTask (exit code $LASTEXITCODE)."
        }
    } finally {
        Pop-Location
    }

    function Install-ApkWithRetry([string]$ApkPath) {
        if (-not (Test-Path $ApkPath)) {
            throw "No s'ha trobat l'APK a: $ApkPath"
        }

        for ($attempt = 1; $attempt -le 4; $attempt++) {
            Write-Host "==> Instal-lant APK (intent $attempt/4)..." -ForegroundColor Cyan

            & $adb wait-for-device | Out-Null
            & $adb reconnect offline 2>$null | Out-Null
            & $adb shell rm -f /data/local/tmp/*.apk 2>$null | Out-Null

            # Verifica que el package manager estigui operatiu abans d'instal-lar.
            $pmReady = (& $adb shell pm path android 2>$null | Out-String)
            if ($pmReady -notmatch "package:") {
                Start-Sleep -Seconds 2
            }

            & $adb install -r -d "$ApkPath"
            if ($LASTEXITCODE -eq 0) {
                return
            }

            Write-Host "==> Instal-lacio fallida (intent $attempt). Reintentant..." -ForegroundColor Yellow
            & $adb kill-server | Out-Null
            & $adb start-server | Out-Null
            Start-Sleep -Seconds 3
        }

        throw "No s'ha pogut instal-lar l'APK despres de 4 intents."
    }

    $apkDir = Join-Path $repoRoot "android\app\build\outputs\apk\$Variant"
    $apkPattern = if ($Variant -eq "release") { "app-release*.apk" } else { "app-debug*.apk" }
    $apk = Get-ChildItem -Path $apkDir -Filter $apkPattern -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $apk) {
        throw "No s'ha generat cap APK a $apkDir"
    }

    Install-ApkWithRetry -ApkPath $apk.FullName
} else {
    Write-Host "==> Mode rapid: saltant compilacio i instal-lacio." -ForegroundColor Green
}

Write-Host "==> Obrint l'app..." -ForegroundColor Cyan
& $adb shell am force-stop com.trobar.app | Out-Null
& $adb shell am start -n com.trobar.app/.MainActivity | Out-Null
Start-Sleep -Seconds 2
$appPid = (& $adb shell pidof com.trobar.app 2>$null | Out-String).Trim()
if (-not $appPid) {
    throw "L'app no ha arrencat correctament (pid buit)."
}
Write-Host "==> App engegada (pid: $appPid)." -ForegroundColor Green
