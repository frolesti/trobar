# Recreates the asset junctions so app/ and web-app/ read assets from the
# single canonical store at <repo-root>/assets. Run once after cloning the
# repo (or whenever the junctions get deleted).
#
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-asset-junctions.ps1

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$assetsRoot = Join-Path $root 'assets'
$appShared  = Join-Path $assetsRoot 'app'
$webShared  = Join-Path $assetsRoot 'web'
$appLink    = Join-Path $root 'app\assets'
$webLink    = Join-Path $root 'web-app\public\assets'
$webGifLink = Join-Path $webShared 'gif'
$sharedGif  = Join-Path $appShared 'gif'

if (-not (Test-Path $appShared) -or -not (Test-Path $webShared)) {
    throw "Canonical assets folders missing at $assetsRoot. Restore them from git or backup first."
}

function New-Junction($link, $target) {
    if (Test-Path $link) {
        $i = Get-Item $link -Force
        if ($i.LinkType) { $i.Delete() } else { Remove-Item -Recurse -Force $link }
    }
    $parent = Split-Path -Parent $link
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    cmd /c mklink /J "$link" "$target" | Out-Null
}

# trobar.gif is the only shared asset between projects: web/gif -> app/gif
New-Junction $webGifLink $sharedGif

# Per-project junctions
New-Junction $appLink $appShared
New-Junction $webLink $webShared

Write-Host "Junctions ready:" -ForegroundColor Green
Get-Item $appLink, $webLink, $webGifLink | Select-Object FullName, LinkType, Target | Format-Table -AutoSize
