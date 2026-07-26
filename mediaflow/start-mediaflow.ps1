# Avvia MediaFlow + tunnel Cloudflare (gratis)
# Uso: clic destro → Esegui con PowerShell, oppure da terminale:
#   powershell -ExecutionPolicy Bypass -File .\start-mediaflow.ps1

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "==> Docker..." -ForegroundColor Cyan
if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
  Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
}
$deadline = (Get-Date).AddMinutes(3)
do {
  Start-Sleep 3
  docker ps 1>$null 2>$null
} while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $deadline)

Write-Host "==> MediaFlow container..." -ForegroundColor Cyan
docker compose up -d

Write-Host "==> Tunnel Cloudflare..." -ForegroundColor Cyan
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1

$log = Join-Path $PSScriptRoot 'tunnel.log'
Remove-Item $log -ErrorAction SilentlyContinue
Start-Process -FilePath (Join-Path $PSScriptRoot 'cloudflared.exe') `
  -ArgumentList 'tunnel','--url','http://127.0.0.1:8888','--no-autoupdate' `
  -RedirectStandardError $log -RedirectStandardOutput $log -WindowStyle Hidden

$url = $null
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep 1
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare.com' | Select-Object -Last 1
    if ($m) {
      $url = [regex]::Match($m.Line, 'https://[a-z0-9-]+\.trycloudflare.com').Value
      break
    }
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " MediaFlow PRONTO" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host " Proxy URL : $url"
Write-Host " Password  : ItalianGemsMfp2026"
Write-Host " Backend   : MediaFlow"
Write-Host "========================================" -ForegroundColor Green
Write-Host "1) Apri https://streamvix.hayd.uk/"
Write-Host "2) Preset Con Proxy + questi valori"
Write-Host "3) Installa su Stremio (rimuovi le copie vecchie)"
Write-Host "4) Lascia questo PC acceso"
Write-Host ""
if (-not $url) {
  Write-Host "ATTENZIONE: URL tunnel non trovato, guarda tunnel.log" -ForegroundColor Yellow
}
