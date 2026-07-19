import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  // Clean existing data (order matters for FKs)
  await prisma.event_image.deleteMany();
  await prisma.application.deleteMany();
  await prisma.spontaneous_application.deleteMany();
  await prisma.contact_message.deleteMany();
  await prisma.hero_slide.deleteMany();
  await prisma.kpi_stat.deleteMany();
  await prisma.ceo_message.deleteMany();
  await prisma.reference.deleteMany();
  await prisma.catalogue.deleteMany();
  await prisma.job_posting.deleteMany();
  await prisma.article.deleteMany();
  await prisma.event.deleteMany();

  // --- Hero Slides ---
  const heroSlides = [
    {
      image_url: "/images/c8.jpg",
      title: "Infrastructures connectées",
      description: "Des solutions réseau adaptées aux besoins des entreprises et collectivités.",
      cta_label: "Découvrir",
      cta_url: "/experience-client",
      position: 1,
      is_active: true,
    },
    {
      image_url: "/images/c9.jpg",
      title: "Transition numérique",
      description: "Accompagnons votre transformation digitale avec des services sur mesure.",
      cta_label: "En savoir plus",
      cta_url: "/impact",
      position: 2,
      is_active: true,
    },
    {
      image_url: "/images/c5.jpg",
      title: "Notre engagement",
      description: "Un réseau performant, durable et accessible pour tous.",
      cta_label: "Nous rejoindre",
      cta_url: "/notre-adn/a-propos",
      position: 3,
      is_active: true,
    },
  ];

  for (const slide of heroSlides) {
    await prisma.hero_slide.create({ data: slide });
  }
  console.log(`Created ${heroSlides.length} hero slides`);

  // --- KPI Stats ---
  const kpiStats = [
    { label: "Clients satisfaits", value: "98", unit: "%", position: 1, is_active: true },
    { label: "Kilomètres de fibre", value: "15 000", unit: "km", position: 2, is_active: true },
    { label: "Collaborateurs", value: "1 200", unit: "", position: 3, is_active: true },
    { label: "Points de présence", value: "350", unit: "", position: 4, is_active: true },
  ];

  for (const stat of kpiStats) {
    await prisma.kpi_stat.create({ data: stat });
  }
  console.log(`Created ${kpiStats.length} KPI stats`);

  // --- CEO Messages ---
  const ceoMessages = [
    {
      title: "Notre vision pour l'avenir",
      description:
        "Chez Connecteo, nous croyons que la connectivité est un levier essentiel du développement économique et social. Chaque jour, nos équipes innovent pour offrir des infrastructures réseau fiables et performantes, au service des territoires et des entreprises.",
      image_url: null,
    },
    {
      title: "Engagés pour un numérique responsable",
      description:
        "La transition numérique doit rimer avec durabilité. C'est pourquoi nous plaçons l'éco-responsabilité au cœur de notre stratégie : optimisation énergétique de nos infrastructures, recyclage de nos équipements et réduction de notre empreinte carbone.",
      image_url: "/images/pdg.jpg",
    },
  ];

  for (const msg of ceoMessages) {
    await prisma.ceo_message.create({ data: msg });
  }
  console.log(`Created ${ceoMessages.length} CEO messages`);

  // --- References (Partenaires) ---
  const references = [
    { label: "Orange", image_url: "/images/partenaire1.png", website_url: "https://www.orange.fr", position: 1, is_active: true },
    { label: "SFR", image_url: "/images/partenaire2.png", website_url: "https://www.sfr.fr", position: 2, is_active: true },
    { label: "Bouygues Telecom", image_url: "/images/partenaire3.png", website_url: "https://www.bouyguestelecom.fr", position: 3, is_active: true },
    { label: "Free", image_url: "/images/partenaire4.png", website_url: "https://www.free.fr", position: 4, is_active: true },
    { label: "Altice Media", image_url: "/images/partenaire5.png", website_url: "https://www.numericable-sfr.com", position: 5, is_active: true },
    { label: "TotalEnergies", image_url: "/images/partenaire7.png", website_url: "https://www.totalenergies.fr", position: 6, is_active: true },
    { label: "Engie", image_url: "/images/partenaire8.jpg", website_url: "https://www.engie.fr", position: 7, is_active: true },
    { label: "Vinci Energies", image_url: "/images/partenaire10.jpg", website_url: "https://www.vinci-energies.fr", position: 8, is_active: true },
  ];

  for (const ref of references) {
    await prisma.reference.create({ data: ref });
  }
  console.log(`Created ${references.length} references`);

  // --- Catalogues ---
  const catalogues = [
    { title: "Catalogue Fibre Optique 2025", file_url: "/images/c3.jpg", is_lead_magnet: true },
    { title: "Guide des infrastructures réseau", file_url: "/images/c4.jpg", is_lead_magnet: false },
    { title: "Brochure services entreprise", file_url: "/images/c5.jpg", is_lead_magnet: true },
  ];

  for (const cat of catalogues) {
    await prisma.catalogue.create({ data: cat });
  }
  console.log(`Created ${catalogues.length} catalogues`);

  // --- Job Postings ---
  const jobPostings = [
    {
      title: "Ingénieur Réseau Fiber",
      contract_type: "CDI",
      description: "Nous recherchons un ingénieur réseau spécialisé dans le déploiement de fibres optiques. Vous intervenez sur la conception et l'installation d'infrastructures haut débit pour nos clients professionnels.",
      external_url: "https://www.linkedin.com/jobs",
      fiche_url: null,
      is_active: true,
    },
    {
      title: "Technicien d'installation",
      contract_type: "CDD",
      description: "Poste de technicien pour l'installation et la mise en service d'équipements réseau chez nos clients. Permis B requis, déplacements ponctuels en Île-de-France.",
      external_url: null,
      fiche_url: null,
      is_active: true,
    },
    {
      title: "Chef de projet digital",
      contract_type: "CDI",
      description: "Pilotez des projets de transformation numérique pour nos clients grands comptes. Gestion d'équipe, planification et suivi des livrables.",
      external_url: "https://www.linkedin.com/jobs",
      fiche_url: null,
      is_active: true,
    },
    {
      title: "Commercial terrain",
      contract_type: "CDD",
      description: "Développement commercial sur le territoire francilien. Prospection, prise de contact et fidélisation de clients entreprises et collectivités.",
      external_url: null,
      fiche_url: null,
      is_active: false,
    },
  ];

  for (const job of jobPostings) {
    await prisma.job_posting.create({ data: job });
  }
  const createdJobs = await prisma.job_posting.findMany({ select: { id: true, title: true } });
  console.log(`Created ${jobPostings.length} job postings`);

  // --- Articles ---
  const articles = [
    {
      title: "Connecteo remporte le contrat fibre du Val-de-Marne",
      description: "Notre entreprise a été sélectionnée pour déployer le réseau fibre optique sur le territoire du Val-de-Marne. Ce projet d'envergure concernera plus de 50 000 foyers d'ici 2027.",
      type: "article",
      cover_url: "/images/c10.jpg",
      file_url: null,
      is_lead_magnet: false,
      is_published: true,
      published_at: new Date("2025-03-15"),
    },
    {
      title: "Rapport RSE 2024 : nos engagements environnementaux",
      description: "Découvrez notre bilan environnemental et social pour l'année 2024. Réduction de 15 % de notre empreinte carbone, recyclage de 92 % des équipements et formation de 200 collaborateurs.",
      type: "rapport",
      cover_url: "/images/c3.jpg",
      file_url: "/images/c4.jpg",
      is_lead_magnet: true,
      is_published: true,
      published_at: new Date("2025-02-01"),
    },
    {
      title: "Connecteoinnove avec la 5G industrielle",
      description: "Nos équipes testent avec succès les premiers déploiements de réseau 5G privé pour nos clients industriels. Une avancée majeure pour la connectivité des usines du futur.",
      type: "article",
      cover_url: "/images/c5.jpg",
      file_url: null,
      is_lead_magnet: false,
      is_published: true,
      published_at: new Date("2025-04-10"),
    },
    {
      title: "Partenariat stratégique avec la Région IDF",
      description: "Connecteo s'associe à la Région Île-de-France pour accélérer le raccordable des communes rurales en très haut débit.",
      type: "article",
      cover_url: "/images/c6.jpg",
      file_url: null,
      is_lead_magnet: false,
      is_published: false,
      published_at: new Date("2025-05-01"),
    },
  ];

  for (const article of articles) {
    await prisma.article.create({ data: article });
  }
  console.log(`Created ${articles.length} articles`);

  // --- Events ---
  const events = [
    {
      title: "Connecteo Expo 2025",
      description: "Venez découvrir nos dernières innovations en matière de réseau et de connectivité lors de notre salon annuel. Stand B42, Paris Expo Porte de Versailles.",
      event_date: new Date("2025-06-15"),
      youtube_url: null,
      is_published: true,
    },
    {
      title: "Journée portes ouvertes chantier",
      description: "Visitez notre chantier de déploiement fibre à Villepinte. Retrouvez nos équipes sur place pour découvrir concrètement nos méthodes de travail.",
      event_date: new Date("2025-05-20"),
      youtube_url: null,
      is_published: true,
    },
    {
      title: "Forum de l'emploi numérique",
      description: "Connecteo sera présent au forum de l'emploi numérique pour présenter ses opportunités de carrière et ses missions.",
      event_date: new Date("2025-07-10"),
      youtube_url: null,
      is_published: true,
    },
  ];

  for (const event of events) {
    await prisma.event.create({ data: event });
  }
  const createdEvents = await prisma.event.findMany({ select: { id: true, title: true } });
  console.log(`Created ${events.length} events`);

  // --- Event Images ---
  const evt1 = createdEvents.find(e => e.title === "Connecteo Expo 2025");
  const evt2 = createdEvents.find(e => e.title === "Journée portes ouvertes chantier");
  const evt3 = createdEvents.find(e => e.title === "Forum de l'emploi numérique");

  const eventImages = [
    { event_id: evt1!.id, image_url: "/images/c7.jpg", caption: "Vue du stand Connecteo", position: 1 },
    { event_id: evt1!.id, image_url: "/images/c8.jpg", caption: "Démo de nos solutions réseau", position: 2 },
    { event_id: evt1!.id, image_url: "/images/c9.jpg", caption: "Équipe Connecteo sur le stand", position: 3 },
    { event_id: evt2!.id, image_url: "/images/c10.jpg", caption: "Chantier fibre en cours", position: 1 },
    { event_id: evt2!.id, image_url: "/images/co90.jpg", caption: "Équipe terrain", position: 2 },
    { event_id: evt3!.id, image_url: "/images/c3.jpg", caption: "Forum de l'emploi numérique", position: 1 },
    { event_id: evt3!.id, image_url: "/images/c4.jpg", caption: "Espace recrutement Connecteo", position: 2 },
  ];

  for (const img of eventImages) {
    await prisma.event_image.create({ data: img });
  }
  console.log(`Created ${eventImages.length} event images`);

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
