import "dotenv/config";
import readline from "node:readline/promises";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";
import { logger } from "../src/lib/logger.js";
import { revokeAllTokensForUser } from "../src/services/token.service.js";
import { AuditEventType, logAuditEvent } from "../src/services/audit.service.js";

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 12;
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "superadmin@connecteo.mg").trim().toLowerCase();
const SUPERADMIN_USERNAME = "superadmin";

/**
 * Secours du super administrateur (mot de passe oublié ou téléphone perdu).
 *
 * Exécution, sur le serveur de l'API :
 *   SUPERADMIN_PASSWORD='un mot de passe temporaire long' npm run reset-admins [-- --force]
 *
 * - Ne touche QUE le compte super administrateur (créé s'il n'existe pas) : les autres comptes,
 *   les journaux d'audit et les données restent intacts.
 * - Le mot de passe temporaire vient de SUPERADMIN_PASSWORD (12 caractères minimum, aucune valeur
 *   par défaut) et n'est jamais affiché.
 * - Toutes les sessions du compte sont coupées, son MFA et ses codes de secours effacés : il
 *   faudra scanner un nouveau QR code, puis changer le mot de passe temporaire à la connexion.
 *
 * Pour un administrateur (non super), utilisez plutôt « Réinitialiser l'accès » dans le tableau de bord.
 */
async function confirmAction(): Promise<boolean> {
  if (process.argv.includes("--force")) return true;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `Le compte ${SUPERADMIN_EMAIL} va être réinitialisé (mot de passe temporaire, MFA à refaire, sessions coupées).\n` +
        "Les autres comptes ne sont pas modifiés. Tapez OUI pour confirmer : ",
    );
    return answer.trim() === "OUI";
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const password = process.env.SUPERADMIN_PASSWORD ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    process.stderr.write(
      `SUPERADMIN_PASSWORD doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères (mot de passe temporaire, changé à la connexion).\n`,
    );
    process.exit(1);
  }

  const superAdminType = await prisma.user_type.findUnique({ where: { id: 1 } });
  if (!superAdminType) {
    throw new Error("Le type superAdmin est manquant : exécutez d'abord les migrations et le seed.");
  }

  if (!(await confirmAction())) {
    process.stdout.write("Opération annulée.\n");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const resetFields = {
    password_hash: passwordHash,
    user_type_id: 1,
    is_active: true,
    mfa_secret: null,
    mfa_enabled: false,
    mfa_recovery_codes: [],
    invitation_token: null,
    invitation_token_expires: null,
    force_password_change: true,
  };

  const superAdmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: resetFields,
    create: { email: SUPERADMIN_EMAIL, username: SUPERADMIN_USERNAME, ...resetFields },
  });
  await revokeAllTokensForUser(superAdmin.id);

  await logAuditEvent({
    eventType: AuditEventType.ADMIN_ACCESS_RESET,
    action: "Réinitialisation du super administrateur (script reset-admins)",
    success: true,
    resourceType: "user",
    resourceId: String(superAdmin.id),
    actorEmail: "script:reset-admins",
  });

  logger.info({ userId: superAdmin.id }, "Super administrateur réinitialisé");
  process.stdout.write(
    [
      "",
      `Super administrateur réinitialisé : ${SUPERADMIN_EMAIL}`,
      "  - mot de passe : celui de SUPERADMIN_PASSWORD (non affiché), à changer à la connexion ;",
      "  - MFA : un nouveau QR code sera affiché à la connexion ;",
      "  - toutes ses anciennes sessions sont coupées ; les autres comptes n'ont pas été modifiés.",
      "",
    ].join("\n"),
  );
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error(err, "Échec de la réinitialisation du super administrateur");
  await prisma.$disconnect();
  process.exit(1);
});
