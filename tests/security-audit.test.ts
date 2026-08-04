import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import path from "path";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";
import { isSafeRedirectUrl, safeRedirect } from "../src/utils/safeRedirect.js";
import { getSafeFilePath } from "../src/utils/safeFile.js";
import { containsMaliciousInput } from "../src/middlewares/validation.middleware.js";

afterAll(async () => {
  await prisma.$disconnect();
});

const ALLOWED_DOMAINS = ["connecteo.mg", "www.connecteo.mg", "localhost:3001"];

describe("Sécurité des redirections (Open Redirect)", () => {
  it("autorise uniquement les chemins strictement relatifs", () => {
    expect(isSafeRedirectUrl("/dashboard", ALLOWED_DOMAINS)).toBe(true);
    expect(isSafeRedirectUrl("/admin/me", ALLOWED_DOMAINS)).toBe(true);
  });

  it("bloque les URLs protocol-relative (//domaine-externe)", () => {
    expect(isSafeRedirectUrl("//evil.com/phishing", ALLOWED_DOMAINS)).toBe(false);
    expect(isSafeRedirectUrl("/\\evil.com\\phishing", ALLOWED_DOMAINS)).toBe(false);
  });

  it("bloque les domaines externes hors liste blanche", () => {
    expect(isSafeRedirectUrl("https://evil.com/phishing", ALLOWED_DOMAINS)).toBe(false);
    expect(isSafeRedirectUrl("http://evil.com", ALLOWED_DOMAINS)).toBe(false);
    expect(isSafeRedirectUrl("https://connecteo.mg.evil.com", ALLOWED_DOMAINS)).toBe(false);
  });

  it("autorise les domaines de la liste blanche (avec ou sans sous-domaine)", () => {
    expect(isSafeRedirectUrl("https://connecteo.mg/offres", ALLOWED_DOMAINS)).toBe(true);
    expect(isSafeRedirectUrl("https://www.connecteo.mg/offres", ALLOWED_DOMAINS)).toBe(true);
    expect(isSafeRedirectUrl("http://localhost:3001", ALLOWED_DOMAINS)).toBe(true);
  });

  it("bloque les schémas non-http et les entrées vides", () => {
    expect(isSafeRedirectUrl("javascript:alert(1)", ALLOWED_DOMAINS)).toBe(false);
    expect(isSafeRedirectUrl("ftp://connecteo.mg/file", ALLOWED_DOMAINS)).toBe(false);
    expect(isSafeRedirectUrl("", ALLOWED_DOMAINS)).toBe(false);
  });

  it("répond 400 au lieu de rediriger vers une URL malveillante", () => {
    const res = {
      statusCode: 0,
      body: undefined,
      redirectedTo: undefined,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: unknown) {
        this.body = data;
        return this;
      },
      redirect(target: string) {
        this.redirectedTo = target;
        return this;
      },
    };

    safeRedirect({} as never, res as never, "https://evil.com/phishing");
    expect(res.statusCode).toBe(400);
    expect((res.body as { error: string }).error).toBe("Redirection non autorisée");
    expect(res.redirectedTo).toBeUndefined();

    safeRedirect({} as never, res as never, "/tableau-de-bord");
    expect(res.redirectedTo).toBe("/tableau-de-bord");
  });
});

describe("Sécurité des accès fichiers (Path Traversal)", () => {
  const baseDir = path.resolve("uploads");

  it("bloque les tentatives de remontée dans les dossiers (../)", () => {
    expect(getSafeFilePath(baseDir, "../../../etc/passwd")).toBeNull();
    expect(getSafeFilePath(baseDir, "..\\..\\..\\secret.txt")).toBeNull();
    expect(getSafeFilePath(baseDir, "....//....//secret.txt")).toBeNull();
    expect(getSafeFilePath(baseDir, "%2e%2e%2fsecret.txt")).toBeNull();
  });

  it("bloque les chemins absolus et entrées vides", () => {
    expect(getSafeFilePath(baseDir, "/etc/passwd")).toBeNull();
    expect(getSafeFilePath(baseDir, "")).toBeNull();
    expect(getSafeFilePath(baseDir, "   ")).toBeNull();
  });

  it("ne renvoie jamais un chemin hors du répertoire autorisé", () => {
    const safe = getSafeFilePath(baseDir, "photo.png");
    expect(safe).not.toBeNull();
    expect((safe as string).startsWith(path.resolve(baseDir) + path.sep)).toBe(true);
  });

  it("renvoie 403 Forbidden sur une tentative de path traversal via l'API", async () => {
    const res = await request(app).get("/api/upload/..%2F..%2F..%2Fsecret.txt");
    expect(res.status).toBe(403);
  });

  it("renvoie 403 même avec double encodage partiel", async () => {
    const res = await request(app).get("/api/upload/..%2e%2fsecret.txt");
    expect(res.status).toBe(403);
  });
});

describe("Protection anti-XSS (headers et validation)", () => {
  it("injecte les headers de sécurité standards (helmet)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["content-security-policy"]).toBeTruthy();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeTruthy();
    expect(res.headers["x-xss-protection"]).toBeDefined();
  });

  it("active HSTS avec maxAge ≥ 1 an, includeSubDomains et preload", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    const hsts = res.headers["strict-transport-security"] as string;
    expect(hsts).toBeTruthy();
    expect(hsts).toContain("max-age=31536000");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("type explicitement les réponses en application/json", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["content-type"]).toContain("application/json");
  });

  it("rejette un payload <script> dans le body", async () => {
    const res = await request(app)
      .post("/api/contact-message")
      .send({
        first_name: "Alice",
        last_name: "Doe",
        email: "alice@example.com",
        message: "<script>alert(document.cookie)</script>",
      });
    expect(res.status).toBe(400);
  });

  it("rejette un gestionnaire d'événement (onerror) dans la query", async () => {
    const res = await request(app).get("/api/ceomessage").query({ x: "<img src=x onerror=alert(1)>" });
    expect(res.status).toBe(400);
  });

  it("rejette un schéma javascript: dans les params", async () => {
    const res = await request(app).get("/api/event-image/redirect").query({ url: "javascript:alert(1)" });
    expect(res.status).toBe(400);
  });

  it("détecte les payloads encodés (URL et entités HTML)", () => {
    expect(containsMaliciousInput("%3Cscript%3Ealert(1)%3C/script%3E")).toBe(true);
    expect(containsMaliciousInput("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe(true);
    expect(containsMaliciousInput("Javascript&#x3a;alert(1)")).toBe(true);
    expect(containsMaliciousInput("Bonjour le monde")).toBe(false);
  });

  it("valide strictement via express-validator les routes publiques", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "pas-un-email", password: "MotDePasse123!" });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it("accepte une demande de contact légitime (pas de faux positif)", async () => {
    const res = await request(app)
      .post("/api/contact-message")
      .send({
        first_name: "Alice",
        last_name: "Doe",
        email: "alice@example.com",
        message: "Bonjour, je souhaite plus d'informations sur vos services.",
      });
    expect(res.status).toBe(201);
  });
});
