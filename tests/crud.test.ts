import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import prisma from "../src/lib/prisma.js";
import { api, createUser, signToken, resetDatabase } from "./helpers/auth.js";

let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });

async function resetContent(): Promise<void> {
  await prisma.event_image.deleteMany();
  await prisma.event.deleteMany();
  await prisma.article.deleteMany();
  await prisma.catalogue.deleteMany();
  await prisma.reference.deleteMany();
  await prisma.kpi_stat.deleteMany();
  await prisma.hero_slide.deleteMany();
  await prisma.ceo_message.deleteMany();
}

beforeAll(async () => {
  await resetDatabase();
  await resetContent();
  const user = await createUser({ userTypeId: 2 });
  token = signToken(user.id, 2, user.email);
});

afterAll(async () => {
  await resetContent();
  await resetDatabase();
  await prisma.$disconnect();
});

interface Resource {
  path: string;
  /** Clé de l'objet créé / lu, et de la liste. */
  item: string;
  list: string;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
  /** Champ optionnel que l'admin doit pouvoir vider. */
  clearable?: Record<string, null>;
}

const RESOURCES: Resource[] = [
  {
    path: "/api/article", item: "article", list: "articles",
    create: { title: "A", description: "D", cover_url: "/uploads/a.png", is_published: true },
    update: { title: "A2" }, clearable: { description: null, cover_url: null },
  },
  {
    path: "/api/event", item: "event", list: "events",
    create: { title: "E", description: "D", event_date: "2026-01-02T10:00:00.000Z", is_published: true },
    update: { title: "E2" }, clearable: { description: null, event_date: null },
  },
  {
    path: "/api/job-posting", item: "jobPosting", list: "jobPostings",
    create: { title: "J", contract_type: "CDI", description: "D" },
    update: { title: "J2", is_active: true }, clearable: { description: null },
  },
  {
    path: "/api/catalogue", item: "catalogue", list: "catalogues",
    create: { title: "C", file_url: "/uploads/c.pdf", year: 2026 },
    update: { title: "C2" }, clearable: { year: null } as Record<string, null>,
  },
  {
    path: "/api/reference", item: "reference", list: "references",
    create: { label: "R", image_url: "/images/r.png", website_url: "https://exemple.test" },
    update: { label: "R2" }, clearable: { website_url: null },
  },
  {
    path: "/api/kpistat", item: "stat", list: "stats",
    create: { label: "K", value: "+850", unit: "M" },
    update: { value: "900" }, clearable: { unit: null },
  },
  {
    path: "/api/hero-slide", item: "slide", list: "slides",
    create: { image_url: "/images/h.png", title: "H", description: "D" },
    update: { title: "H2" }, clearable: { description: null },
  },
  {
    path: "/api/ceomessage", item: "data", list: "messages",
    create: { title: "M", description: "D", image_url: "/uploads/m.png" },
    update: { title: "M2" }, clearable: { image_url: null },
  },
];

const created = (body: Record<string, unknown>, item: string) =>
  (body[item] ?? body.data ?? body.message) as Record<string, unknown>;

describe.each(RESOURCES)("CRUD $path", (r) => {
  it("crée, lit, liste, modifie, vide un champ et supprime", async () => {
    const create = await api.post(r.path).set(auth()).send(r.create);
    expect(create.status, JSON.stringify(create.body)).toBe(201);
    const id = created(create.body, r.item).id as number;

    const read = await api.get(`${r.path}/${id}`).set(auth());
    expect(read.status).toBe(200);

    const list = await api.get(r.path).set(auth());
    expect(list.status).toBe(200);
    expect((list.body[r.list] as { id: number }[]).some((x) => x.id === id)).toBe(true);

    const update = await api.put(`${r.path}/${id}`).set(auth()).send(r.update);
    expect(update.status, JSON.stringify(update.body)).toBe(200);
    const afterUpdate = await api.get(`${r.path}/${id}`).set(auth());
    const stored = Object.values(afterUpdate.body)[0] as Record<string, unknown>;
    for (const [key, value] of Object.entries(r.update)) expect(stored[key]).toBe(value);

    if (r.clearable) {
      const clear = await api.put(`${r.path}/${id}`).set(auth()).send(r.clearable);
      expect(clear.status, JSON.stringify(clear.body)).toBe(200);
      const afterClear = await api.get(`${r.path}/${id}`).set(auth());
      const cleared = Object.values(afterClear.body)[0] as Record<string, unknown>;
      for (const key of Object.keys(r.clearable)) expect(cleared[key]).toBeNull();
    }

    const del = await api.delete(`${r.path}/${id}`).set(auth());
    expect(del.status).toBe(200);
    expect((await api.get(`${r.path}/${id}`).set(auth())).status).toBe(404);
  });

  it("refuse l'écriture sans jeton", async () => {
    expect((await api.post(r.path).send(r.create)).status).toBe(401);
    expect((await api.put(`${r.path}/1`).send(r.update)).status).toBe(401);
    expect((await api.delete(`${r.path}/1`)).status).toBe(401);
  });

  it("répond 400 ou 404 sur un identifiant invalide, jamais 500", async () => {
    for (const id of ["abc", "12abc", "0", "-1", "99999999999999"]) {
      const res = await api.get(`${r.path}/${id}`).set(auth());
      expect(res.status, id).toBe(400);
    }
    expect((await api.get(`${r.path}/2147483647`).set(auth())).status).toBe(404);
    expect((await api.put(`${r.path}/2147483647`).set(auth()).send(r.update)).status).toBe(404);
    expect((await api.delete(`${r.path}/2147483647`).set(auth())).status).toBe(404);
  });
});

describe("Images d'événement", () => {
  it("couvre le CRUD et le déplacement vers un autre événement", async () => {
    const a = await prisma.event.create({ data: { title: "A", is_published: true } });
    const b = await prisma.event.create({ data: { title: "B", is_published: true } });

    const create = await api.post("/api/event-image").set(auth())
      .send({ event_id: a.id, image_url: "/uploads/i.png", caption: "C" });
    expect(create.status).toBe(201);
    const id = create.body.eventImage.id as number;

    const move = await api.put(`/api/event-image/${id}`).set(auth()).send({ event_id: b.id, caption: null });
    expect(move.status).toBe(200);
    const stored = await prisma.event_image.findUnique({ where: { id } });
    expect(stored?.event_id).toBe(b.id);
    expect(stored?.caption).toBeNull();

    expect((await api.put(`/api/event-image/${id}`).set(auth()).send({ event_id: 2147483647 })).status).toBe(404);
    expect((await api.post("/api/event-image").set(auth()).send({ event_id: 2147483647, image_url: "/uploads/i.png" })).status).toBe(404);
    expect((await api.get(`/api/event-image/event/${b.id}`)).body.eventImages).toHaveLength(1);
    expect((await api.delete(`/api/event-image/${id}`).set(auth())).status).toBe(200);
  });
});

describe("Données personnelles", () => {
  const person = { first_name: "Alex", last_name: "Martin", email: "alex@exemple.test", phone: "0341234567", cv_url: "/uploads/cv.pdf" };
  let jobId: number;

  beforeEach(async () => {
    await prisma.application.deleteMany();
    await prisma.spontaneous_application.deleteMany();
    await prisma.contact_message.deleteMany();
    await prisma.job_posting.deleteMany();
    jobId = (await prisma.job_posting.create({ data: { title: "Poste", contract_type: "CDI" } })).id;
  });

  it("candidature : dépôt public, lecture réservée aux admins", async () => {
    const res = await api.post("/api/application").send({ ...person, job_id: jobId, cover_letter: "Bonjour" });
    expect(res.status).toBe(201);
    const id = res.body.application.id as number;

    expect((await api.get("/api/application")).status).toBe(401);
    expect((await api.get(`/api/application/${id}`)).status).toBe(401);
    expect((await api.get(`/api/application/job/${jobId}`)).status).toBe(401);

    expect((await api.get("/api/application").set(auth())).body.applications).toHaveLength(1);
    expect((await api.get(`/api/application/job/${jobId}`).set(auth())).body.applications).toHaveLength(1);
    expect((await api.put(`/api/application/${id}`).set(auth()).send({ phone: null })).status).toBe(200);
    expect((await api.delete(`/api/application/${id}`).set(auth())).status).toBe(200);
  });

  it("candidature : CV obligatoire et offre existante", async () => {
    const { cv_url: _cv, ...withoutCv } = person;
    expect((await api.post("/api/application").send({ ...withoutCv, job_id: jobId })).status).toBe(400);
    expect((await api.post("/api/application").send({ ...person, job_id: 2147483647 })).status).toBe(404);
  });

  it("candidature spontanée : dépôt public, lecture réservée aux admins", async () => {
    const res = await api.post("/api/spontaneous-application").send({ ...person, motivation: "Bonjour" });
    expect(res.status).toBe(201);
    const id = res.body.spontaneousApplication.id as number;

    expect((await api.get("/api/spontaneous-application")).status).toBe(401);
    expect((await api.get(`/api/spontaneous-application/${id}`)).status).toBe(401);
    expect((await api.get(`/api/spontaneous-application/${id}`).set(auth())).status).toBe(200);
    expect((await api.put(`/api/spontaneous-application/${id}`).set(auth()).send({ motivation: null })).status).toBe(200);
    expect((await api.delete(`/api/spontaneous-application/${id}`).set(auth())).status).toBe(200);
  });

  it("une offre publique n'expose jamais ses candidats", async () => {
    await api.post("/api/application").send({ ...person, job_id: jobId });

    const list = await api.get("/api/job-posting?onlyActive=true");
    const detail = await api.get(`/api/job-posting/${jobId}`);
    expect(JSON.stringify(list.body)).not.toContain(person.email);
    expect(JSON.stringify(detail.body)).not.toContain(person.email);
  });

  it("message de contact : dépôt public, marquage lu, suppression", async () => {
    const res = await api.post("/api/contact-message").send({ first_name: "A", last_name: "B", email: "a@b.test", message: "Salut" });
    expect(res.status).toBe(201);
    const id = (res.body.contactMessage ?? res.body.data).id as number;

    expect((await api.get("/api/contact-message")).status).toBe(401);
    expect((await api.put(`/api/contact-message/${id}/read`).set(auth())).status).toBe(200);
    const read = await api.get(`/api/contact-message/${id}`).set(auth());
    expect(read.body.contactMessage.is_read).toBe(true);
    expect((await api.delete(`/api/contact-message/${id}`).set(auth())).status).toBe(200);
  });
});

describe("Brouillons et contenus inactifs", () => {
  beforeEach(resetContent);

  it("le public ne voit que le contenu publié, l'admin voit tout", async () => {
    const draftArticle = await prisma.article.create({ data: { title: "Brouillon" } });
    await prisma.article.create({ data: { title: "Public", is_published: true } });
    const draftEvent = await prisma.event.create({ data: { title: "Brouillon" } });
    const image = await prisma.event_image.create({ data: { event_id: draftEvent.id, image_url: "/uploads/x.png" } });
    await prisma.kpi_stat.create({ data: { label: "Off", value: "1", is_active: false } });

    expect((await api.get("/api/article")).body.articles).toHaveLength(1);
    expect((await api.get("/api/article").set(auth())).body.articles).toHaveLength(2);
    expect((await api.get(`/api/article/${draftArticle.id}`)).status).toBe(404);
    expect((await api.get(`/api/article/${draftArticle.id}`).set(auth())).status).toBe(200);
    expect((await api.get(`/api/event/${draftEvent.id}`)).status).toBe(404);
    expect((await api.get("/api/event-image")).body.eventImages).toHaveLength(0);
    expect((await api.get(`/api/event-image/${image.id}`)).status).toBe(404);
    expect((await api.get(`/api/event-image/event/${draftEvent.id}`)).body.eventImages).toHaveLength(0);
    expect((await api.get("/api/kpistat")).body.stats).toHaveLength(0);
    expect((await api.get("/api/kpistat").set(auth())).body.stats).toHaveLength(1);
  });

  it("un vieux jeton ne casse pas le site public, mais reste refusé côté admin", async () => {
    const stale = { Authorization: "Bearer jeton-expire" };
    expect((await api.get("/api/article?onlyPublished=true").set(stale)).status).toBe(200);
    expect((await api.get("/api/kpistat?active=true").set(stale)).status).toBe(200);
    expect((await api.get("/api/article").set(stale)).status).toBe(401);
  });
});

describe("Statistiques du tableau de bord", () => {
  beforeEach(async () => {
    await prisma.page_view.deleteMany();
    await prisma.application.deleteMany();
    await prisma.spontaneous_application.deleteMany();
    await prisma.contact_message.deleteMany();
  });

  const summary = async (range = 7) => {
    const admin = await createUser({ userTypeId: 1 });
    const res = await api.get(`/api/analytics/summary?range=${range}`)
      .set("Authorization", `Bearer ${signToken(admin.id, 1, admin.email)}`);
    expect(res.status).toBe(200);
    return res.body.summary;
  };

  it("correspond à un décompte indépendant fait en base", async () => {
    const day = 24 * 60 * 60 * 1000;
    const now = Date.now();
    await prisma.page_view.createMany({
      data: [
        { visitor_id: "a", path: "/", device: "desktop", referrer: "google.com", created_at: new Date(now) },
        { visitor_id: "a", path: "/contact", device: "desktop", created_at: new Date(now) },
        { visitor_id: "b", path: "/", device: "mobile", created_at: new Date(now - 2 * day) },
        { visitor_id: "c", path: "/", device: "tablet", created_at: new Date(now - 30 * day) }, // hors période
      ],
    });

    const s = await summary(7);
    expect(s.totalViews).toBe(3);
    expect(s.uniqueVisitors).toBe(2);
    expect(s.viewsPerDay).toBe(0.4);
    expect(s.dailySeries).toHaveLength(7);
    expect(s.dailySeries.reduce((n: number, d: { views: number }) => n + d.views, 0)).toBe(3);
    expect(s.topPages[0]).toEqual({ path: "/", views: 2, visitors: 2 });
    expect(s.topReferrers).toEqual([{ referrer: "google.com", views: 1 }]);
    expect(s.deviceBreakdown.reduce((n: number, d: { views: number }) => n + d.views, 0)).toBe(3);
  });

  it("compte tous les messages non lus, même anciens", async () => {
    await prisma.contact_message.create({
      data: { first_name: "A", last_name: "B", email: "a@b.test", message: "x", submitted_at: new Date("2020-01-01") },
    });
    const s = await summary(7);
    expect(s.counts.contactMessages).toBe(0);
    expect(s.counts.unreadContactMessages).toBe(1);
  });

  it("n'enregistre ni les robots ni la navigation interne comme source", async () => {
    await api.post("/api/analytics/page-view").set("User-Agent", "Googlebot/2.1")
      .send({ path: "/", visitorId: "bot" });
    await api.post("/api/analytics/page-view").set("User-Agent", "Mozilla HeadlessChrome/120")
      .send({ path: "/", visitorId: "headless" });
    expect(await prisma.page_view.count()).toBe(0);

    const internal = new URL(process.env.FRONTEND_URL ?? "http://localhost:3001").origin;
    await api.post("/api/analytics/page-view").set("User-Agent", "Mozilla/5.0")
      .send({ path: "/", visitorId: "humain", referrer: `${internal}/contact` });
    const stored = await prisma.page_view.findFirst();
    expect(stored?.visitor_id).toBe("humain");
    expect(stored?.referrer).toBeNull();
  });
});
