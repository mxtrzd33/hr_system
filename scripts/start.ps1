$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
docker compose up -d --build
Write-Host "HR-system is starting: http://localhost:8080"
docker compose ps
