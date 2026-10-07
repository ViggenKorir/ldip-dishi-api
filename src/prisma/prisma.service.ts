import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
/**Import PrismaClient from the generated path */
import { PrismaClient } from 'prisma/generated/client';

/**Import required adapter and database driver */
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';

@Injectable()
export class PrismaService extends PrismaClient {
  constructor(private readonly config: ConfigService) {
    /**Instatiate the database driver and the Prisma Adapter */
    const connectionString = config.get('DATABASE_URL');
    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    /**Pass the adapter instance to super() construcctor */
    super({
      adapter: adapter,
    });
  }

  // async onModuleInit() {
  //   await this.$connect();
  // }

  // async onModuleDestroy() {
  //   await this.$disconnect();
  // }
}
