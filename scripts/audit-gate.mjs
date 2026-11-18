#!/usr/bin/env node
/**
 * Porte d'audit des dépendances pour la CI.
 *
 * Échoue si `npm audit` signale une vulnérabilité HIGH ou CRITICAL, sauf les avis listés dans
 * audit-allowlist.json. Une exception n'est acceptée que si :
 *   - elle a une justification et une date de revue (`reviewBy`) non dépassée ;
 *   - le paquet concerné n'est PAS dans les dépendances de production (vérifié avec --omit=dev).
 * Ainsi le code livré reste couvert sans exception, et chaque exception expire d'elle-même.
 *
 * Usage : node scripts/audit-gate.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const BLOCKING = new Set(["high", "critical"]);

function audit(extraArgs = "") {
  try {
    return JSON.parse(execSync(`npm audit --json ${extraArgs}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch (error) {
    // npm audit sort en code 1 dès qu'il trouve quelque chose : le JSON est dans stdout.
    if (error.stdout) return JSON.parse(error.stdout);
    throw error;
  }
}

/** Avis de sécurité réels (pas les paquets qui ne font que dépendre d'un paquet vulnérable). */
function advisories(report) {
  const found = new Map();
  for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vuln.via) {
      if (typeof via !== "object") continue;
      const id = String(via.url ?? "").split("/").pop() || `${pkg}:${via.title}`;
      found.set(id, { id, pkg, severity: via.severity, title: via.title, url: via.url });
    }
  }
  return [...found.values()];
}

const allowlist = existsSync("audit-allowlist.json")
  ? JSON.parse(readFileSync("audit-allowlist.json", "utf8")).advisories ?? []
  : [];
const today = new Date().toISOString().slice(0, 10);

const all = advisories(audit()).filter((a) => BLOCKING.has(a.severity));
const prodPackages = new Set(advisories(audit("--omit=dev")).map((a) => a.pkg));

const failures = [];
for (const advisory of all) {
  const exception = allowlist.find((entry) => entry.id === advisory.id);
  if (!exception) {
    failures.push(`${advisory.severity.toUpperCase()} ${advisory.id} (${advisory.pkg}) : ${advisory.title}`);
  } else if (!exception.reason || !exception.reviewBy || exception.reviewBy < today) {
    failures.push(`${advisory.id} : exception expirée ou incomplète (revue prévue le ${exception.reviewBy ?? "?"})`);
  } else if (prodPackages.has(advisory.pkg)) {
    failures.push(`${advisory.id} : ${advisory.pkg} est en production, l'exception ne s'applique pas`);
  } else {
    console.log(`Exception acceptée : ${advisory.id} (${advisory.pkg}, outils de dev uniquement) — ${exception.reason}`);
  }
}

if (failures.length > 0) {
  console.error("Vulnérabilités bloquantes :");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`Audit OK : aucune vulnérabilité HIGH/CRITICAL hors exceptions (${all.length} avis examinés).`);
