import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { VendorsService } from "./vendors.service";

@ApiTags("vendors")
@Controller()
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Get("vendors")
  @ApiOperation({ summary: "List vendors (public) with their dishes" })
  @ApiQuery({ name: "q", required: false, description: "Search vendor, area or dish name" })
  @ApiQuery({ name: "cuisine", required: false, example: "Swahili" })
  @ApiQuery({ name: "openNow", required: false, type: Boolean })
  @ApiQuery({ name: "maxPickupMin", required: false, type: Number })
  @ApiQuery({ name: "sort", required: false, enum: ["pickup", "price"] })
  list(
    @Query("q") q?: string,
    @Query("cuisine") cuisine?: string,
    @Query("openNow") openNow?: string,
    @Query("maxPickupMin") maxPickupMin?: string,
    @Query("sort") sort?: "pickup" | "price",
  ) {
    return this.vendors.list({
      q,
      cuisine,
      sort,
      openNow: openNow === undefined ? undefined : openNow === "true",
      maxPickupMin: maxPickupMin === undefined ? undefined : Number(maxPickupMin),
    });
  }

  @Get("vendors/:id")
  @ApiOperation({ summary: "Get one vendor with its full menu" })
  get(@Param("id") id: string) {
    return this.vendors.get(id);
  }

  @Get("dishes/featured")
  @ApiOperation({ summary: "Featured, available dishes for Discover" })
  featured() {
    return this.vendors.featuredDishes();
  }

  @Get("dishes/:id")
  @ApiOperation({ summary: "Get a dish together with its vendor" })
  dish(@Param("id") id: string) {
    return this.vendors.getDish(id);
  }
}
