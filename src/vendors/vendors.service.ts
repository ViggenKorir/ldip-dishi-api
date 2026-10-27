import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { Prisma } from "../../prisma/generated/client";

export type VendorQuery = {
  q?: string;
  cuisine?: string;
  openNow?: boolean;
  maxPickupMin?: number;
  sort?: "pickup" | "price";
};

const vendorInclude = {
  cuisines: true,
  amenities: true,
  dishes: {
    where: { active: true },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  },
} satisfies Prisma.VendorInclude;

const EAT = "Africa/Nairobi";

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Map a DB row to the exact `Vendor` shape the frontend already uses. */
  private toVendor(v: any) {
    const dishes = (v.dishes ?? []).map((d: any) => this.toDish(d));
    const prices = dishes.filter((d: any) => !d.soldOut).map((d: any) => d.price);
    const all = prices.length ? prices : dishes.map((d: any) => d.price);
    const pickupInMin: number = v.prepTimeMin;
    const pickupAt = new Intl.DateTimeFormat("en-KE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: EAT,
    }).format(new Date(Date.now() + pickupInMin * 60_000));

    return {
      id: v.id,
      name: v.name,
      area: v.area,
      openNow: v.openNow && v.status === "ACTIVE",
      cuisines: v.cuisines.map((c: any) => c.name),
      amenities: v.amenities.map((a: any) => a.id),
      dishes,
      priceRange: all.length ? [Math.min(...all), Math.max(...all)] : [0, 0],
      pickupAt,
      pickupInMin,
      pin: { x: v.pinX ?? 50, y: v.pinY ?? 50 },
      description: v.description ?? undefined,
      hours: v.hoursText ?? undefined,
      address: v.address ?? undefined,
      pickupInstructions: v.pickupInstructions ?? undefined,
      tags: v.tags?.length ? v.tags : undefined,
    };
  }

  private toDish(d: any) {
    return {
      id: d.id,
      name: d.name,
      price: d.price,
      featured: d.featured || undefined,
      popular: d.popular || undefined,
      soldOut: d.soldOut || undefined,
      description: d.description ?? undefined,
      category: d.category?.name,
    };
  }

  async list(query: VendorQuery) {
    const where: any = { status: "ACTIVE" };
    if (query.openNow !== undefined) where.openNow = query.openNow;
    if (query.cuisine) where.cuisines = { some: { name: { equals: query.cuisine, mode: "insensitive" } } };
    if (query.maxPickupMin !== undefined) where.prepTimeMin = { lte: query.maxPickupMin };
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { area: { contains: query.q, mode: "insensitive" } },
        { dishes: { some: { active: true, name: { contains: query.q, mode: "insensitive" } } } },
      ];
    }
    const rows = await this.prisma.vendor.findMany({
      where,
      include: vendorInclude,
      orderBy: { prepTimeMin: "asc" },
    });
    const vendors = rows.map((r: any) => this.toVendor(r));
    if (query.sort === "price") vendors.sort((a: any, b: any) => a.priceRange[0] - b.priceRange[0]);
    return vendors;
  }

  async get(id: string) {
    const row = await this.prisma.vendor.findUnique({ where: { id }, include: vendorInclude });
    if (!row || row.status !== "ACTIVE") throw new NotFoundException(`Vendor ${id} not found`);
    return this.toVendor(row);
  }

  async featuredDishes() {
    const rows: any[] = await this.prisma.dish.findMany({
      where: {
        featured: true,
        soldOut: false,
        active: true,
        vendor: { openNow: true, status: "ACTIVE" },
      },
      include: { category: true, vendor: { include: vendorInclude } },
    });
    return rows.map(({ vendor, ...dish }) => ({
      dish: this.toDish(dish),
      vendor: this.toVendor(vendor),
    }));
  }

  async getDish(id: string) {
    const row: any = await this.prisma.dish.findUnique({
      where: { id },
      include: { category: true, vendor: { include: vendorInclude } },
    });
    if (!row || !row.active) throw new NotFoundException(`Dish ${id} not found`);
    const { vendor, ...dish } = row;
    return { dish: this.toDish(dish), vendor: this.toVendor(vendor) };
  }
}
