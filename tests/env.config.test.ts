import { describe, it, expect } from "vitest";
import {
  assertStrongJwtSecret,
  assertNoSecretReuse,
  isKnownWeakJwtSecret,
} from "../src/config/secrets.config.js";

const randomSecret = () =>
  "3f9c2b1e8a7d4c6f9b0a1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a";

describe("assertStrongJwtSecret — pas de clés par défaut", () => {
  it("rejette une clé vide", () => {
    expect(() => assertStrongJwtSecret("")).toThrow();
  });

  it("rejette une clé trop courte (< 32 caractères)", () => {
    expect(() => assertStrongJwtSecret("short-secret")).toThrow();
  });

  it("rejette le placeholder documenté dans .env.example", () => {
    expect(() =>
      assertStrongJwtSecret("change-me-to-a-random-secret-key-in-production"),
    ).toThrow();
  });

  it("rejette les valeurs connues/faibles (change-me, secret, etc.)", () => {
    for (const weak of [
      "change-me",
      "changeme",
      "your-secret-key",
      "secret",
      "jwt-secret",
    ]) {
      expect(() => assertStrongJwtSecret(weak), weak).toThrow();
    }
  });

  it("rejette toute valeur contenant un motif 'changeme' même longue", () => {
    expect(() =>
      assertStrongJwtSecret("aLongRandomLookingValueWithChangeMeInside123456"),
    ).toThrow();
    expect(() =>
      assertStrongJwtSecret("prefix-change_me-suffix-0123456789abcdef012"),
    ).toThrow();
  });

  it("rejette les valeurs connues de 32+ caractères (blocklist stricte)", () => {
    expect(() =>
      assertStrongJwtSecret("change-me-to-a-random-secret-key-in-production"),
    ).toThrow();
    expect(() =>
      assertStrongJwtSecret("0123456789abcdef0123456789abcdef"),
    ).toThrow();
  });

  it("rejette les valeurs entièrement répétées même de longueur 32", () => {
    expect(() => assertStrongJwtSecret("a".repeat(32))).toThrow();
    expect(() => assertStrongJwtSecret("0".repeat(32))).toThrow();
    expect(() => assertStrongJwtSecret("1".repeat(32))).toThrow();
    expect(() => assertStrongJwtSecret("-".repeat(32))).toThrow();
  });

  it("accepte un secret cryptographique aléatoire de 32+ caractères", () => {
    expect(() => assertStrongJwtSecret(randomSecret())).not.toThrow();
  });

  it("ne qualifie pas comme faible un secret aléatoire", () => {
    expect(isKnownWeakJwtSecret(randomSecret())).toBe(false);
  });
});

describe("assertNoSecretReuse", () => {
  it("rejette la réutilisation du même secret pour JWT et chiffrement", () => {
    const s = randomSecret();
    expect(() => assertNoSecretReuse(s, s)).toThrow();
  });

  it("accepte deux secrets distincts", () => {
    expect(() =>
      assertNoSecretReuse(randomSecret(), "f".repeat(64)),
    ).not.toThrow();
  });
});
