import { Controller, Get, UseGuards } from '@nestjs/common';
import { User } from 'prisma/generated/client';
import { GetUser } from 'src/auth/decorator/get-user.decorator';
import { JwtGuard } from 'src/auth/guard';

@UseGuards(JwtGuard)
@Controller('users')
export class UsersController {
  @Get('me')
  getMe(@GetUser() user: User) {
    return user;
  }
}
