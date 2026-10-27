import {
  Controller,
  Get,
  NotFoundException,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseGuard } from 'src/auth/guard/supabase.guard';

@ApiTags('users')
@ApiBearerAuth('supabase-jwt')
@UseGuards(SupabaseGuard)
@Controller('me')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated Dishi profile' })
  async getMe(@Req() req: Request & { user: SupabaseUser }) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) throw new NotFoundException('User profile has not been synced.');
    return user;
  }
}
