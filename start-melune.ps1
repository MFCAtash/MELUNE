# MELUNE - one-click launcher
# Starts Postgres, Redis, the API (port 4000) and the web app (port 3000),
# then opens the browser. Safe to run twice: every service is skipped when
# its port is already listening.
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$infra = Join-Path $root ".infra"
$logs = Join-Path $infra "logs"
New-Item -ItemType Directory -Path $logs -Force | Out-Null

function Test-Port([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect("127.0.0.1", $port)
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

Write-Host "MELUNE - starting services..." -ForegroundColor Cyan

if (-not (Test-Port 5432)) {
  Write-Host "  [1/4] Postgres"
  Start-Process -FilePath (Join-Path $infra "pgsql16\bin\pg_ctl.exe") `
    -ArgumentList @("-D", (Join-Path $infra "pgdata"), "-l", (Join-Path $logs "pg.log"), "start") `
    -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 3
} else { Write-Host "  [1/4] Postgres already running" }

if (-not (Test-Port 6379)) {
  Write-Host "  [2/4] Redis"
  Start-Process -FilePath (Join-Path $infra "redis-win\redis-server.exe") `
    -ArgumentList @("--port", "6379", "--appendonly", "no", "--save", "900", "1") `
    -WorkingDirectory (Join-Path $infra "redis-win") -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 2
} else { Write-Host "  [2/4] Redis already running" }

if (-not (Test-Port 4000)) {
  Write-Host "  [3/4] API on http://localhost:4000"
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoExit", "-Command", "`$env:NODE_ENV='production'; Set-Location '$root\apps\api'; node dist\main.js") `
    -WindowStyle Minimized | Out-Null
  Start-Sleep -Seconds 4
} else { Write-Host "  [3/4] API already running" }

if (-not (Test-Port 3000)) {
  Write-Host "  [4/4] Web on http://localhost:3000 (first start takes ~20s)"
  Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoExit", "-Command", "Set-Location '$root\apps\web'; npm run dev") `
    -WindowStyle Minimized | Out-Null
} else { Write-Host "  [4/4] Web already running" }

Write-Host ""
Write-Host "MELUNE is ready: http://localhost:3000" -ForegroundColor Green
Write-Host "Demo login: demo@melune.app / melune12345"
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
