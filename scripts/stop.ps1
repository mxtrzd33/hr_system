$ErrorActionPreference = "Stop"
docker compose down
Write-Host "HR-system stopped. Database volumes are preserved."
