import { Module } from "@nestjs/common";
import { VendorsController } from "./vendors.controller";
import { VendorsService } from "./vendors.service";

@Module({ controllers: [VendorsController], providers: [VendorsService] })
export class VendorsModule {}
