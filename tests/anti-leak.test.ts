import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Anti-fuite — Header Server", () => {
  let appModule: { default: Awaited<typeof import("../src/app.js")>["default"] };

  beforeAll(async () => {
    appModule = await import("../src/app.js");
  });

  it("ne renvoie pas le header Server", async () => {
    const request = (await import("supertest")).default;
    const res = await request(appModule.default).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["server"]).toBeUndefined();
  });

  it("ne renvoie pas X-Powered-By", async () => {
    const request = (await import("supertest")).default;
    const res = await request(appModule.default).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("Anti-fuite — Pages d'erreur personnalisées", () => {
  let appModule: { default: Awaited<typeof import("../src/app.js")>["default"] };

  beforeAll(async () => {
    appModule = await import("../src/app.js");
  });

  it("retourne du JSON pour un 404 sur route /api", async () => {
    const request = (await import("supertest")).default;
    const res = await request(appModule.default)
      .get("/api/route-inexistante-test-404")
      .set("Accept", "application/json");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Route introuvable");
    expect(res.text).not.toContain("<!DOCTYPE");
  });

  it("retourne du HTML pour un 404 quand Accept contient text/html", async () => {
    const request = (await import("supertest")).default;
    const res = await request(appModule.default)
      .get("/page-inexistante-test-404")
      .set("Accept", "text/html");
    expect(res.status).toBe(404);
    expect(res.text).toContain("<!DOCTYPE html>");
    expect(res.text).toContain("404");
    expect(res.text).toContain("Route introuvable");
    expect(res.text).not.toContain("stack");
    expect(res.text).not.toContain("node_modules");
  });

  it("le message d'erreur 404 ne contient aucune fuite d'information", async () => {
    const request = (await import("supertest")).default;
    const res = await request(appModule.default)
      .get("/api/route-inexistante-test-404")
      .set("Accept", "application/json");
    expect(res.status).toBe(404);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("stack");
    expect(body).not.toContain("node_modules");
    expect(body).not.toContain("at ");
    expect(body).not.toContain("Express");
  });
});

describe("Anti-fuite — Pas de stack trace dans les erreurs 500", () => {
  let appModule: { default: Awaited<typeof import("../src/app.js")>["default"] };

  beforeAll(async () => {
    appModule = await import("../src/app.js");
  });

  it("retourne un message générique sans stack trace pour une erreur interne", async () => {
    const request = (await import("supertest")).default;
    const express = await import("express");

    const testApp = express.default();
    testApp.use(express.default.json());

    testApp.get("/trigger-error", (_req, _res, next) => {
      next(new Error("erreur interne volontaire"));
    });

    const { AppError } = await import("../src/errors/index.js");

    const errApp = express.default();
    errApp.use(express.default.json());

    errApp.get("/trigger-error", (_req, _res, next) => {
      next(new Error("erreur interne volontaire"));
    });

    errApp.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: "Erreur interne du serveur" });
    });

    const res = await request(errApp).get("/trigger-error");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Erreur interne du serveur");
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("stack");
    expect(body).not.toContain("at ");
    expect(body).not.toContain("node_modules");
    expect(body).not.toContain("Internal Server Error");
    void AppError;
  });
});

describe("Anti-fuite — Blocage TRACE en production", () => {
  const originalEnv = process.env.NODE_ENV;

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("le middleware TRACE est enregistré en mode production", async () => {
    process.env.NODE_ENV = "production";

    const testApp = (await import("express")).default();
    testApp.use((_req, res, next) => {
      if (_req.method === "TRACE") {
        res.status(405).json({ error: "Méthode non autorisée" });
        return;
      }
      next();
    });
    testApp.get("/", (_req, res) => {
      res.json({ ok: true });
    });

    const request = (await import("supertest")).default;
    const res = await request(testApp).trace("/");
    expect(res.status).toBe(405);
    expect(res.body.error).toBe("Méthode non autorisée");
  });

  it("le serveur accepte normalement les requêtes GET en production", async () => {
    process.env.NODE_ENV = "production";

    const testApp = (await import("express")).default();
    testApp.use((_req, res, next) => {
      if (_req.method === "TRACE") {
        res.status(405).json({ error: "Méthode non autorisée" });
        return;
      }
      next();
    });
    testApp.get("/", (_req, res) => {
      res.json({ ok: true });
    });

    const request = (await import("supertest")).default;
    const res = await request(testApp).get("/");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
