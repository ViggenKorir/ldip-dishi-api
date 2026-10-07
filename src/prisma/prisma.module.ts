import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() //Ensures that the prisma module is available to the whole application
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
