# MELUNE - stop everything
# Stops the web app, the API, Redis and Postgres that were started for this
# project. Other Node/Redis/Postgres instances on the machine are left alone.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$infra = Join-Path $root ".infra"

Write-Host "MELUNE - stopping services..." -ForegroundColor Cyan

# Web + API: only Node processes whose command line points into this folder.
$nodePids = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*$root*" } |
  Select-Object -ExpandProperty ProcessId
foreach ($procId in $nodePids) {
  Stop-Process -Id $procId -Force
  Write-Host "  stopped node $procId"
}

# Redis: only the instance that runs from .infra.
Get-Process redis-server |
  Where-Object { $_.Path -and $_.Path.StartsWith($infra, "OrdinalIgnoreCase") } |
  ForEach-Object { Stop-Process -Id $_.Id -Force; Write-Host "  stopped redis $($_.Id)" }

# Postgres: graceful shutdown of this data directory.
if (Test-Path (Join-Path $infra "pgsql16\bin\pg_ctl.exe")) {
  & (Join-Path $infra "pgsql16\bin\pg_ctl.exe") -D (Join-Path $infra "pgdata") stop -m fast | Out-Null
  Write-Host "  stopped postgres"
}

Write-Host "Done." -ForegroundColor Green
