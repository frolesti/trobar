$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$lanIp = Get-NetIPConfiguration |
  Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address } |
  Select-Object -First 1 -ExpandProperty IPv4Address |
  Select-Object -First 1 -ExpandProperty IPAddress

if (-not $lanIp) {
  throw 'No s''ha pogut trobar una adreça IPv4 activa. Connecta l''ordinador a la mateixa xarxa que l''iPhone.'
}

$metroCache = Join-Path $projectRoot '.expo\metro-cache'
$devPorts = @(8081, 8082, 8083, 8084, 19000, 19001, 19002)

Set-Location $projectRoot
New-Item -ItemType Directory -Force -Path $metroCache | Out-Null

$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in $devPorts } |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $listeners) {
  Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
}

$env:METRO_CACHE_DIR = $metroCache
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp

Write-Host "Starting Expo Go for iPhone at exp://$lanIp`:8081"
Write-Host 'Keep this terminal open while testing.'
Write-Host ''

npx expo start --offline
