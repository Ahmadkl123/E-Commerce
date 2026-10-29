# Scan de sécurité des images Docker (Trivy)

## Lancer
.\scan-images.ps1

## Scanner une image précise
.\scan-images.ps1 -Images "mon-image:1.0"

## Politique
- CRITICAL : bloque le pipeline (code de sortie 1)
- HIGH : signalé dans le rapport, à corriger par mise à jour
