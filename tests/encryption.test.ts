import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import prisma from "../src/lib/prisma.js";
import {
  assertEncryptionKey,
  encrypt,
  decrypt,
  decryptOrPassthrough,
} from "../src/utils/crypto.utils.js";

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.contact_message.deleteMany();
});

describe("Crypto utils — AES-256-GCM", () => {
  it("chiffre puis déchiffre une chaîne (round-trip)", () => {
    const plaintext = "secret-123";
    const ciphertext = encrypt(plaintext);

    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it("produit un chiffré différent à chaque appel (IV aléatoire)", () => {
    const a = encrypt("same-value");
    const b = encrypt("same-value");

    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("rejette un chiffré corrompu (authentification GCM)", () => {
    const ciphertext = encrypt("important");
    const tampered = ciphertext.slice(0, -2) + "AB";

    expect(() => decrypt(tampered)).toThrow();
  });

  it("rejette un payload trop court", () => {
    expect(() => decrypt("aGVsbG8=")).toThrow();
  });

  it("valide une clé de 64 caractères hexadécimaux et rejette les autres", () => {
    const valid = "f03f219f47271d43fcbd96e03c2f00e31005a63717a11eb252882d829205555b";

    expect(() => assertEncryptionKey(valid)).not.toThrow();
    expect(() => assertEncryptionKey("")).toThrow();
    expect(() => assertEncryptionKey("too-short")).toThrow();
    expect(() => assertEncryptionKey("f".repeat(64))).not.toThrow();
    expect(() => assertEncryptionKey("z".repeat(64))).toThrow();
  });

  it("retourne la valeur d'origine si le payload n'est pas chiffré (migration de données existantes)", () => {
    expect(decryptOrPassthrough("plaintext-ancien")).toBe("plaintext-ancien");
    expect(decryptOrPassthrough("")).toBe("");
  });
});

describe("Chiffrement PII via Prisma Client Extension", () => {
  const PII = {
    first_name: "Alice",
    last_name: "Doe",
    email: "alice.doe@example.com",
    phone: "+33 6 12 34 56 78",
    message: "Bonjour, je postule.",
  };

  it("stocke les champs PII chiffrés en base et les déchiffre à la lecture", async () => {
    const created = await prisma.contact_message.create({ data: PII });

    expect(created.first_name).toBe("Alice");
    expect(created.phone).toBe("+33 6 12 34 56 78");

    const raw = await prisma.$queryRaw<{ phone: string; email: string }[]>`
      SELECT phone, email FROM contact_message WHERE id = ${created.id}
    `;

    expect(raw[0].phone).not.toBe(PII.phone);
    expect(raw[0].phone).not.toContain("612345678");
    expect(raw[0].email).not.toBe(PII.email);
    expect(raw[0].email).not.toContain("example.com");

    const found = await prisma.contact_message.findUnique({ where: { id: created.id } });
    expect(found?.first_name).toBe("Alice");
    expect(found?.last_name).toBe("Doe");
    expect(found?.email).toBe(PII.email);
    expect(found?.phone).toBe(PII.phone);

    const all = await prisma.contact_message.findMany();
    expect(all).toHaveLength(1);
    expect(all[0].phone).toBe(PII.phone);
  });

  it("chiffre aussi les mises à jour partielles et déchiffre le résultat", async () => {
    const created = await prisma.contact_message.create({ data: PII });

    const updated = await prisma.contact_message.update({
      where: { id: created.id },
      data: { phone: "06 98 76 54 32" },
    });

    expect(updated.phone).toBe("06 98 76 54 32");
    expect(updated.first_name).toBe("Alice");

    const raw = await prisma.$queryRaw<{ phone: string }[]>`
      SELECT phone FROM contact_message WHERE id = ${created.id}
    `;
    expect(raw[0].phone).not.toContain("98765432");
  });

  it("ne casse pas les données non chiffrées déjà présentes en base (retrocompatibilité)", async () => {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const rawClient = new PrismaClient({ adapter });

    const legacy = await rawClient.contact_message.create({ data: PII });

    const viaExtended = await prisma.contact_message.findUnique({
      where: { id: legacy.id },
    });

    expect(viaExtended?.first_name).toBe("Alice");
    expect(viaExtended?.phone).toBe("+33 6 12 34 56 78");

    await rawClient.contact_message.deleteMany({ where: { id: legacy.id } });
    await rawClient.$disconnect();
  });
});
