import "dotenv/config";
import readline from "node:readline/promises";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";
import { logger } from "../src/lib/logger.js";

const BCRYPT_ROUNDS = 12;
const SUPERADMIN_EMAIL = "superadmin@connecteo.mg";
const SUPERADMIN_USERNAME = "superadmin";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || "SuperAdmin123!";

/**
 * CLI de réinitialisation des comptes administrateurs.
 *
 * Exécution : npm run reset-admins [-- --force]
 *
 * Supprime tous les users (admins) et les tokens révoqués, purge les logs
 * d'audit si le rôle de base de données le permet (la table est append-only
 * pour le rôle applicatif), puis recrée un superAdmin vierge de MFA.
 * Au premier login, l'API génère un nouveau secret TOTP et affiche un QR
 * code à scanner avec Google Authenticator.
 */
async function confirmDestructiveAction(): Promise<boolean> {
  if (process.argv.includes("--force")) return true;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      "ATTENTION : tous les comptes admin seront supprimés de manière irréversible.\nTapez OUI pour confirmer : ",
    );
    return answer.trim() === "OUI";
  } finally {
    rl.close();
  }
}

function isPermissionDenied(err: unknown): boolean {
  return err instanceof Error && /permission denied/i.test(err.message);
}

async function ensureUserTypes(): Promise<void> {
  const [superAdminType, adminType] = await Promise.all([
    prisma.user_type.findUnique({ where: { id: 1 } }),
    prisma.user_type.findUnique({ where: { id: 2 } }),
  ]);

  if (!superAdminType || !adminType) {
    throw new Error(
      "Les user_type (superAdmin/admin) sont manquants. Exécutez d'abord les migrations et le seed avec un rôle superutilisateur.",
    );
  }
}

async function purgeAuditLogs(): Promise<number | "skipped"> {
  try {
    const { count } = await prisma.audit_log.deleteMany();
    return count;
  } catch (err) {
    if (isPermissionDenied(err)) {
      process.stdout.write(
        "AVERTISSEMENT : suppression de audit_log ignorée (droits insuffisants pour le rôle applicatif).\n" +
          "Pour purger manuellement, exécutez en superutilisateur :\n" +
          "  TRUNCATE TABLE \"audit_log\" RESTART IDENTITY;\n",
      );
      return "skipped";
    }
    throw err;
  }
}

async function main(): Promise<void> {
  if (!(await confirmDestructiveAction())) {
    process.stdout.write("Opération annulée.\n");
    process.exit(0);
  }

  await ensureUserTypes();
  const auditLogsDeleted = await purgeAuditLogs();

  const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, BCRYPT_ROUNDS);

  const summary = await prisma.$transaction(async (tx) => {
    const revokedTokens = await tx.revoked_token.deleteMany();
    const users = await tx.user.deleteMany();

    const superAdmin = await tx.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        username: SUPERADMIN_USERNAME,
        password_hash: hashedPassword,
        user_type_id: 1,
        is_active: true,
        mfa_enabled: false,
      },
    });

    return {
      auditLogsDeleted,
      revokedTokensDeleted: revokedTokens.count,
      usersDeleted: users.count,
      superAdminId: superAdmin.id,
    };
  });

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  logger.info("Réinitialisation des admins terminée");
  process.stdout.write(
    [
      "",
      "SuperAdmin recréé (MFA désactivé) :",
      `  email    : ${SUPERADMIN_EMAIL}`,
      `  password : ${SUPERADMIN_PASSWORD}`,
      "",
      "Prochaine étape : connectez-vous sur /admin, un QR code TOTP",
      "vous sera affiché à scanner avec Google Authenticator.",
      "",
    ].join("\n"),
  );
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  logger.error(err, "Échec de la réinitialisation des admins");
  await prisma.$disconnect();
  process.exit(1);
});
