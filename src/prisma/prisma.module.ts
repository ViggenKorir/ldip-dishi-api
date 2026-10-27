import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/** Global: import once in AppModule, inject PrismaService anywhere. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
