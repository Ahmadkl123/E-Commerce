param(
  [string[]]$Images = @(
    "grafana/grafana:latest",
    "prom/prometheus:latest",
    "sonarqube:community"
  ),
  [string]$FailOn = "CRITICAL"
)

$reports = Join-Path $PSScriptRoot "reports"
New-Item -ItemType Directory -Force -Path $reports | Out-Null

$trivy = @(
  "run", "--rm",
  "-v", "//var/run/docker.sock:/var/run/docker.sock",
  "-v", "trivy-cache:/root/.cache/",
  "aquasec/trivy:latest"
)

$failed = $false
foreach ($img in $Images) {
  Write-Host "==> Scan de $img" -ForegroundColor Cyan
  $name = $img -replace '[/:]', '_'

  # 1) Rapport lisible (HIGH et CRITICAL, corrections disponibles seulement)
  docker @trivy image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed $img |
    Tee-Object -FilePath (Join-Path $reports "$name.txt")

  # 2) Barrière de qualité : échoue si une faille du niveau $FailOn existe
  docker @trivy image --scanners vuln --severity $FailOn --ignore-unfixed --exit-code 1 --quiet $img
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "$img contient des failles $FailOn"
    $failed = $true
  }
}

if ($failed) { exit 1 }
Write-Host "Aucune faille $FailOn détectée." -ForegroundColor Green
