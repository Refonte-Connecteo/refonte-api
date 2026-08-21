#!/usr/bin/env bash
#
# setup-firewall.sh — Filtrage réseau hôte strict (UFW)
#
# Conformité : « Une matrice des flux (entrants et sortants) est établie et son
# respect est imposé par un filtrage réseau. » — cf. docs/MATRICE_DES_FLUX.md
#
# Politique appliquée :
#   - Default Deny : tout trafic entrant est refusé sauf règles explicites
#   - Entrants autorisés : SSH (22), HTTP (80), HTTPS (443)
#   - Sortants autorisés par défaut (cf. egress strict en option)
#   - Ports internes (3000, 5432, 3306, ...) inaccessibles depuis l'extérieur
#
# Usage :
#   sudo ./scripts/setup-firewall.sh
#
# Options :
#   ADMIN_IPS="1.2.3.4/32,5.6.7.8/32" sudo -E ./scripts/setup-firewall.sh
#       Restreint l'accès SSH aux seules IP d'administration (recommandé).
#   STRICT_EGRESS=1 sudo -E ./scripts/setup-firewall.sh
#       Active le filtrage sortant explicite (liste blanche DNS/NTP/HTTPS/HTTP).
#
# ⚠️  Avertissement : un accès SSH physique/console est recommandé pendant
#     l'exécution au cas où la configuration réseau nécessiterait un ajustement.

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Erreur : ce script doit être exécuté en root (sudo)." >&2
  exit 1
fi

if ! command -v ufw >/dev/null 2>&1; then
  echo "UFW n'est pas installé. Installation : apt-get install -y ufw" >&2
  exit 1
fi

echo "==> Configuration UFW — Pare-feu hôte strict =="

# ---------------------------------------------------------------------------
# 1. Réinitialisation complète des règles
# ---------------------------------------------------------------------------
echo "==> [1/6] Réinitialisation des règles UFW..."
ufw --force reset

# ---------------------------------------------------------------------------
# 2. Politique par défaut : DEFAULT DENY entrant
# ---------------------------------------------------------------------------
echo "==> [2/6] Politique 'Default Deny' (entrant) ..."
ufw default deny incoming
# Sortants : autorisés par défaut (nécessaire pour DNS/NTP/APT/HTTPS).
ufw default allow outgoing

# ---------------------------------------------------------------------------
# 3. Détermination du port SSH réel (évite de s'enfermer dehors)
# ---------------------------------------------------------------------------
SSH_PORT="$(sed -nE 's/^[[:space:]]*Port[[:space:]]+([0-9]+).*/\1/p' /etc/ssh/sshd_config 2>/dev/null | tail -n1 || true)"
SSH_PORT="${SSH_PORT:-22}"
echo "==> [3/6] Port SSH détecté : ${SSH_PORT}/tcp"

# ---------------------------------------------------------------------------
# 4. Autorisations entrantes (cf. matrice §2.1)
# ---------------------------------------------------------------------------
echo "==> [4/6] Application des règles entrantes..."

# E1 — SSH : restreint aux IP d'administration si ADMIN_IPS est défini
if [[ -n "${ADMIN_IPS:-}" ]]; then
  IFS=',' read -ra IPS <<< "${ADMIN_IPS}"
  for ip in "${IPS[@]}"; do
    ip="$(echo "${ip}" | xargs)"
    echo "    SSH autorisé pour ${ip}"
    ufw allow from "${ip}" to any port "${SSH_PORT}" proto tcp
  done
else
  echo "    ⚠️  SSH autorisé pour toute IP (définir ADMIN_IPS pour le restreindre)"
  ufw allow "${SSH_PORT}"/tcp
fi

# E2 — HTTP : redirection HTTPS + validation ACME
ufw allow 80/tcp

# E3 — HTTPS : trafic applicatif
ufw allow 443/tcp

# E7 — Tout le reste est refusé par la politique 'deny incoming' ci-dessus :
#     les ports internes 3000 (Node) et 5432 (PostgreSQL) restent donc
#     inaccessibles depuis l'extérieur, de même que 3306/33060 (MySQL).

# ---------------------------------------------------------------------------
# 5. Filtrage sortant strict (OPTIONNEL)
# ---------------------------------------------------------------------------
if [[ "${STRICT_EGRESS:-0}" == "1" ]]; then
  echo "==> [5/6] Filtrage sortant explicite (liste blanche)..."
  # Suppression de l'autorisation sortante globale, remplacée par des règles
  # explicites conformes à la matrice (§2.3).
  ufw default deny outgoing

  # S1 — DNS sortant (UDP + TCP)
  ufw allow out 53/udp
  ufw allow out 53/tcp

  # S2 — NTP sortant
  ufw allow out 123/udp

  # S3 — HTTPS sortant (APIs externes, stockage S3/R2)
  ufw allow out 443/tcp

  # S4 — HTTP sortant (APT, Let's Encrypt/ACME, CDN, Git)
  ufw allow out 80/tcp

  # S7 — Diagnostic réseau sortant (ping / traceroute)
  ufw allow out proto icmp

  echo "    Egress strict activé (DNS, NTP, HTTPS, HTTP, ICMP uniquement)."
else
  echo "==> [5/6] Filtrage sortant par défaut 'allow outgoing' (mode standard)."
  echo "    Pour un egress strict (liste blanche), relancer avec STRICT_EGRESS=1."
fi

# ---------------------------------------------------------------------------
# 6. Activation + contrôle final
# ---------------------------------------------------------------------------
echo "==> [6/6] Activation du pare-feu..."
ufw --force enable

echo
echo "============================================================"
echo "  CONTRÔLES DE CONFORMITÉ (matrice des flux)"
echo "============================================================"
echo "--- ufw status verbose -------------------------------------"
ufw status verbose

echo
echo "--- Écoute des services internes (doit être 127.0.0.1) -----"
ss -tlnp | grep -E ":(3000|5432|3306)\b" || true

echo
echo "--- Vérification : ports internes fermés à l'extérieur -------"
for port in 3000 5432 3306; do
  if ss -tln 2>/dev/null | grep -qE "0.0.0.0:${port}\b|\\*:${port}\b"; then
    echo "  ⚠️  ERREUR : le port ${port} écoute sur une interface publique !"
    echo "      -> Veuillez isoler le service sur 127.0.0.1 (voir docs/MATRICE_DES_FLUX.md §4)."
  else
    echo "  ✔ Port ${port} non exposé publiquement."
  fi
done

echo
echo "  Pare-feu configuré. Règles conformes à docs/MATRICE_DES_FLUX.md."
echo "  Pour tester depuis l'extérieur :"
echo "    nc -zv <IP_PUBLIQUE> 3000   # doit échouer"
echo "    nc -zv <IP_PUBLIQUE> 443    # doit réussir"
echo "============================================================"
