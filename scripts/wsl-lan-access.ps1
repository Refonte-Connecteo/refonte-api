# =============================================================================
# Rend le site Docker (lancé dans WSL 2) accessible aux autres PC du réseau local.
# WSL 2 est derrière son propre réseau (NAT) : Windows doit relayer les ports vers lui.
# L'adresse de WSL change à chaque redémarrage : relancer ce script après un reboot.
#
# À lancer dans PowerShell en administrateur :
#   powershell -ExecutionPolicy Bypass -File back\scripts\wsl-lan-access.ps1
#   powershell -ExecutionPolicy Bypass -File back\scripts\wsl-lan-access.ps1 -Remove
# =============================================================================
param(
  [int[]]$Ports = @(3001, 3000),
  [switch]$Remove
)

$ErrorActionPreference = "Stop"
$ruleName = "Connecteo (Docker WSL)"

# Anciens relais de ces ports, quelle que soit l'adresse d'écoute.
$existing = netsh interface portproxy show v4tov4 | Select-String '^\s*(\d+\.\d+\.\d+\.\d+|\*)\s+(\d+)\s'
foreach ($line in $existing) {
  $addr = $line.Matches[0].Groups[1].Value; $port = [int]$line.Matches[0].Groups[2].Value
  if ($Ports -contains $port) { netsh interface portproxy delete v4tov4 listenport=$port listenaddress=$addr | Out-Null }
}
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule

if ($Remove) {
  Write-Host "Relais et règle de pare-feu supprimés."
  exit 0
}

$wslIp = ((wsl hostname -I) -split "\s+" | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1)
if (-not $wslIp) { throw "Adresse de WSL introuvable : WSL est-il démarré ?" }

# Adresse de ce PC sur le réseau local : celle de l'interface qui porte la route par défaut.
# (Écouter sur 0.0.0.0 entrerait en conflit avec le relais « localhost » de WSL.)
$lanIp = (Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up" } |
  Select-Object -First 1).IPv4Address.IPAddress
if (-not $lanIp) { throw "Adresse réseau local introuvable : le PC est-il connecté ?" }

foreach ($port in $Ports) {
  netsh interface portproxy add v4tov4 listenport=$port listenaddress=$lanIp connectport=$port connectaddress=$wslIp | Out-Null
}

# Ouvert uniquement aux réseaux privés (Wi-Fi de la maison / du bureau), pas aux réseaux publics.
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Ports `
  -Action Allow -Profile Private | Out-Null

Write-Host "WSL : $wslIp. Ports relayés : $($Ports -join ', ')."
Write-Host "Depuis les autres PC : http://${lanIp}:$($Ports[0])"
Write-Host "PUBLIC_HOST dans back/docker.env doit valoir $lanIp (sinon : corriger puis make up)."
netsh interface portproxy show v4tov4
