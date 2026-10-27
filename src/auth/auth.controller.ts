import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SupabaseGuard } from './guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @UseGuards(SupabaseGuard)
  @ApiBearerAuth('supabase-jwt')
  @ApiOperation({
    summary: 'Synchronize the authenticated Supabase user',
    description:
      'Creates the Dishi user and default settings on first login; later logins update only lastLoginAt.',
  })
  @Post('sync')
  sync(@Req() req: Request & { user: SupabaseUser }) {
    return this.authService.syncUser(req.user);
  }
}
