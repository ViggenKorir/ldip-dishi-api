import { Module } from '@nestjs/common';
import { UsersController } from './user.controller';

@Module({
  imports: [],
  controllers: [UsersController],
  providers: [],
})
export class UserModule {}
