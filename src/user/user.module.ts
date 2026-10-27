import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { UsersController } from './user.controller';

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
})
export class UserModule {}
