import { describe, it, expect } from "vitest";
import {
  sanitizePrompt,
  containsPii,
  EMAIL_TOKEN,
  PHONE_TOKEN,
  SENSITIVE_TOKEN,
} from "../src/utils/piiSanitizer.js";

describe("piiSanitizer — sanitizePrompt", () => {
  it("masque les adresses e-mail", () => {
    expect(sanitizePrompt("Écrivez-moi à marie.dupont@example.com merci")).toBe(
      `Écrivez-moi à ${EMAIL_TOKEN} merci`,
    );
    expect(sanitizePrompt("contact+pro@sub.domaine.fr")).toContain(EMAIL_TOKEN);
  });

  it("masque les téléphones français aux formats usuels", () => {
    for (const phone of [
      "06 12 34 56 78",
      "06.12.34.56.78",
      "06-12-34-56-78",
      "0612345678",
      "0798010203",
    ]) {
      expect(sanitizePrompt(`Mon numéro est ${phone}.`)).toBe(`Mon numéro est ${PHONE_TOKEN}.`);
    }
  });

  it("masque les téléphones au format international", () => {
    for (const phone of ["+33 6 12 34 56 78", "+33612345678", "0033 6 12 34 56 78", "+1 (555) 123-4567"]) {
      expect(sanitizePrompt(`Appelez le ${phone} svp`)).toBe(`Appelez le ${PHONE_TOKEN} svp`);
    }
  });

  it("masque les numéros de sécurité sociale (NIR) séparés ou continus", () => {
    expect(sanitizePrompt("NIR : 1 84 12 76 451 089 46")).toBe(`NIR : ${SENSITIVE_TOKEN}`);
    expect(sanitizePrompt("NIR : 184127645108946")).toBe(`NIR : ${SENSITIVE_TOKEN}`);
    expect(sanitizePrompt("Sécu : 2 69 05 2A 601 125 63")).toBe(`Sécu : ${SENSITIVE_TOKEN}`);
  });

  it("masque les numéros de carte bancaire (groupés et continus via Luhn)", () => {
    expect(sanitizePrompt("CB : 4111 1111 1111 1111")).toBe(`CB : ${SENSITIVE_TOKEN}`);
    expect(sanitizePrompt("CB : 4111-1111-1111-1111")).toBe(`CB : ${SENSITIVE_TOKEN}`);
    expect(sanitizePrompt("CB : 4111111111111111")).toBe(`CB : ${SENSITIVE_TOKEN}`);
  });

  it("ne masque pas les longues suites de chiffres invalides (non-Luhn)", () => {
    expect(sanitizePrompt("Référence 1234567890123")).toBe("Référence 1234567890123");
  });

  it("masque plusieurs PII dans un même message", () => {
    const input =
      "Bonjour, je suis Marie (marie@example.com, 06 12 34 56 78), ma CB est 4111 1111 1111 1111.";
    const output = sanitizePrompt(input);

    expect(output).not.toContain("marie@example.com");
    expect(output).not.toContain("06 12 34 56 78");
    expect(output).not.toContain("4111");
    expect(output).toContain(EMAIL_TOKEN);
    expect(output).toContain(PHONE_TOKEN);
    expect(output).toContain(SENSITIVE_TOKEN);
  });

  it("laisse intact un texte sans PII", () => {
    const text = "Quels sont vos horaires d'ouverture le samedi ?";
    expect(sanitizePrompt(text)).toBe(text);
  });

  it("gère les entrées vides", () => {
    expect(sanitizePrompt("")).toBe("");
  });
});

describe("piiSanitizer — containsPii", () => {
  it("détecte la présence de PII", () => {
    expect(containsPii("mon email est a.b@c.fr")).toBe(true);
    expect(containsPii("tel 0612345678")).toBe(true);
  });

  it("ne détecte rien sur un texte propre", () => {
    expect(containsPii("Question sur votre catalogue de services")).toBe(false);
  });
});
