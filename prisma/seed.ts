import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  // Clean existing data
  await prisma.hero_slide.deleteMany();
  await prisma.kpi_stat.deleteMany();
  await prisma.ceo_message.deleteMany();

  // --- Hero Slides ---
  const heroSlides = [
    {
      image_url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80",
      title: "Infrastructures connectées",
      description: "Des solutions réseau adaptées aux besoins des entreprises et collectivités.",
      cta_label: "Découvrir",
      cta_url: "/experience-client",
      position: 1,
      is_active: true,
    },
    {
      image_url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80",
      title: "Transition numérique",
      description: "Accompagnons votre transformation digitale avec des services sur mesure.",
      cta_label: "En savoir plus",
      cta_url: "/impact",
      position: 2,
      is_active: true,
    },
    {
      image_url: "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=1920&q=80",
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
      image_url: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80",
    },
  ];

  for (const msg of ceoMessages) {
    await prisma.ceo_message.create({ data: msg });
  }
  console.log(`Created ${ceoMessages.length} CEO messages`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
