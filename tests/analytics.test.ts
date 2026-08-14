import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import prisma from "../src/lib/prisma.js";
import {
  api,
  createUser,
  signToken,
  resetDatabase,
} from "./helpers/auth.js";
import { createPageViewLimiter } from "../src/middlewares/rateLimit.js";
import { inferDevice, hostFromReferrer } from "../src/services/analytics.service.js";

afterAll(async () => {
  await prisma.$disconnect();
});

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    path: "/",
    visitorId: "visitor-1",
    ...overrides,
  };
}

describe("Analytics — remontee de vues (public)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("enregistre une vue (204) et cree une ligne page_view", async () => {
    const res = await api
      .post("/api/analytics/page-view")
      .send(validPayload())
      .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)");

    expect(res.status).toBe(204);

    const stored = await prisma.page_view.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0].path).toBe("/");
    expect(stored[0].visitor_id).toBe("visitor-1");
    expect(stored[0].device).toBe("mobile");
  });

  it("rejette un path qui ne commence pas par /", async () => {
    const res = await api
      .post("/api/analytics/page-view")
      .send(validPayload({ path: "javascript:alert(1)" }));

    expect(res.status).toBe(400);
    expect(await prisma.page_view.count()).toBe(0);
  });

  it("rejette un visitorId vide ou trop long", async () => {
    const res = await api
      .post("/api/analytics/page-view")
      .send(validPayload({ visitorId: "" }));

    expect(res.status).toBe(400);

    const res2 = await api
      .post("/api/analytics/page-view")
      .send(validPayload({ visitorId: "x".repeat(200) }));

    expect(res2.status).toBe(400);
    expect(await prisma.page_view.count()).toBe(0);
  });

  it("stocke uniquement le hostname du referrer", async () => {
    await api
      .post("/api/analytics/page-view")
      .send(validPayload({ referrer: "https://www.google.com/search?q=connecteo" }));

    const stored = await prisma.page_view.findFirst();
    expect(stored?.referrer).toBe("www.google.com");
  });

  it("bloque au-dela de la limite de tracking (429)", async () => {
    const rateApp = express();
    rateApp.use(createPageViewLimiter({ windowMs: 60_000, max: 2 }));
    rateApp.post("/", (_req, res) => res.json({ ok: true }));

    expect((await request(rateApp).post("/")).status).toBe(200);
    expect((await request(rateApp).post("/")).status).toBe(200);
    expect((await request(rateApp).post("/")).status).toBe(429);
  });
});

describe("Analytics — resume dashboard (admin)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("refuse sans token (401)", async () => {
    const res = await api.get("/api/analytics/summary?range=7");
    expect(res.status).toBe(401);
  });

  it("refuse pour un admin simple (403)", async () => {
    const admin = await createUser({ userTypeId: 2 });
    const token = signToken(admin.id, 2, admin.email);

    const res = await api
      .get("/api/analytics/summary?range=7")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it("renvoie le resume complet pour un superAdmin", async () => {
    const superAdmin = await createUser({ userTypeId: 1 });
    const token = signToken(superAdmin.id, 1, superAdmin.email);

    const now = new Date();
    await prisma.page_view.createMany({
      data: [
        {
          visitor_id: "v1",
          path: "/",
          referrer: "www.google.com",
          device: "desktop",
          created_at: now,
        },
        {
          visitor_id: "v1",
          path: "/",
          referrer: "www.google.com",
          device: "desktop",
          created_at: now,
        },
        {
          visitor_id: "v2",
          path: "/carriere",
          referrer: null,
          device: "mobile",
          created_at: now,
        },
      ],
    });

    await prisma.application.create({
      data: {
        first_name: "Jean",
        last_name: "Dupont",
        email: "jean@example.com",
        cv_url: "/uploads/cv.pdf",
        job_posting: {
          create: { title: "Dev", contract_type: "CDI" },
        },
      },
    });

    const res = await api
      .get("/api/analytics/summary?range=7")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const summary = res.body.summary;

    expect(summary.rangeDays).toBe(7);
    expect(summary.totalViews).toBe(3);
    expect(summary.uniqueVisitors).toBe(2);
    expect(summary.dailySeries).toHaveLength(7);
    expect(summary.dailySeries.at(-1).views).toBe(3);

    expect(summary.topPages[0]).toMatchObject({ path: "/", views: 2 });
    expect(summary.topReferrers[0]).toMatchObject({
      referrer: "www.google.com",
      views: 2,
    });
    expect(summary.deviceBreakdown).toContainEqual({ device: "desktop", views: 2 });
    expect(summary.deviceBreakdown).toContainEqual({ device: "mobile", views: 1 });

    expect(summary.counts.applications).toBe(1);
    expect(summary.counts.spontaneousApplications).toBe(0);
    expect(summary.counts.contactMessages).toBe(0);
  });
});

describe("Analytics — helpers unitaires", () => {
  it("inferDevice distingue mobile / tablette / desktop", () => {
    expect(inferDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("mobile");
    expect(inferDevice("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(inferDevice("Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0")).toBe("desktop");
    expect(inferDevice(null)).toBe("desktop");
  });

  it("hostFromReferrer retourne null si invalide", () => {
    expect(hostFromReferrer("https://example.com/path")).toBe("example.com");
    expect(hostFromReferrer("not-a-url")).toBeNull();
    expect(hostFromReferrer(null)).toBeNull();
  });
});
