import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";
import { VENDORS } from "./mock-vendors";

// Seed over the DIRECT connection (port 5432), not the pgbouncer pooler.
// Prisma 6: replace the adapter lines with `new PrismaClient()`.
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  indoor: "Indoor seating",
  takeaway: "Takeaway",
};

async function main() {
  // Hub
  const hub = await prisma.hub.upsert({
    where: { slug: "westlands" },
    create: { name: "Westlands", slug: "westlands" },
    update: {},
  });

  // Lookups
  const cuisineNames = [...new Set(VENDORS.flatMap((v) => v.cuisines as string[]))];
  for (const name of cuisineNames) {
    await prisma.cuisine.upsert({
      where: { id: slug(name) },
      create: { id: slug(name), name },
      update: { name },
    });
  }
  for (const [id, label] of Object.entries(AMENITY_LABELS)) {
    await prisma.amenity.upsert({ where: { id }, create: { id, label }, update: { label } });
  }

  for (const v of VENDORS) {
    const data = {
      name: v.name,
      area: v.area,
      openNow: v.openNow,
      hubId: hub.id,
      description: v.description ?? null,
      hoursText: v.hours ?? null,
      address: v.address ?? null,
      pickupInstructions: v.pickupInstructions ?? null,
      tags: v.tags ?? [],
      prepTimeMin: v.pickupInMin,
      pinX: v.pin.x,
      pinY: v.pin.y,
    };
    const cuisineRefs = (v.cuisines as string[]).map((c) => ({ id: slug(c) }));
    const amenityRefs = v.amenities.map((id) => ({ id }));

    await prisma.vendor.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        ...data,
        cuisines: { connect: cuisineRefs },
        amenities: { connect: amenityRefs },
      },
      update: {
        ...data,
        cuisines: { set: cuisineRefs },
        amenities: { set: amenityRefs },
      },
    });

    // Menu categories, in order of first appearance
    const categories = [...new Set(v.dishes.map((d) => d.category ?? "Mains"))];
    const categoryIds = new Map<string, string>();
    for (const [i, name] of categories.entries()) {
      const c = await prisma.menuCategory.upsert({
        where: { vendorId_name: { vendorId: v.id, name } },
        create: { vendorId: v.id, name, sortOrder: i },
        update: { sortOrder: i },
      });
      categoryIds.set(name, c.id);
    }

    for (const [i, d] of v.dishes.entries()) {
      const dish = {
        vendorId: v.id,
        categoryId: categoryIds.get(d.category ?? "Mains")!,
        name: d.name,
        price: d.price,
        description: d.description ?? null,
        featured: d.featured ?? false,
        popular: d.popular ?? false,
        soldOut: d.soldOut ?? false,
        sortOrder: i,
      };
      await prisma.dish.upsert({
        where: { id: d.id },
        create: { id: d.id, ...dish },
        update: dish,
      });
    }
    console.log(`Seeded ${v.name} (${v.dishes.length} dishes, ${categories.length} categories)`);
  }

  await prisma.promoBanner.upsert({
    where: { id: "seed-welcome" },
    create: {
      id: "seed-welcome",
      title: "Skip the lunch queue",
      subtitle: "Pre-order, pay with M-Pesa, pick up when it is ready.",
      ctaLabel: "Browse vendors",
      ctaHref: "/discover",
    },
    update: {},
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
